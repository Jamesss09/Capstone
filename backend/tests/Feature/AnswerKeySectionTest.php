<?php

namespace Tests\Feature;

use App\Models\AnswerKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AnswerKeySectionTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create([
            'username' => 'section-admin',
            'email' => 'section-admin@example.com',
            'password_hash' => bcrypt('password'),
            'full_name' => 'Section Admin',
            'role' => 'Administrator',
            'is_active' => true,
        ]);
    }

    public function test_creating_a_key_normalizes_display_names_to_canonical_section_ids(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/answer-keys', [
            'exam_title' => 'TMC Entrance Exam',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'items' => [
                ['section' => 'Inductive / Logical Test', 'item_number' => 1, 'correct_answer' => 'E'],
                ['section' => 'Mathematics', 'item_number' => 30, 'correct_answer' => 'D'],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('tbl_answer_key_items', [
            'section' => 'inductive',
            'item_number' => 1,
            'correct_answer' => 'E',
        ]);
        $this->assertDatabaseHas('tbl_answer_key_items', [
            'section' => 'math',
            'item_number' => 30,
            'correct_answer' => 'D',
        ]);
    }

    public function test_replacing_items_normalizes_aliases_and_rejects_invalid_options(): void
    {
        $admin = $this->admin();
        $key = AnswerKey::create([
            'exam_title' => 'TMC Entrance Exam',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'status' => 'Active',
            'created_by' => $admin->id,
        ]);
        Sanctum::actingAs($admin);

        $this->putJson("/api/answer-keys/{$key->id}/items", [
            'items' => [
                ['section' => 'Science and Technology', 'item_number' => 20, 'correct_answer' => 'D'],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('tbl_answer_key_items', [
            'answer_key_id' => $key->id,
            'section' => 'science',
            'item_number' => 20,
            'correct_answer' => 'D',
        ]);

        $this->putJson("/api/answer-keys/{$key->id}/items", [
            'items' => [
                ['section' => 'math', 'item_number' => 1, 'correct_answer' => 'E'],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.correct_answer');
    }

    public function test_unknown_sections_and_out_of_range_items_are_rejected(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/answer-keys', [
            'exam_title' => 'TMC Entrance Exam',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'items' => [
                ['section' => 'General Knowledge', 'item_number' => 1, 'correct_answer' => 'A'],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.section');

        $this->postJson('/api/answer-keys', [
            'exam_title' => 'TMC Entrance Exam',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'items' => [
                ['section' => 'aptitude', 'item_number' => 11, 'correct_answer' => 'A'],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.item_number');
    }
}
