<?php

namespace Tests\Support;

use App\Models\AnswerKey;
use App\Models\ExaminationApplicant;
use App\Models\ExaminationFolder;
use App\Models\User;

trait CreatesOmrFixtures
{
    private static int $fixtureSequence = 0;

    protected function omrUser(string $role = 'Staff'): User
    {
        self::$fixtureSequence++;

        return User::create([
            'username' => strtolower($role).'-omr-'.self::$fixtureSequence,
            'email' => strtolower($role).'-omr-'.self::$fixtureSequence.'@example.com',
            'password_hash' => bcrypt('password'),
            'full_name' => "{$role} OMR Test",
            'role' => $role,
            'is_active' => true,
        ]);
    }

    protected function omrFolder(User $creator): ExaminationFolder
    {
        return ExaminationFolder::create([
            'course' => '',
            'school_year' => 'SY 2026-2027',
            'status' => 'Active',
            'created_by' => $creator->id,
        ]);
    }

    protected function completeAnswerKey(User $creator, string $status = 'Active'): AnswerKey
    {
        $key = AnswerKey::create([
            'exam_title' => 'TMC Entrance Examination',
            'passing_score' => 75,
            'school_year' => 'SY 2026-2027',
            'status' => $status,
            'created_by' => $creator->id,
        ]);

        foreach (config('omr_sections.sections') as $sectionId => $section) {
            for ($itemNumber = 1; $itemNumber <= $section['items']; $itemNumber++) {
                $key->items()->create([
                    'section' => $sectionId,
                    'item_number' => $itemNumber,
                    'correct_answer' => 'A',
                    'points' => 1,
                ]);
            }
        }

        return $key;
    }

    protected function omrApplicant(User $creator, AnswerKey $key): ExaminationApplicant
    {
        return ExaminationApplicant::create([
            'folder_id' => $this->omrFolder($creator)->id,
            'answer_key_id' => $key->id,
            'applicant_name' => 'Dela Cruz, Maria A.',
            'examination_date' => '2026-08-24',
            'status' => 'Pending',
            'student_type' => 'NEW',
            'course' => 'BSIT',
            'created_by' => $creator->id,
        ]);
    }

    /** @return array<string, mixed> */
    protected function successfulOmrResponse(AnswerKey $key): array
    {
        $key->load('items');
        $keyItems = $key->items->keyBy(
            fn ($item) => "{$item->section}:{$item->item_number}"
        );
        $recognized = [];
        $scored = [];
        $index = 0;
        $earnedPoints = 0.0;
        $totalPoints = 0.0;

        foreach (config('omr_sections.sections') as $sectionId => $section) {
            for ($itemNumber = 1; $itemNumber <= $section['items']; $itemNumber++) {
                $index++;
                $status = $index === 2 ? 'blank' : ($index === 3 ? 'invalid' : 'answered');
                $marked = $status === 'answered' ? 'A' : null;
                $flags = $index === 1
                    ? ['low_confidence']
                    : ($index === 3 ? ['multi_shade'] : []);
                $isCorrect = $status === 'answered';
                $pointsPossible = (float) $keyItems["{$sectionId}:{$itemNumber}"]->points;
                $pointsAwarded = $isCorrect ? $pointsPossible : 0.0;
                $earnedPoints += $pointsAwarded;
                $totalPoints += $pointsPossible;

                $recognized[] = [
                    'section' => $sectionId,
                    'item_number' => $itemNumber,
                    'status' => $status,
                    'marked_answer' => $marked,
                    'flags' => $flags,
                    'confidence' => $index === 1 ? 0.70 : 0.99,
                ];
                $scored[] = [
                    'section' => $sectionId,
                    'item_number' => $itemNumber,
                    'marked_answer' => $marked,
                    'recognition_status' => $status,
                    'flags' => $flags,
                    'is_correct' => $isCorrect,
                    'points_awarded' => $pointsAwarded,
                    'points_possible' => $pointsPossible,
                ];
            }
        }

        $percentage = round(($earnedPoints / $totalPoints) * 100, 2);

        return [
            'filename' => 'sheet.jpg',
            'size_bytes' => 12345,
            'status' => 'scored',
            'template_id' => 'tmc-v1',
            'model' => [
                'model_id' => 'tmc-bubble-cnn-three-class-v1',
                'checkpoint_sha256' => str_repeat('a', 64),
            ],
            'capture_quality' => [
                'bright_pixel_percentile' => 195.0,
                'focus_score' => 900.0,
            ],
            'registration' => ['method' => 'sift', 'matches' => 700, 'inliers' => 160],
            'lattice' => ['quality' => 'good', 'matched_rows' => 100],
            'warnings' => [],
            'low_confidence_threshold' => 0.8,
            'erasure_threshold' => 0.8,
            'bubble_count' => 410,
            'item_count' => 100,
            'summary' => [
                'answered' => 98,
                'blank' => 1,
                'invalid' => 1,
                'multi_shade' => 1,
                'erasure' => 0,
                'low_confidence' => 1,
            ],
            'items' => $recognized,
            'scoring' => [
                'answer_key_id' => $key->id,
                'exam_title' => $key->exam_title,
                'score' => $percentage,
                'score_percentage' => $percentage,
                'earned_points' => $earnedPoints,
                'total_points' => $totalPoints,
                'passing_score' => (float) $key->passing_score,
                'status' => $percentage >= (float) $key->passing_score ? 'Passed' : 'Failed',
                'total_items' => 100,
                'correct_count' => 98,
                'incorrect_count' => 2,
                'answered_count' => 98,
                'blank_count' => 1,
                'invalid_count' => 1,
                'low_confidence_count' => 1,
                'items' => $scored,
            ],
            'timing_ms' => ['total' => 4500.0],
        ];
    }
}
