<?php

namespace App\Services\Omr;

use App\Exceptions\OmrRejectedException;
use App\Exceptions\OmrResponseException;
use App\Models\AnswerSheet;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class OmrClient
{
    /**
     * @param  array<string, mixed>  $answerKey
     * @return array<string, mixed>
     */
    public function recognize(AnswerSheet $sheet, array $answerKey, int $processingJobId): array
    {
        if (blank($sheet->image_path)) {
            throw new OmrRejectedException('The uploaded answer-sheet image is no longer available.');
        }

        $disk = Storage::disk($sheet->storage_disk ?: 'public');
        if (! $disk->exists($sheet->image_path)) {
            throw new OmrRejectedException('The uploaded answer-sheet image is no longer available.');
        }

        $contents = $disk->get($sheet->image_path);
        $filename = basename($sheet->image_path);
        $mimeType = $disk->mimeType($sheet->image_path) ?: $this->mimeType($filename);
        $url = rtrim((string) config('services.omr.url'), '/');

        if ($url === '') {
            throw new OmrRejectedException('The OMR service URL is not configured.');
        }

        $response = Http::acceptJson()
            ->connectTimeout((float) config('services.omr.connect_timeout', 5))
            ->timeout((float) config('services.omr.timeout', 60))
            ->attach('file', $contents, $filename, ['Content-Type' => $mimeType])
            ->post("{$url}/recognize", [
                'answer_key' => json_encode($answerKey, JSON_THROW_ON_ERROR),
                'answer_key_id' => (string) $answerKey['answer_key_id'],
                'request_id' => "job-{$processingJobId}",
            ]);

        if ($response->clientError()) {
            $detail = $response->json('detail');
            $message = is_string($detail) && $detail !== ''
                ? $detail
                : "OMR rejected the request with HTTP {$response->status()}.";

            throw new OmrRejectedException(str($message)->limit(2000)->toString());
        }

        $response->throw();
        $payload = $response->json();
        if (! is_array($payload)) {
            throw new OmrResponseException('The OMR service returned a non-JSON response.');
        }

        return $payload;
    }

    private function mimeType(string $filename): string
    {
        return strtolower(pathinfo($filename, PATHINFO_EXTENSION)) === 'png'
            ? 'image/png'
            : 'image/jpeg';
    }
}
