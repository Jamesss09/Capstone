<?php

namespace Tests\Feature;

use App\Models\AnswerKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\CreatesOmrFixtures;
use Tests\TestCase;

class ActiveAnswerKeyFlowTest extends TestCase
{
    use CreatesOmrFixtures;
    use RefreshDatabase;

    public function test_applicant_is_automatically_bound_to_the_single_active_key(): void
    {
        $admin = $this->omrUser('Administrator');
        $activeKey = $this->completeAnswerKey($admin);
        $folder = $this->omrFolder($admin);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/applicants', [
            'folder_id' => $folder->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'student_type' => 'NEW',
            'course' => 'BSIT',
        ]);

        $response->assertCreated()
            ->assertJsonPath('answer_key_id', $activeKey->id)
            ->assertJsonPath('status', 'Pending');
    }

    public function test_staff_cannot_use_the_administrative_applicant_creation_endpoint(): void
    {
        $staff = $this->omrUser('Staff');
        $this->completeAnswerKey($staff);
        $this->omrFolder($staff);
        Sanctum::actingAs($staff);

        $this->postJson('/api/applicants', [
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'mobile_number' => '+639171234567',
            'student_type' => 'NEW',
            'course' => 'BSIT',
        ])->assertForbidden();

        $this->assertDatabaseCount('tbl_examination_applicants', 0);
    }

    public function test_staff_cannot_choose_an_answer_key_or_processing_status(): void
    {
        $admin = $this->omrUser('Administrator');
        $key = $this->completeAnswerKey($admin);
        $folder = $this->omrFolder($admin);
        Sanctum::actingAs($admin);

        $this->postJson('/api/applicants', [
            'folder_id' => $folder->id,
            'answer_key_id' => $key->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'status' => 'Processed',
            'course' => 'BSIT',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['answer_key_id', 'status']);
    }

    public function test_identification_fails_when_no_complete_active_key_exists(): void
    {
        $admin = $this->omrUser('Administrator');
        $folder = $this->omrFolder($admin);
        Sanctum::actingAs($admin);

        $payload = [
            'folder_id' => $folder->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'course' => 'BSIT',
        ];

        $this->postJson('/api/applicants', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('answer_key');

        AnswerKey::create([
            'exam_title' => 'Incomplete Key',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'status' => 'Active',
            'created_by' => $admin->id,
        ]);

        $this->postJson('/api/applicants', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('answer_key');
    }

    public function test_identification_rejects_ambiguous_active_keys(): void
    {
        $admin = $this->omrUser('Administrator');
        $this->completeAnswerKey($admin, 'Active');
        $this->completeAnswerKey($admin, 'Active');
        $folder = $this->omrFolder($admin);
        Sanctum::actingAs($admin);

        $this->postJson('/api/applicants', [
            'folder_id' => $folder->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'course' => 'BSIT',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('answer_key');
    }

    public function test_activation_requires_a_complete_key_and_keeps_only_one_active(): void
    {
        $admin = $this->omrUser('Administrator');
        $first = $this->completeAnswerKey($admin, 'Active');
        $second = $this->completeAnswerKey($admin, 'Inactive');
        $incomplete = AnswerKey::create([
            'exam_title' => 'Incomplete Key',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'status' => 'Inactive',
            'created_by' => $admin->id,
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/answer-keys/{$incomplete->id}/activate")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $this->postJson("/api/answer-keys/{$second->id}/activate")
            ->assertOk()
            ->assertJsonPath('status', 'Active');

        $this->assertDatabaseHas('tbl_answer_keys', ['id' => $first->id, 'status' => 'Inactive']);
        $this->assertDatabaseHas('tbl_answer_keys', ['id' => $second->id, 'status' => 'Active']);
        $this->assertSame(1, AnswerKey::where('status', 'Active')->count());
    }

    public function test_key_content_is_immutable_after_assignment(): void
    {
        $admin = $this->omrUser('Administrator');
        $key = $this->completeAnswerKey($admin);
        $this->omrApplicant($admin, $key);
        Sanctum::actingAs($admin);

        $this->putJson("/api/answer-keys/{$key->id}", ['passing_score' => 80])
            ->assertStatus(409);
        $this->putJson("/api/answer-keys/{$key->id}/items", [
            'items' => [[
                'section' => 'inductive',
                'item_number' => 1,
                'correct_answer' => 'A',
            ]],
        ])
            ->assertStatus(409);
        $this->deleteJson("/api/answer-keys/{$key->id}")
            ->assertStatus(409);
    }

    public function test_new_answer_keys_start_inactive_until_admin_activates_them(): void
    {
        $admin = $this->omrUser('Administrator');
        Sanctum::actingAs($admin);

        $this->postJson('/api/answer-keys', [
            'exam_title' => 'Draft Key',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
        ])->assertCreated()->assertJsonPath('status', 'Inactive');
    }
}
