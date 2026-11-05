<?php

namespace App\Jobs;

use App\Exceptions\OmrRejectedException;
use App\Exceptions\OmrResponseException;
use App\Models\AuditLog;
use App\Models\OmrProcessingJob;
use App\Services\Omr\AnswerKeyPayloadFactory;
use App\Services\Omr\OmrClient;
use App\Services\Omr\OmrResultPersister;
use DomainException;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProcessOmrSheet implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 210;

    public bool $failOnTimeout = true;

    public function __construct(public readonly int $processingJobId)
    {
        $this->onQueue('omr');
    }

    /** @return array<int, int> */
    public function backoff(): array
    {
        return [5, 30];
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("omr-processing-job:{$this->processingJobId}"))
                ->dontRelease()
                ->expireAfter($this->timeout + 30),
        ];
    }

    public function handle(
        AnswerKeyPayloadFactory $payloadFactory,
        OmrClient $client,
        OmrResultPersister $persister,
    ): void {
        if (! $this->beginProcessing()) {
            return;
        }

        $processingJob = OmrProcessingJob::query()
            ->with('sheet.applicant.answerKey.items')
            ->find($this->processingJobId);

        if ($processingJob === null) {
            return;
        }

        try {
            $answerKey = $payloadFactory->make($processingJob->sheet->applicant->answerKey);
            $response = $client->recognize(
                $processingJob->sheet,
                $answerKey,
                $processingJob->id,
            );
            $persister->persist($processingJob, $response);
        } catch (DomainException|OmrRejectedException|OmrResponseException $exception) {
            $this->markFailed($exception);
        } catch (Throwable $exception) {
            $this->markForRetry($exception);
            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->markFailed($exception ?? new \RuntimeException('OMR processing failed.'));
    }

    private function beginProcessing(): bool
    {
        return DB::transaction(function () {
            $processingJob = OmrProcessingJob::query()
                ->lockForUpdate()
                ->find($this->processingJobId);

            if ($processingJob === null || in_array($processingJob->status, ['Completed', 'Failed'], true)) {
                return false;
            }

            $queuePosition = $processingJob->queue_position;
            $processingJob->update([
                'status' => 'Processing',
                'queue_position' => null,
                'started_at' => $processingJob->started_at ?? now(),
                'completed_at' => null,
                'error_message' => null,
                'retry_count' => max(0, $this->attempts() - 1),
            ]);

            if ($queuePosition !== null) {
                OmrProcessingJob::query()
                    ->where('status', 'Queued')
                    ->where('queue_position', '>', $queuePosition)
                    ->decrement('queue_position');
            }

            return true;
        });
    }

    private function markForRetry(Throwable $exception): void
    {
        OmrProcessingJob::query()
            ->whereKey($this->processingJobId)
            ->whereNotIn('status', ['Completed', 'Failed'])
            ->update([
                'status' => $this->attempts() < $this->tries ? 'Queued' : 'Processing',
                'retry_count' => $this->attempts(),
                'error_message' => $this->message($exception),
            ]);
    }

    private function markFailed(Throwable $exception): void
    {
        DB::transaction(function () use ($exception) {
            $processingJob = OmrProcessingJob::query()
                ->lockForUpdate()
                ->find($this->processingJobId);

            if ($processingJob === null || $processingJob->status === 'Completed') {
                return;
            }

            $processingJob->update([
                'status' => 'Failed',
                'queue_position' => null,
                'completed_at' => now(),
                'retry_count' => max($processingJob->retry_count, $this->attempts() - 1, 0),
                'error_message' => $this->message($exception),
            ]);

            AuditLog::firstOrCreate([
                'user_id' => $processingJob->user_id,
                'action' => 'OMR_PROCESSING_FAILED',
                'table_name' => 'tbl_omr_processing_jobs',
                'record_id' => $processingJob->id,
            ]);
        });
    }

    private function message(Throwable $exception): string
    {
        $message = trim($exception->getMessage());

        return str($message !== '' ? $message : 'OMR processing failed.')
            ->limit(2000)
            ->toString();
    }
}
