<?php

namespace Tests\Feature;

use App\Jobs\ProcessOmrSheet;
use App\Models\AnswerSheet;
use App\Models\ExaminationApplicant;
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

    public function test_new_submission_atomically_creates_applicant_sheet_and_job(): void
    {
        Storage::fake('local');
        Queue::fake();
        $staff = $this->omrUser();
        $this->omrFolder($staff);
        $key = $this->completeAnswerKey($staff);
        Sanctum::actingAs($staff);

        $response = $this->post('/api/sheets/upload', [
            'submission_uuid' => 'd8bf7409-4b34-4459-a0c8-a37c6260a953',
            'applicant_name' => 'Dela Cruz, Juan A.',
            'examination_date' => '2026-11-04',
            'mobile_number' => '09123456789',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'image' => UploadedFile::fake()->image('sheet.jpg', 1200, 1600),
        ]);

        $response->assertAccepted()
            ->assertJsonPath('applicant.applicant_name', 'Dela Cruz, Juan A.')
            ->assertJsonPath('applicant.folder_id', null)
            ->assertJsonPath('applicant.answer_key_id', $key->id)
            ->assertJsonMissingPath('applicant.answer_key')
            ->assertJsonPath('job.status', 'Queued');
        $applicantId = $response->json('applicant.id');
        $this->assertDatabaseHas('tbl_examination_applicants', [
            'id' => $applicantId,
            'submission_uuid' => 'd8bf7409-4b34-4459-a0c8-a37c6260a953',
            'status' => 'Pending',
        ]);
        $created = ExaminationApplicant::findOrFail($applicantId);
        $this->assertNull($created->folder_id);
        $this->assertNull($created->filed_at);
        $this->assertDatabaseHas('tbl_answer_sheets', ['applicant_id' => $applicantId]);
        Queue::assertPushed(ProcessOmrSheet::class);
    }

    public function test_upload_does_not_require_an_active_folder(): void
    {
        Storage::fake('local');
        Queue::fake();
        $staff = $this->omrUser();
        $this->completeAnswerKey($staff);
        Sanctum::actingAs($staff);

        $response = $this->post('/api/sheets/upload', [
            'submission_uuid' => '2d5da86f-cb79-4d5e-9b66-e18a8abae146',
            'applicant_name' => 'Dela Cruz, Juan A.',
            'examination_date' => '2026-11-04',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'image' => UploadedFile::fake()->image('sheet.jpg', 1200, 1600),
        ]);

        $response->assertAccepted()
            ->assertJsonPath('applicant.folder_id', null)
            ->assertJsonPath('job.status', 'Queued');
        $this->assertDatabaseHas('tbl_examination_applicants', [
            'id' => $response->json('applicant.id'),
            'folder_id' => null,
        ]);
        Queue::assertPushed(ProcessOmrSheet::class);
    }

    public function test_repeated_submission_uuid_returns_existing_job_without_duplicate_applicant(): void
    {
        Storage::fake('local');
        Queue::fake();
        $staff = $this->omrUser();
        $this->omrFolder($staff);
        $this->completeAnswerKey($staff);
        Sanctum::actingAs($staff);
        $payload = [
            'submission_uuid' => '97bff253-fc4d-4f63-b91e-fe62ac129cd8',
            'applicant_name' => 'Dela Cruz, Juan A.',
            'examination_date' => '2026-11-04',
            'student_type' => 'NEW',
            'course' => 'BSIT',
        ];

        $first = $this->post('/api/sheets/upload', [
            ...$payload,
            'image' => UploadedFile::fake()->image('first.jpg', 1200, 1600),
        ])->assertAccepted();
        $second = $this->post('/api/sheets/upload', [
            ...$payload,
            'image' => UploadedFile::fake()->image('second.jpg', 1200, 1600),
        ])->assertAccepted();

        $this->assertSame($first->json('applicant.id'), $second->json('applicant.id'));
        $this->assertSame($first->json('job.id'), $second->json('job.id'));
        $this->assertDatabaseCount('tbl_examination_applicants', 1);
        $this->assertDatabaseCount('tbl_answer_sheets', 1);
        $this->assertDatabaseCount('tbl_omr_processing_jobs', 1);
        Queue::assertPushed(ProcessOmrSheet::class, 1);
    }

    public function test_staff_cannot_reuse_another_staffs_submission_uuid(): void
    {
        Storage::fake('local');
        Queue::fake();
        $owner = $this->omrUser();
        $otherStaff = $this->omrUser();
        $key = $this->completeAnswerKey($owner);
        $applicant = $this->omrApplicant($owner, $key);
        $applicant->update(['submission_uuid' => '3eab1ca7-d702-47b9-b49d-457e1604d149']);
        Sanctum::actingAs($otherStaff);

        $this->post('/api/sheets/upload', [
            'submission_uuid' => '3eab1ca7-d702-47b9-b49d-457e1604d149',
            'applicant_name' => 'Unauthorized Duplicate',
            'examination_date' => '2026-11-04',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'image' => UploadedFile::fake()->image('sheet.jpg', 1200, 1600),
        ])->assertForbidden();

        $this->assertDatabaseCount('tbl_examination_applicants', 1);
        $this->assertDatabaseCount('tbl_answer_sheets', 0);
        $this->assertDatabaseCount('tbl_omr_processing_jobs', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('answer_sheets'));
        Queue::assertNothingPushed();
    }

    public function test_invalid_image_does_not_create_an_applicant(): void
    {
        Storage::fake('local');
        Queue::fake();
        $staff = $this->omrUser();
        $this->omrFolder($staff);
        $this->completeAnswerKey($staff);
        Sanctum::actingAs($staff);

        $this->post('/api/sheets/upload', [
            'submission_uuid' => '6be96f3c-d0e7-4e70-91cb-38eea08f1391',
            'applicant_name' => 'Dela Cruz, Juan A.',
            'examination_date' => '2026-11-04',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'image' => UploadedFile::fake()->create('sheet.txt', 10, 'text/plain'),
        ])->assertUnprocessable();

        $this->assertDatabaseCount('tbl_examination_applicants', 0);
        $this->assertDatabaseCount('tbl_answer_sheets', 0);
        $this->assertDatabaseCount('tbl_omr_processing_jobs', 0);
        Queue::assertNothingPushed();
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

    public function test_staff_cannot_upload_for_another_staffs_existing_applicant(): void
    {
        Storage::fake('local');
        Queue::fake();
        $owner = $this->omrUser();
        $otherStaff = $this->omrUser();
        $key = $this->completeAnswerKey($owner);
        $applicant = $this->omrApplicant($owner, $key);
        Sanctum::actingAs($otherStaff);

        $this->post('/api/sheets/upload', [
            'applicant_id' => $applicant->id,
            'image' => UploadedFile::fake()->image('sheet.jpg', 1200, 1600),
        ])->assertForbidden();

        $this->assertDatabaseCount('tbl_answer_sheets', 0);
        $this->assertDatabaseCount('tbl_omr_processing_jobs', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('answer_sheets'));
        Queue::assertNothingPushed();
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
        $this->assertSame(195, $sheet->fresh()->recognition_metadata['capture_quality']['bright_pixel_percentile']);
        $this->assertSame(900, $sheet->fresh()->recognition_metadata['capture_quality']['focus_score']);

        Sanctum::actingAs($staff);
        $this->getJson("/api/omr-jobs/{$processingJob->id}")
            ->assertOk()
            ->assertJsonPath('job.status', 'Completed')
            ->assertJsonPath('result.score', '98.02')
            ->assertJsonPath('result.blank_count', 1)
            ->assertJsonPath('result.invalid_count', 1);

        Http::assertSent(function (Request $request) use ($key, $processingJob) {
            $answerKeyPart = collect($request->data())->firstWhere('name', 'answer_key');
            $requestIdPart = collect($request->data())->firstWhere('name', 'request_id');

            return $request->url() === config('services.omr.url').'/recognize'
                && $request->hasFile('file', 'jpeg-bytes', 'sheet.jpg')
                && json_decode($answerKeyPart['contents'] ?? '', true)['answer_key_id'] === $key->id
                && ($requestIdPart['contents'] ?? null) === "job-{$processingJob->id}";
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
