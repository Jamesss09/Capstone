<?php

namespace App\Services\Omr;

use App\Models\AnswerKey;
use DomainException;

class AnswerKeyPayloadFactory
{
    /**
     * Validate a complete canonical key and serialize it for the Python service.
     *
     * @return array<string, mixed>
     */
    public function make(AnswerKey $answerKey): array
    {
        $answerKey->loadMissing('items');
        $sections = config('omr_sections.sections');
        $indexed = [];

        foreach ($answerKey->items as $item) {
            $section = $sections[$item->section] ?? null;
            $itemNumber = (int) $item->item_number;
            $answer = strtoupper((string) $item->correct_answer);

            if ($section === null || $itemNumber < 1 || $itemNumber > $section['items']) {
                throw new DomainException('The active answer key contains an invalid section or item number.');
            }

            $allowedAnswers = array_slice(['A', 'B', 'C', 'D', 'E'], 0, $section['options']);
            if (! in_array($answer, $allowedAnswers, true)) {
                throw new DomainException('The active answer key contains an answer outside its section option range.');
            }

            $points = (float) $item->points;
            if (! is_finite($points) || $points < 0) {
                throw new DomainException('The active answer key contains invalid item points.');
            }

            $key = "{$item->section}:{$itemNumber}";
            if (isset($indexed[$key])) {
                throw new DomainException('The active answer key contains a duplicate item.');
            }

            $indexed[$key] = [
                'section' => $item->section,
                'item_number' => $itemNumber,
                'correct_answer' => $answer,
                'points' => $points,
            ];
        }

        $ordered = [];
        foreach ($sections as $sectionId => $section) {
            for ($itemNumber = 1; $itemNumber <= $section['items']; $itemNumber++) {
                $key = "{$sectionId}:{$itemNumber}";
                if (! isset($indexed[$key])) {
                    throw new DomainException(
                        "The active answer key is incomplete: {$section['display']} item {$itemNumber} is missing."
                    );
                }
                $ordered[] = $indexed[$key];
                unset($indexed[$key]);
            }
        }

        if ($indexed !== []) {
            throw new DomainException('The active answer key contains unexpected items.');
        }

        $totalPoints = array_sum(array_column($ordered, 'points'));
        if ($totalPoints <= 0) {
            throw new DomainException('The active answer key must have more than zero total points.');
        }

        $passingScore = (float) $answerKey->passing_score;
        if (! is_finite($passingScore) || $passingScore < 0 || $passingScore > 100) {
            throw new DomainException('The active answer key has an invalid passing score.');
        }

        return [
            'answer_key_id' => $answerKey->id,
            'exam_title' => $answerKey->exam_title,
            'passing_score' => $passingScore,
            'items' => $ordered,
        ];
    }
}
