<?php

namespace Tests\Feature;

use App\Models\ExaminationResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\CreatesOmrFixtures;
use Tests\TestCase;

class AdministrativeRecordAuthorizationTest extends TestCase
{
    use CreatesOmrFixtures;
    use RefreshDatabase;

    public function test_staff_cannot_access_applicant_or_result_administration_routes(): void
    {
        $owner = $this->omrUser();
        $otherStaff = $this->omrUser();
        $key = $this->completeAnswerKey($owner);
        $applicant = $this->omrApplicant($owner, $key);
        $result = ExaminationResult::create([
            'applicant_id' => $applicant->id,
            'answer_key_id' => $key->id,
            'score' => 80,
            'status' => 'Passed',
            'total_items' => 100,
            'correct_count' => 80,
            'incorrect_count' => 20,
            'passing_score' => 75,
            'computed_by' => $owner->id,
            'computed_at' => now(),
        ]);

        Sanctum::actingAs($otherStaff);

        $this->getJson('/api/applicants')->assertForbidden();
        $this->postJson('/api/applicants', [])->assertForbidden();
        $this->getJson("/api/applicants/{$applicant->id}")->assertForbidden();
        $this->putJson("/api/applicants/{$applicant->id}", [
            'applicant_name' => 'Unauthorized Change',
        ])->assertForbidden();
        $this->deleteJson("/api/applicants/{$applicant->id}")->assertForbidden();
        $this->getJson('/api/results')->assertForbidden();
        $this->getJson("/api/results/{$result->id}")->assertForbidden();

        $this->assertSame('Dela Cruz, Maria A.', $applicant->fresh()->applicant_name);
        $this->assertDatabaseHas('tbl_examination_results', ['id' => $result->id]);
    }

    public function test_administrator_retains_access_to_applicant_and_result_records(): void
    {
        $admin = $this->omrUser('Administrator');
        $key = $this->completeAnswerKey($admin);
        $applicant = $this->omrApplicant($admin, $key);
        $result = ExaminationResult::create([
            'applicant_id' => $applicant->id,
            'answer_key_id' => $key->id,
            'score' => 80,
            'status' => 'Passed',
            'total_items' => 100,
            'correct_count' => 80,
            'incorrect_count' => 20,
            'passing_score' => 75,
            'computed_by' => $admin->id,
            'computed_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/applicants')->assertOk()->assertJsonCount(1);
        $this->getJson("/api/applicants/{$applicant->id}")
            ->assertOk()
            ->assertJsonPath('id', $applicant->id);
        $this->getJson('/api/results')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.answer_key.exam_title', 'TMC Entrance Examination');
        $this->getJson("/api/results/{$result->id}")
            ->assertOk()
            ->assertJsonPath('id', $result->id)
            ->assertJsonPath('answer_key.exam_title', 'TMC Entrance Examination');
    }
}
