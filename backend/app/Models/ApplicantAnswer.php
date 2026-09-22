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
        'is_correct',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
        ];
    }

    public function sheet(): BelongsTo
    {
        return $this->belongsTo(AnswerSheet::class, 'sheet_id');
    }
}