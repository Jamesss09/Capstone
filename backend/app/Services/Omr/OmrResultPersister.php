<?php

namespace App\Services\Omr;

use App\Exceptions\OmrResponseException;
use App\Models\AnswerSheet;
use App\Models\AuditLog;
use App\Models\ExaminationApplicant;
use App\Models\ExaminationResult;
use App\Models\OmrProcessingJob;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class OmrResultPersister
{
    public function __construct(private readonly AnswerKeyPayloadFactory $payloadFactory) {}

    /**
     * Validate the complete OMR response, independently verify its score, and
     * atomically replace every persisted answer/result for this sheet.
     *
     * @param  array<string, mixed>  $response
     */
    public function persist(OmrProcessingJob $job, array $response): ExaminationResult
    {
        $job->loadMissing('sheet.applicant.answerKey.items');
        $normalized = $this->normalize($job, $response);

        return DB::transaction(function () use ($job, $normalized) {
            $lockedJob = OmrProcessingJob::query()->lockForUpdate()->findOrFail($job->id);
            $sheet = AnswerSheet::query()->lockForUpdate()->findOrFail($lockedJob->sheet_id);
            $applicant = ExaminationApplicant::query()->lockForUpdate()->findOrFail($sheet->applicant_id);

            if ($lockedJob->status === 'Completed') {
                return ExaminationResult::query()
                    ->where('applicant_id', $applicant->id)
                    ->firstOrFail();
            }

            $sheet->answers()->delete();
            $sheet->answers()->createMany($normalized['answers']);

            $result = ExaminationResult::query()->updateOrCreate(
                ['applicant_id' => $applicant->id],
                [
                    'answer_key_id' => $applicant->answer_key_id,
                    'score' => $normalized['result']['score'],
                    'earned_points' => $normalized['result']['earned_points'],
                    'total_points' => $normalized['result']['total_points'],
                    'status' => $normalized['result']['status'],
                    'course' => $applicant->course,
                    'total_items' => $normalized['result']['total_items'],
                    'correct_count' => $normalized['result']['correct_count'],
                    'incorrect_count' => $normalized['result']['incorrect_count'],
                    'answered_count' => $normalized['result']['answered_count'],
                    'blank_count' => $normalized['result']['blank_count'],
                    'invalid_count' => $normalized['result']['invalid_count'],
                    'low_confidence_count' => $normalized['result']['low_confidence_count'],
                    'passing_score' => $normalized['result']['passing_score'],
                    'computed_by' => $lockedJob->user_id,
                    'computed_at' => now(),
                ]
            );

            $sheet->update([
                'processed_at' => now(),
                'recognition_metadata' => $normalized['metadata'],
            ]);
            $applicant->update(['status' => 'Processed']);
            $lockedJob->update([
                'status' => 'Completed',
                'queue_position' => null,
                'completed_at' => now(),
                'error_message' => null,
            ]);

            AuditLog::firstOrCreate([
                'user_id' => $lockedJob->user_id,
                'action' => 'PROCESS_ANSWER_SHEET',
                'table_name' => 'tbl_examination_results',
                'record_id' => $result->id,
            ]);

            return $result->fresh();
        });
    }

    /**
     * @param  array<string, mixed>  $response
     * @return array{answers: array<int, array<string, mixed>>, result: array<string, mixed>, metadata: array<string, mixed>}
     */
    private function normalize(OmrProcessingJob $job, array $response): array
    {
        if (($response['status'] ?? null) !== 'scored') {
            throw new OmrResponseException('The OMR response is not a scored result.');
        }
        if (($response['bubble_count'] ?? null) !== 410 || ($response['item_count'] ?? null) !== 100) {
            throw new OmrResponseException('The OMR response does not contain 410 bubbles and 100 items.');
        }
        if (! isset($response['scoring']) || ! is_array($response['scoring'])) {
            throw new OmrResponseException('The OMR response is missing scoring data.');
        }

        $keyPayload = $this->payloadFactory->make($job->sheet->applicant->answerKey);
        $recognized = $this->indexItems($response['items'] ?? null, 'items');
        $scored = $this->indexItems($response['scoring']['items'] ?? null, 'scoring.items');
        $answers = [];
        $earnedPoints = 0.0;
        $totalPoints = 0.0;
        $correctCount = 0;
        $answeredCount = 0;
        $blankCount = 0;
        $invalidCount = 0;
        $lowConfidenceCount = 0;

        foreach ($keyPayload['items'] as $keyItem) {
            $itemKey = $this->itemKey($keyItem['section'], $keyItem['item_number']);
            $recognition = $recognized[$itemKey] ?? null;
            $scoreItem = $scored[$itemKey] ?? null;

            if ($recognition === null || $scoreItem === null) {
                throw new OmrResponseException("The OMR response is missing {$itemKey}.");
            }

            $status = $recognition['status'] ?? null;
            if (! in_array($status, ['answered', 'blank', 'invalid'], true)) {
                throw new OmrResponseException("The OMR response has an invalid status for {$itemKey}.");
            }

            $markedAnswer = $recognition['marked_answer'] ?? null;
            $allowedAnswers = $this->allowedAnswers($keyItem['section']);
            if ($status === 'answered') {
                if (! is_string($markedAnswer) || ! in_array($markedAnswer, $allowedAnswers, true)) {
                    throw new OmrResponseException("The OMR response has an invalid marked answer for {$itemKey}.");
                }
                $answeredCount++;
            } else {
                if ($markedAnswer !== null) {
                    throw new OmrResponseException("The OMR response must not mark a {$status} item for {$itemKey}.");
                }
                $status === 'blank' ? $blankCount++ : $invalidCount++;
            }

            $flags = $recognition['flags'] ?? [];
            if (! is_array($flags) || ! array_is_list($flags) || array_filter($flags, fn ($flag) => ! is_string($flag))) {
                throw new OmrResponseException("The OMR response has invalid flags for {$itemKey}.");
            }
            $knownFlags = ['low_confidence', 'multi_shade', 'erasure'];
            if (array_diff($flags, $knownFlags)
                || ($status === 'answered' && array_diff($flags, ['low_confidence']))
                || ($status === 'blank' && $flags !== [])
                || ($status === 'invalid' && ! array_intersect($flags, ['multi_shade', 'erasure']))) {
                throw new OmrResponseException("The OMR response has flags inconsistent with {$itemKey}.");
            }

            $confidence = $recognition['confidence'] ?? null;
            if (! is_numeric($confidence) || (float) $confidence < 0 || (float) $confidence > 1) {
                throw new OmrResponseException("The OMR response has invalid confidence for {$itemKey}.");
            }

            if (($scoreItem['recognition_status'] ?? null) !== $status
                || ($scoreItem['marked_answer'] ?? null) !== $markedAnswer
                || ($scoreItem['flags'] ?? null) !== $flags) {
                throw new OmrResponseException("Recognition and scoring disagree for {$itemKey}.");
            }

            $isCorrect = $status === 'answered' && $markedAnswer === $keyItem['correct_answer'];
            if (($scoreItem['is_correct'] ?? null) !== $isCorrect) {
                throw new OmrResponseException("The OMR correctness value is inconsistent for {$itemKey}.");
            }

            $pointsPossible = (float) $keyItem['points'];
            $pointsAwarded = $isCorrect ? $pointsPossible : 0.0;
            $this->assertClose($scoreItem['points_possible'] ?? null, $pointsPossible, "points possible for {$itemKey}");
            $this->assertClose($scoreItem['points_awarded'] ?? null, $pointsAwarded, "points awarded for {$itemKey}");

            $correctCount += $isCorrect ? 1 : 0;
            $earnedPoints += $pointsAwarded;
            $totalPoints += $pointsPossible;
            $lowConfidenceCount += in_array('low_confidence', $flags, true) ? 1 : 0;
            $answers[] = [
                'section' => $keyItem['section'],
                'item_number' => $keyItem['item_number'],
                'marked_answer' => $markedAnswer,
                'recognition_status' => $status,
                'confidence' => (float) $confidence,
                'flags' => $flags,
                'is_correct' => $isCorrect,
                'points_awarded' => $pointsAwarded,
                'points_possible' => $pointsPossible,
            ];
        }

        if (count($recognized) !== 100 || count($scored) !== 100) {
            throw new OmrResponseException('The OMR response contains unexpected or duplicate items.');
        }

        $passingScore = (float) $keyPayload['passing_score'];
        $percentage = round(($earnedPoints / $totalPoints) * 100, 2);
        $resultStatus = (($earnedPoints / $totalPoints) * 100) >= $passingScore ? 'Passed' : 'Failed';
        $incorrectCount = 100 - $correctCount;
        $scoring = $response['scoring'];

        $this->assertInteger($scoring['answer_key_id'] ?? null, $job->sheet->applicant->answer_key_id, 'answer key ID');
        $this->assertClose($scoring['score'] ?? null, $percentage, 'score');
        $this->assertClose($scoring['earned_points'] ?? null, $earnedPoints, 'earned points');
        $this->assertClose($scoring['total_points'] ?? null, $totalPoints, 'total points');
        $this->assertClose($scoring['passing_score'] ?? null, $passingScore, 'passing score');
        $this->assertInteger($scoring['total_items'] ?? null, 100, 'total item count');
        $this->assertInteger($scoring['correct_count'] ?? null, $correctCount, 'correct count');
        $this->assertInteger($scoring['incorrect_count'] ?? null, $incorrectCount, 'incorrect count');
        $this->assertInteger($scoring['answered_count'] ?? null, $answeredCount, 'answered count');
        $this->assertInteger($scoring['blank_count'] ?? null, $blankCount, 'blank count');
        $this->assertInteger($scoring['invalid_count'] ?? null, $invalidCount, 'invalid count');
        $this->assertInteger($scoring['low_confidence_count'] ?? null, $lowConfidenceCount, 'low-confidence count');

        if (($scoring['status'] ?? null) !== $resultStatus) {
            throw new OmrResponseException('The OMR pass/fail status is inconsistent with the verified score.');
        }

        $metadata = Arr::only($response, [
            'filename',
            'size_bytes',
            'template_id',
            'model',
            'registration',
            'lattice',
            'warnings',
            'low_confidence_threshold',
            'erasure_threshold',
            'bubble_count',
            'item_count',
            'summary',
            'timing_ms',
        ]);
        $metadata['scoring'] = Arr::except($scoring, ['items']);

        return [
            'answers' => $answers,
            'result' => [
                'score' => $percentage,
                'earned_points' => $earnedPoints,
                'total_points' => $totalPoints,
                'status' => $resultStatus,
                'total_items' => 100,
                'correct_count' => $correctCount,
                'incorrect_count' => $incorrectCount,
                'answered_count' => $answeredCount,
                'blank_count' => $blankCount,
                'invalid_count' => $invalidCount,
                'low_confidence_count' => $lowConfidenceCount,
                'passing_score' => $passingScore,
            ],
            'metadata' => $metadata,
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function indexItems(mixed $items, string $field): array
    {
        if (! is_array($items) || ! array_is_list($items)) {
            throw new OmrResponseException("The OMR {$field} field must be an array.");
        }

        $indexed = [];
        foreach ($items as $item) {
            if (! is_array($item) || ! is_string($item['section'] ?? null) || ! is_int($item['item_number'] ?? null)) {
                throw new OmrResponseException("The OMR {$field} field contains a malformed item.");
            }
            $key = $this->itemKey($item['section'], $item['item_number']);
            if (isset($indexed[$key])) {
                throw new OmrResponseException("The OMR {$field} field repeats {$key}.");
            }
            $indexed[$key] = $item;
        }

        return $indexed;
    }

    /** @return array<int, string> */
    private function allowedAnswers(string $section): array
    {
        $optionCount = config("omr_sections.sections.{$section}.options");
        if (! is_int($optionCount)) {
            throw new OmrResponseException("The OMR response contains unknown section {$section}.");
        }

        return array_slice(['A', 'B', 'C', 'D', 'E'], 0, $optionCount);
    }

    private function itemKey(string $section, int $itemNumber): string
    {
        return "{$section}:{$itemNumber}";
    }

    private function assertClose(mixed $actual, float $expected, string $field): void
    {
        if (! is_numeric($actual) || abs((float) $actual - $expected) > 0.005) {
            throw new OmrResponseException("The OMR {$field} is inconsistent.");
        }
    }

    private function assertInteger(mixed $actual, int $expected, string $field): void
    {
        if (! is_int($actual) || $actual !== $expected) {
            throw new OmrResponseException("The OMR {$field} is inconsistent.");
        }
    }
}
