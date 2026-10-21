<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExaminationResult extends Model
{
    protected $table = 'tbl_examination_results';

    protected $fillable = [
        'applicant_id',
        'answer_key_id',
        'score',
        'status',
        'course',
        'total_items',
        'correct_count',
        'incorrect_count',
        'passing_score',
        'computed_by',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'passing_score' => 'decimal:2',
            'computed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Snapshot the course chosen when the applicant was identified. Result
        // writers (mobile save, OMR pipeline) don't need to pass it
        // explicitly, but an explicit value still wins.
        static::creating(function (ExaminationResult $result) {
            if (blank($result->course) && $result->applicant_id) {
                $result->course = ExaminationApplicant::query()
                    ->whereKey($result->applicant_id)
                    ->value('course');
            }
        });
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(ExaminationApplicant::class, 'applicant_id');
    }

    public function answerKey(): BelongsTo
    {
        return $this->belongsTo(AnswerKey::class, 'answer_key_id');
    }

    public function computedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'computed_by');
    }
}
