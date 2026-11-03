<?php

namespace Tests\Feature;

use App\Jobs\ProcessOmrSheet;
use App\Models\AnswerSheet;
use App\Models\OmrProcessingJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\CreatesOmrFixtures;
use Tests\TestCase;

class OmrProcessingTest extends TestCase
{
    use CreatesOmrFixtures;
    use RefreshDatabase;

    public function test_upload_creates_domain_job_and_dispatches_queue_work(): void
    {
        Storage::fake('local');
        Queue::fake();
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Sanctum::actingAs($staff);

        $response = $this->post('/api/sheets/upload', [
            'applicant_id' => $applicant->id,
            'image' => UploadedFile::fake()->image('sheet.jpg', 1200, 1600),
        ]);

        $response->assertAccepted()
            ->assertJsonPath('job.status', 'Queued')
            ->assertJsonPath('sheet.applicant_id', $applicant->id);
        $jobId = $response->json('job.id');
        Queue::assertPushed(
            ProcessOmrSheet::class,
            fn (ProcessOmrSheet $job) => $job->processingJobId === $jobId && $job->queue === 'omr'
        );
        $response->assertJsonPath('sheet.storage_disk', 'local');
        Storage::disk('local')->assertExists($response->json('sheet.image_path'));
    }

    public function test_upload_uses_the_database_backed_omr_queue(): void
    {
        Storage::fake('local');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Sanctum::actingAs($staff);
        $originalConnection = config('queue.default');
        config(['queue.default' => 'database']);

        try {
            $this->post('/api/sheets/upload', [
                'applicant_id' => $applicant->id,
                'image' => UploadedFile::fake()->image('sheet.jpg', 1200, 1600),
            ])->assertAccepted();
        } finally {
            config(['queue.default' => $originalConnection]);
        }

        $this->assertDatabaseHas('jobs', ['queue' => 'omr']);
    }

    public function test_worker_calls_omr_and_atomically_persists_answers_and_result(): void
    {
        Storage::fake('public');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $key->items()
            ->where('section', 'inductive')
            ->where('item_number', 1)
            ->update(['points' => 2]);
        $applicant = $this->omrApplicant($staff, $key);
        Storage::disk('public')->put('answer_sheets/sheet.jpg', 'jpeg-bytes');
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/sheet.jpg',
            'storage_disk' => 'public',
            'image_hash' => hash('sha256', 'jpeg-bytes'),
        ]);
        $processingJob = OmrProcessingJob::create([
            'sheet_id' => $sheet->id,
            'user_id' => $staff->id,
            'status' => 'Queued',
            'queue_position' => 1,
        ]);
        Http::fake([
            '*/recognize' => Http::response($this->successfulOmrResponse($key)),
        ]);

        $this->app->call([new ProcessOmrSheet($processingJob->id), 'handle']);
        // A duplicate queue delivery is a no-op after the domain job commits.
        $this->app->call([new ProcessOmrSheet($processingJob->id), 'handle']);

        $this->assertDatabaseHas('tbl_omr_processing_jobs', [
            'id' => $processingJob->id,
            'status' => 'Completed',
        ]);
        $this->assertDatabaseHas('tbl_examination_results', [
            'applicant_id' => $applicant->id,
            'answer_key_id' => $key->id,
            'score' => 98.02,
            'earned_points' => 99,
            'total_points' => 101,
            'status' => 'Passed',
            'correct_count' => 98,
            'blank_count' => 1,
            'invalid_count' => 1,
            'low_confidence_count' => 1,
        ]);
        $this->assertDatabaseCount('tbl_applicant_answers', 100);
        $this->assertDatabaseHas('tbl_applicant_answers', [
            'sheet_id' => $sheet->id,
            'section' => 'inductive',
            'item_number' => 1,
            'recognition_status' => 'answered',
            'is_correct' => true,
        ]);
        $this->assertDatabaseHas('tbl_applicant_answers', [
            'sheet_id' => $sheet->id,
            'section' => 'inductive',
            'item_number' => 2,
            'marked_answer' => null,
            'recognition_status' => 'blank',
            'is_correct' => false,
        ]);
        $this->assertSame('Processed', $applicant->fresh()->status);
        $this->assertSame('tmc-bubble-cnn-three-class-v1', $sheet->fresh()->recognition_metadata['model']['model_id']);

        Sanctum::actingAs($staff);
        $this->getJson("/api/omr-jobs/{$processingJob->id}")
            ->assertOk()
            ->assertJsonPath('job.status', 'Completed')
            ->assertJsonPath('result.score', '98.02')
            ->assertJsonPath('result.blank_count', 1)
            ->assertJsonPath('result.invalid_count', 1);

        Http::assertSent(function (Request $request) use ($key) {
            $answerKeyPart = collect($request->data())->firstWhere('name', 'answer_key');

            return $request->url() === config('services.omr.url').'/recognize'
                && $request->hasFile('file', 'jpeg-bytes', 'sheet.jpg')
                && json_decode($answerKeyPart['contents'] ?? '', true)['answer_key_id'] === $key->id;
        });
        Http::assertSentCount(1);
    }

    public function test_capture_rejection_marks_domain_job_failed_without_partial_results(): void
    {
        Storage::fake('public');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Storage::disk('public')->put('answer_sheets/bad.jpg', 'bad-capture');
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/bad.jpg',
            'storage_disk' => 'public',
        ]);
        $processingJob = OmrProcessingJob::create([
            'sheet_id' => $sheet->id,
            'user_id' => $staff->id,
            'status' => 'Queued',
            'queue_position' => 1,
        ]);
        Http::fake(['*/recognize' => Http::response(['detail' => 'capture quality is too low'], 422)]);

        $this->app->call([new ProcessOmrSheet($processingJob->id), 'handle']);

        $this->assertDatabaseHas('tbl_omr_processing_jobs', [
            'id' => $processingJob->id,
            'status' => 'Failed',
            'error_message' => 'capture quality is too low',
        ]);
        $this->assertDatabaseCount('tbl_applicant_answers', 0);
        $this->assertDatabaseCount('tbl_examination_results', 0);
        $this->assertDatabaseHas('tbl_audit_logs', [
            'action' => 'OMR_PROCESSING_FAILED',
            'record_id' => $processingJob->id,
        ]);
        $this->assertSame('Pending', $applicant->fresh()->status);
    }

    public function test_transient_omr_failure_is_rethrown_for_queue_retry(): void
    {
        Storage::fake('public');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Storage::disk('public')->put('answer_sheets/sheet.jpg', 'jpeg-bytes');
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/sheet.jpg',
            'storage_disk' => 'public',
        ]);
        $processingJob = OmrProcessingJob::create([
            'sheet_id' => $sheet->id,
            'user_id' => $staff->id,
            'status' => 'Queued',
            'queue_position' => 1,
        ]);
        Http::fake(['*/recognize' => Http::response(['detail' => 'unavailable'], 503)]);

        try {
            $this->app->call([new ProcessOmrSheet($processingJob->id), 'handle']);
            $this->fail('Expected the HTTP server error to be rethrown.');
        } catch (RequestException) {
            // The real queue retries this job using its configured backoff.
        }

        $this->assertDatabaseHas('tbl_omr_processing_jobs', [
            'id' => $processingJob->id,
            'status' => 'Queued',
            'retry_count' => 1,
        ]);
    }

    public function test_inconsistent_omr_score_is_rejected_without_partial_persistence(): void
    {
        Storage::fake('public');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Storage::disk('public')->put('answer_sheets/sheet.jpg', 'jpeg-bytes');
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/sheet.jpg',
            'storage_disk' => 'public',
        ]);
        $processingJob = OmrProcessingJob::create([
            'sheet_id' => $sheet->id,
            'user_id' => $staff->id,
            'status' => 'Queued',
            'queue_position' => 1,
        ]);
        $response = $this->successfulOmrResponse($key);
        $response['scoring']['score'] = 100;
        Http::fake(['*/recognize' => Http::response($response)]);

        $this->app->call([new ProcessOmrSheet($processingJob->id), 'handle']);

        $this->assertDatabaseHas('tbl_omr_processing_jobs', [
            'id' => $processingJob->id,
            'status' => 'Failed',
            'error_message' => 'The OMR score is inconsistent.',
        ]);
        $this->assertDatabaseCount('tbl_applicant_answers', 0);
        $this->assertDatabaseCount('tbl_examination_results', 0);
    }

    public function test_failed_capture_can_be_replaced_with_a_new_queued_sheet(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        Queue::fake();
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Storage::disk('public')->put('answer_sheets/failed.jpg', 'old-image');
        $oldSheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/failed.jpg',
        ]);
        $oldJob = OmrProcessingJob::create([
            'sheet_id' => $oldSheet->id,
            'user_id' => $staff->id,
            'status' => 'Failed',
            'completed_at' => now(),
            'error_message' => 'capture quality is too low',
        ]);
        Sanctum::actingAs($staff);

        $response = $this->post('/api/sheets/upload', [
            'applicant_id' => $applicant->id,
            'image' => UploadedFile::fake()->image('recapture.jpg', 1200, 1600),
        ]);

        $response->assertAccepted()->assertJsonPath('job.status', 'Queued');
        $this->assertDatabaseMissing('tbl_answer_sheets', ['id' => $oldSheet->id]);
        $this->assertDatabaseMissing('tbl_omr_processing_jobs', ['id' => $oldJob->id]);
        Storage::disk('public')->assertMissing('answer_sheets/failed.jpg');
        Storage::disk('local')->assertExists($response->json('sheet.image_path'));
    }

    public function test_staff_can_only_poll_their_own_jobs_while_admin_can_poll_any_job(): void
    {
        $owner = $this->omrUser();
        $otherStaff = $this->omrUser();
        $admin = $this->omrUser('Administrator');
        $key = $this->completeAnswerKey($admin);
        $applicant = $this->omrApplicant($owner, $key);
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/sheet.jpg',
            'storage_disk' => 'public',
        ]);
        $processingJob = OmrProcessingJob::create([
            'sheet_id' => $sheet->id,
            'user_id' => $owner->id,
            'status' => 'Queued',
            'queue_position' => 1,
        ]);

        Sanctum::actingAs($otherStaff);
        $this->getJson("/api/omr-jobs/{$processingJob->id}")->assertForbidden();

        Sanctum::actingAs($owner);
        $this->getJson("/api/omr-jobs/{$processingJob->id}")
            ->assertOk()
            ->assertJsonPath('job.status', 'Queued');

        Sanctum::actingAs($admin);
        $this->getJson("/api/omr-jobs/{$processingJob->id}")
            ->assertOk()
            ->assertJsonPath('job.id', $processingJob->id);
    }
}
