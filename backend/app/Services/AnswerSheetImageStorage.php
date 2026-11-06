<?php

namespace App\Services;

use App\Models\AnswerSheet;
use Illuminate\Support\Facades\Storage;

class AnswerSheetImageStorage
{
    /** Delete the physical image, treating an already-missing file as success. */
    public function delete(AnswerSheet $sheet): bool
    {
        $disk = Storage::disk($sheet->storage_disk ?: 'public');
        $paths = array_values(array_filter([
            trim((string) $sheet->image_path),
            trim((string) $sheet->annotated_image_path),
        ]));

        if ($paths === []) {
            return true;
        }

        foreach ($paths as $path) {
            if ($disk->exists($path) && ! $disk->delete($path)) {
                return false;
            }
        }

        return true;
    }

    public function storeAnnotated(AnswerSheet $sheet, string $contents): string
    {
        $disk = Storage::disk($sheet->storage_disk ?: 'public');
        $path = "answer_sheets/annotated/{$sheet->id}.jpg";

        if (! $disk->put($path, $contents)) {
            throw new \RuntimeException('Could not store the annotated answer sheet.');
        }

        return $path;
    }
}
