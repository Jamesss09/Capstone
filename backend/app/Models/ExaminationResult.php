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