<?php

namespace App\Services;

use App\Models\AnswerSheet;
use Illuminate\Support\Facades\Storage;

class AnswerSheetImageStorage
{
    /** Delete the physical image, treating an already-missing file as success. */
    public function delete(AnswerSheet $sheet): bool
    {
        $path = trim((string) $sheet->image_path);
        if ($path === '') {
            return true;
        }

        $disk = Storage::disk($sheet->storage_disk ?: 'public');

        return ! $disk->exists($path) || $disk->delete($path);
    }
}
