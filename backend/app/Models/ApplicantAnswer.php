<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicantAnswer extends Model
{
    protected $table = 'tbl_applicant_answers';

    protected $fillable = [
        'sheet_id',
        'item_number',
        'section',
        'marked_answer',
        'recognition_status',
        'confidence',
        'flags',
        'is_correct',
        'points_awarded',
        'points_possible',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'confidence' => 'float',
            'flags' => 'array',
            'points_awarded' => 'decimal:2',
            'points_possible' => 'decimal:2',
        ];
    }

    public function sheet(): BelongsTo
    {
        return $this->belongsTo(AnswerSheet::class, 'sheet_id');
    }
}
