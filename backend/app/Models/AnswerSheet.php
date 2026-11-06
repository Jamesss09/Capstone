<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AnswerSheet extends Model
{
    protected $table = 'tbl_answer_sheets';

    protected $fillable = [
        'applicant_id',
        'image_path',
        'annotated_image_path',
        'storage_disk',
        'image_hash',
        'processed_at',
        'image_deleted_at',
        'recognition_metadata',
    ];

    protected function casts(): array
    {
        return [
            'processed_at' => 'datetime',
            'image_deleted_at' => 'datetime',
            'recognition_metadata' => 'array',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(ExaminationApplicant::class, 'applicant_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ApplicantAnswer::class, 'sheet_id');
    }

    public function processingJobs(): HasMany
    {
        return $this->hasMany(OmrProcessingJob::class, 'sheet_id');
    }
}
