<?php

namespace Tests\Feature;

use App\Models\ExaminationApplicant;
use App\Models\ExaminationFolder;
use App\Models\ExaminationResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\CreatesOmrFixtures;
use Tests\TestCase;

class ResultFilingTest extends TestCase
{
    use CreatesOmrFixtures;
    use RefreshDatabase;

    public function test_staff_can_only_list_active_folders_while_admin_can_filter_all(): void
    {
        $admin = $this->omrUser('Administrator');
        $staff = $this->omrUser();
        $active = $this->folder($admin, 'Active', 'SY 2026-2027');
        $archived = $this->folder($admin, 'Archived', 'SY 2025-2026');

        Sanctum::actingAs($staff);
        $this->getJson('/api/folders?status=Archived')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $active->id)
            ->assertJsonPath('0.status', 'Active');
        $this->assertNotSame($active->id, $archived->id);

        Sanctum::actingAs($admin);
        $this->getJson('/api/folders?status=Archived')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $archived->id)
            ->assertJsonPath('0.status', 'Archived');
    }

    public function test_result_only_appears_in_a_folder_after_staff_saves_it(): void
    {
        $admin = $this->omrUser('Administrator');
        $staff = $this->omrUser();
        $folder = $this->folder($admin);
        [$applicant, $result] = $this->unfiledResult($staff);

        Sanctum::actingAs($admin);
        $this->getJson("/api/results?folder_id={$folder->id}")
            ->assertOk()
            ->assertJsonCount(0);

        Sanctum::actingAs($staff);
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $folder->id])
            ->assertOk()
            ->assertJsonPath('message', 'Successfully Saved To Admin Portal')
            ->assertJsonPath('applicant.folder_id', $folder->id)
            ->assertJsonPath('applicant.folder.school_year', 'SY 2026-2027');

        $applicant->refresh();
        $this->assertSame($folder->id, $applicant->folder_id);
        $this->assertSame($staff->id, $applicant->filed_by);
        $this->assertNotNull($applicant->filed_at);
        $this->assertDatabaseHas('tbl_audit_logs', [
            'user_id' => $staff->id,
            'action' => 'FILE_RESULT',
            'table_name' => 'tbl_examination_results',
            'record_id' => $result->id,
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/results?folder_id={$folder->id}")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $result->id)
            ->assertJsonPath('0.applicant.id', $applicant->id);
    }

    public function test_saving_the_same_folder_twice_is_idempotent_but_another_folder_is_rejected(): void
    {
        $admin = $this->omrUser('Administrator');
        $staff = $this->omrUser();
        $first = $this->folder($admin, 'Active', 'SY 2026-2027');
        $second = $this->folder($admin, 'Active', 'SY 2027-2028');
        [$applicant, $result] = $this->unfiledResult($staff);

        Sanctum::actingAs($staff);
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $first->id])
            ->assertOk();
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $first->id])
            ->assertOk()
            ->assertJsonPath('message', 'Successfully Saved To Admin Portal');
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $second->id])
            ->assertStatus(409);

        $this->assertSame($first->id, $applicant->fresh()->folder_id);
        $this->assertDatabaseCount('tbl_audit_logs', 1);
    }

    public function test_archived_folders_cannot_receive_results(): void
    {
        $admin = $this->omrUser('Administrator');
        $staff = $this->omrUser();
        $archived = $this->folder($admin, 'Archived', 'SY 2025-2026');
        [$applicant, $result] = $this->unfiledResult($staff);

        Sanctum::actingAs($staff);
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $archived->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('folder_id');

        $this->assertNull($applicant->fresh()->folder_id);
        $this->assertNull($applicant->fresh()->filed_at);
    }

    public function test_staff_cannot_file_another_staffs_result(): void
    {
        $admin = $this->omrUser('Administrator');
        $owner = $this->omrUser();
        $otherStaff = $this->omrUser();
        $folder = $this->folder($admin);
        [, $result] = $this->unfiledResult($owner);

        Sanctum::actingAs($otherStaff);
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $folder->id])
            ->assertForbidden();

        Sanctum::actingAs($admin);
        $this->postJson("/api/results/{$result->id}/file", ['folder_id' => $folder->id])
            ->assertOk();
    }

    private function folder(User $creator, string $status = 'Active', string $schoolYear = 'SY 2026-2027'): ExaminationFolder
    {
        return ExaminationFolder::create([
            'course' => '',
            'school_year' => $schoolYear,
            'status' => $status,
            'created_by' => $creator->id,
        ]);
    }

    /** @return array{0: ExaminationApplicant, 1: ExaminationResult} */
    private function unfiledResult(User $creator): array
    {
        $key = $this->completeAnswerKey($creator);
        $applicant = ExaminationApplicant::create([
            'folder_id' => null,
            'answer_key_id' => $key->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-11-04',
            'status' => 'Processed',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'created_by' => $creator->id,
        ]);
        $result = ExaminationResult::create([
            'applicant_id' => $applicant->id,
            'answer_key_id' => $key->id,
            'score' => 98.02,
            'status' => 'Passed',
            'total_items' => 100,
            'correct_count' => 98,
            'incorrect_count' => 2,
            'passing_score' => 75,
            'computed_by' => $creator->id,
            'computed_at' => now(),
        ]);

        return [$applicant, $result];
    }
}
