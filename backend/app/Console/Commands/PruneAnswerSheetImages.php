<?php

namespace App\Console\Commands;

use App\Models\AnswerSheet;
use App\Models\AuditLog;
use App\Services\AnswerSheetImageStorage;
use Illuminate\Console\Command;

class PruneAnswerSheetImages extends Command
{
    protected $signature = 'answer-sheets:prune-images
                            {--days= : Override the configured retention period}
                            {--dry-run : Report eligible images without deleting them}';

    protected $description = 'Delete retained source images while preserving answers, results, and diagnostics';

    public function handle(AnswerSheetImageStorage $imageStorage): int
    {
        $days = $this->option('days') ?? config('answer_sheets.retention_days');
        if (filter_var($days, FILTER_VALIDATE_INT) === false || (int) $days < 1) {
            $this->error('The retention period must be a positive number of days.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays((int) $days);
        $dryRun = (bool) $this->option('dry-run');
        $eligible = 0;
        $deleted = 0;
        $failed = 0;

        AnswerSheet::query()
            ->whereNotNull('image_path')
            ->whereNotNull('processed_at')
            ->where('processed_at', '<=', $cutoff)
            ->whereHas('applicant.result')
            ->orderBy('id')
            ->chunkById(100, function ($sheets) use (
                $dryRun,
                $imageStorage,
                &$eligible,
                &$deleted,
                &$failed,
            ): void {
                foreach ($sheets as $sheet) {
                    $eligible++;
                    if ($dryRun) {
                        continue;
                    }

                    if (! $imageStorage->delete($sheet)) {
                        $failed++;
                        $this->warn("Could not delete image for answer sheet #{$sheet->id}.");

                        continue;
                    }

                    $sheet->update([
                        'image_path' => null,
                        'annotated_image_path' => null,
                        'image_hash' => null,
                        'image_deleted_at' => now(),
                    ]);
                    AuditLog::create([
                        'user_id' => null,
                        'action' => 'PRUNE_ANSWER_SHEET_IMAGE',
                        'table_name' => 'tbl_answer_sheets',
                        'record_id' => $sheet->id,
                    ]);
                    $deleted++;
                }
            });

        if ($dryRun) {
            $this->info("{$eligible} answer-sheet image(s) are eligible for deletion.");
        } else {
            $this->info("Deleted {$deleted} answer-sheet image(s); {$failed} failed.");
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
