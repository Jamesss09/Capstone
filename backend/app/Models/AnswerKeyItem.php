<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnswerKeyItem extends Model
{
    protected $table = 'tbl_answer_key_items';

    protected $fillable = [
        'answer_key_id',
        'section',
        'item_number',
        'correct_answer',
        'points',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'decimal:2',
        ];
    }

    public function answerKey(): BelongsTo
    {
        return $this->belongsTo(AnswerKey::class, 'answer_key_id');
    }
}