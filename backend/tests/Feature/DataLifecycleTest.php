<?php

namespace Tests\Feature;

use App\Models\AnswerSheet;
use App\Models\AuditLog;
use App\Models\ExaminationResult;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\CreatesOmrFixtures;
use Tests\TestCase;

class DataLifecycleTest extends TestCase
{
    use CreatesOmrFixtures;
    use RefreshDatabase;

    public function test_deleting_an_applicant_removes_private_images_and_cascaded_records(): void
    {
        Storage::fake('local');
        $admin = $this->omrUser('Administrator');
        $key = $this->completeAnswerKey($admin);
        $applicant = $this->omrApplicant($admin, $key);
        Storage::disk('local')->put('answer_sheets/private-sheet.jpg', 'image-bytes');
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/private-sheet.jpg',
            'storage_disk' => 'local',
            'image_hash' => hash('sha256', 'image-bytes'),
        ]);
        $sheet->answers()->create([
            'section' => 'inductive',
            'item_number' => 1,
            'marked_answer' => 'A',
            'recognition_status' => 'answered',
            'confidence' => 0.99,
            'flags' => [],
            'is_correct' => true,
            'points_awarded' => 1,
            'points_possible' => 1,
        ]);
        $sheet->processingJobs()->create([
            'user_id' => $admin->id,
            'status' => 'Completed',
        ]);
        $this->resultFor($applicant->id, $key->id, $admin->id);
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/applicants/{$applicant->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Applicant deleted.');

        Storage::disk('local')->assertMissing('answer_sheets/private-sheet.jpg');
        $this->assertDatabaseMissing('tbl_examination_applicants', ['id' => $applicant->id]);
        $this->assertDatabaseMissing('tbl_answer_sheets', ['id' => $sheet->id]);
        $this->assertDatabaseCount('tbl_applicant_answers', 0);
        $this->assertDatabaseCount('tbl_omr_processing_jobs', 0);
        $this->assertDatabaseCount('tbl_examination_results', 0);
        $this->assertDatabaseHas('tbl_audit_logs', [
            'action' => 'DELETE_APPLICANT',
            'record_id' => $applicant->id,
        ]);
    }

    public function test_deactivation_revokes_tokens_and_preserves_historical_user_references(): void
    {
        $admin = $this->omrUser('Administrator');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($admin);
        $applicant = $this->omrApplicant($staff, $key);
        $staff->createToken('access', ['access'], now()->addMinutes(15));
        $staff->createToken('refresh', ['refresh'], now()->addDays(7));
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$staff->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('is_active', false);

        $this->assertFalse($staff->fresh()->is_active);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('tbl_examination_applicants', [
            'id' => $applicant->id,
            'created_by' => $staff->id,
        ]);
        $this->assertDatabaseHas('tbl_examination_folders', ['created_by' => $staff->id]);
        $this->assertDatabaseHas('tbl_audit_logs', [
            'action' => 'DEACTIVATE_USER',
            'record_id' => $staff->id,
        ]);
    }

    public function test_inactive_user_is_rejected_and_any_remaining_tokens_are_revoked(): void
    {
        $staff = $this->omrUser();
        $token = $staff->createToken('access', ['access'], now()->addMinutes(15))->plainTextToken;
        $staff->update(['is_active' => false]);

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Account is deactivated.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_administrator_can_delete_another_user_without_deleting_historical_records(): void
    {
        $admin = $this->omrUser('Administrator');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        $applicant->update(['filed_by' => $staff->id, 'filed_at' => now()]);
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/history.jpg',
            'storage_disk' => 'local',
            'processed_at' => now(),
        ]);
        $job = $sheet->processingJobs()->create([
            'user_id' => $staff->id,
            'status' => 'Completed',
        ]);
        $result = $this->resultFor($applicant->id, $key->id, $staff->id);
        $staffLog = AuditLog::create([
            'user_id' => $staff->id,
            'action' => 'LOGIN',
        ]);
        $setting = Setting::create([
            'setting_key' => 'lifecycle-test',
            'setting_value' => 'enabled',
            'updated_by' => $staff->id,
        ]);
        $staff->createToken('access', ['access'], now()->addMinutes(15));
        $staff->createToken('refresh', ['refresh'], now()->addDays(7));
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/users/{$staff->id}")
            ->assertOk()
            ->assertJsonPath('message', 'User deleted. Historical examination records were preserved.');

        $this->assertDatabaseMissing('tbl_users', ['id' => $staff->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('tbl_answer_keys', ['id' => $key->id, 'created_by' => null]);
        $this->assertDatabaseHas('tbl_examination_folders', [
            'id' => $applicant->folder_id,
            'created_by' => null,
        ]);
        $this->assertDatabaseHas('tbl_examination_applicants', [
            'id' => $applicant->id,
            'created_by' => null,
            'filed_by' => null,
        ]);
        $this->assertDatabaseHas('tbl_omr_processing_jobs', ['id' => $job->id, 'user_id' => null]);
        $this->assertDatabaseHas('tbl_examination_results', ['id' => $result->id, 'computed_by' => null]);
        $this->assertDatabaseHas('tbl_audit_logs', ['id' => $staffLog->id, 'user_id' => null]);
        $this->assertDatabaseHas('tbl_settings', ['id' => $setting->id, 'updated_by' => null]);
        $this->assertDatabaseHas('tbl_audit_logs', [
            'user_id' => $admin->id,
            'action' => 'DELETE_USER',
            'record_id' => $staff->id,
        ]);
    }

    public function test_administrator_cannot_deactivate_demote_or_delete_their_own_account(): void
    {
        $admin = $this->omrUser('Administrator');
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$admin->id}", ['is_active' => false])
            ->assertUnprocessable();
        $this->putJson("/api/users/{$admin->id}", ['role' => 'Staff'])
            ->assertUnprocessable();
        $this->deleteJson("/api/users/{$admin->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You cannot delete your own account.');

        $admin->refresh();
        $this->assertTrue($admin->is_active);
        $this->assertSame('Administrator', $admin->role);
    }

    public function test_retention_cleanup_deletes_only_expired_successful_source_images(): void
    {
        Storage::fake('local');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);

        $expiredApplicant = $this->omrApplicant($staff, $key);
        Storage::disk('local')->put('answer_sheets/expired.jpg', 'expired-image');
        $expiredSheet = AnswerSheet::create([
            'applicant_id' => $expiredApplicant->id,
            'image_path' => 'answer_sheets/expired.jpg',
            'storage_disk' => 'local',
            'image_hash' => hash('sha256', 'expired-image'),
            'processed_at' => now()->subDays(366),
            'recognition_metadata' => ['warnings' => [], 'capture_quality' => ['focus_score' => 900]],
        ]);
        $expiredSheet->answers()->create([
            'section' => 'inductive',
            'item_number' => 1,
            'marked_answer' => 'A',
            'recognition_status' => 'answered',
            'confidence' => 0.99,
            'flags' => [],
            'is_correct' => true,
            'points_awarded' => 1,
            'points_possible' => 1,
        ]);
        $result = $this->resultFor($expiredApplicant->id, $key->id, $staff->id);

        $recentApplicant = $this->omrApplicant($staff, $key);
        Storage::disk('local')->put('answer_sheets/recent.jpg', 'recent-image');
        $recentSheet = AnswerSheet::create([
            'applicant_id' => $recentApplicant->id,
            'image_path' => 'answer_sheets/recent.jpg',
            'storage_disk' => 'local',
            'processed_at' => now()->subDays(30),
        ]);
        $this->resultFor($recentApplicant->id, $key->id, $staff->id);

        $pendingApplicant = $this->omrApplicant($staff, $key);
        Storage::disk('local')->put('answer_sheets/pending.jpg', 'pending-image');
        $pendingSheet = AnswerSheet::create([
            'applicant_id' => $pendingApplicant->id,
            'image_path' => 'answer_sheets/pending.jpg',
            'storage_disk' => 'local',
            'processed_at' => null,
        ]);

        $this->artisan('answer-sheets:prune-images')->assertSuccessful();

        Storage::disk('local')->assertMissing('answer_sheets/expired.jpg');
        Storage::disk('local')->assertExists('answer_sheets/recent.jpg');
        Storage::disk('local')->assertExists('answer_sheets/pending.jpg');
        $expiredSheet->refresh();
        $this->assertNull($expiredSheet->image_path);
        $this->assertNull($expiredSheet->image_hash);
        $this->assertNotNull($expiredSheet->image_deleted_at);
        $this->assertSame(['warnings' => [], 'capture_quality' => ['focus_score' => 900]], $expiredSheet->recognition_metadata);
        $this->assertDatabaseHas('tbl_applicant_answers', ['sheet_id' => $expiredSheet->id]);
        $this->assertDatabaseHas('tbl_examination_results', ['id' => $result->id]);
        $this->assertDatabaseHas('tbl_answer_sheets', [
            'id' => $recentSheet->id,
            'image_path' => 'answer_sheets/recent.jpg',
        ]);
        $this->assertDatabaseHas('tbl_answer_sheets', [
            'id' => $pendingSheet->id,
            'image_path' => 'answer_sheets/pending.jpg',
        ]);
        $this->assertDatabaseHas('tbl_audit_logs', [
            'action' => 'PRUNE_ANSWER_SHEET_IMAGE',
            'record_id' => $expiredSheet->id,
        ]);
    }

    public function test_retention_dry_run_does_not_delete_or_modify_images(): void
    {
        Storage::fake('local');
        $staff = $this->omrUser();
        $key = $this->completeAnswerKey($staff);
        $applicant = $this->omrApplicant($staff, $key);
        Storage::disk('local')->put('answer_sheets/dry-run.jpg', 'image');
        $sheet = AnswerSheet::create([
            'applicant_id' => $applicant->id,
            'image_path' => 'answer_sheets/dry-run.jpg',
            'storage_disk' => 'local',
            'processed_at' => now()->subDays(366),
        ]);
        $this->resultFor($applicant->id, $key->id, $staff->id);

        $this->artisan('answer-sheets:prune-images --dry-run')
            ->expectsOutput('1 answer-sheet image(s) are eligible for deletion.')
            ->assertSuccessful();

        Storage::disk('local')->assertExists('answer_sheets/dry-run.jpg');
        $this->assertSame('answer_sheets/dry-run.jpg', $sheet->fresh()->image_path);
        $this->assertDatabaseMissing('tbl_audit_logs', ['action' => 'PRUNE_ANSWER_SHEET_IMAGE']);
    }

    private function resultFor(int $applicantId, int $answerKeyId, int $userId): ExaminationResult
    {
        return ExaminationResult::create([
            'applicant_id' => $applicantId,
            'answer_key_id' => $answerKeyId,
            'score' => 80,
            'status' => 'Passed',
            'total_items' => 100,
            'correct_count' => 80,
            'incorrect_count' => 20,
            'passing_score' => 75,
            'computed_by' => $userId,
            'computed_at' => now(),
        ]);
    }
}
