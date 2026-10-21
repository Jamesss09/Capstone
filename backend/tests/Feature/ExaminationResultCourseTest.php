<?php

namespace Tests\Feature;

use App\Models\AnswerKey;
use App\Models\ExaminationApplicant;
use App\Models\ExaminationFolder;
use App\Models\ExaminationResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExaminationResultCourseTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create([
            'username' => 'admin-test',
            'email' => 'admin-test@example.com',
            'password_hash' => bcrypt('password'),
            'full_name' => 'Test Admin',
            'role' => 'Administrator',
            'is_active' => true,
        ]);
    }

    private function folder(User $admin): ExaminationFolder
    {
        return ExaminationFolder::create([
            'course' => '',
            'school_year' => 'SY 2026-2027',
            'status' => 'Active',
            'created_by' => $admin->id,
        ]);
    }

    private function answerKey(User $admin): AnswerKey
    {
        return AnswerKey::create([
            'exam_title' => 'TMC Entrance Exam',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'status' => 'Active',
            'created_by' => $admin->id,
        ]);
    }

    public function test_identifying_an_applicant_requires_and_stores_the_course(): void
    {
        $admin = $this->admin();
        $folder = $this->folder($admin);
        $key = $this->answerKey($admin);
        Sanctum::actingAs($admin);

        $payload = [
            'folder_id' => $folder->id,
            'answer_key_id' => $key->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'student_type' => 'NEW',
            'course' => 'BSIT',
        ];

        $this->postJson('/api/applicants', $payload)
            ->assertCreated()
            ->assertJsonPath('course', 'BSIT')
            ->assertJsonPath('student_type', 'NEW');

        $this->assertDatabaseHas('tbl_examination_applicants', [
            'applicant_name' => 'Dela Cruz, Maria A.',
            'course' => 'BSIT',
            'student_type' => 'NEW',
        ]);

        $this->postJson('/api/applicants', array_merge($payload, ['course' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('course');
    }

    public function test_results_snapshot_the_applicants_course_and_can_be_filtered(): void
    {
        $admin = $this->admin();
        $folder = $this->folder($admin);
        $key = $this->answerKey($admin);

        $applicant = ExaminationApplicant::create([
            'folder_id' => $folder->id,
            'answer_key_id' => $key->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'created_by' => $admin->id,
        ]);

        // No course passed here: the model snapshots it from the applicant.
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

        $this->assertSame('BSIT', $result->course);

        Sanctum::actingAs($admin);

        $this->getJson("/api/results?folder_id={$folder->id}&course=BSIT")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.course', 'BSIT')
            ->assertJsonPath('0.applicant.course', 'BSIT');

        $this->getJson("/api/results?folder_id={$folder->id}&course=BEED")
            ->assertOk()
            ->assertJsonCount(0);
    }
}
