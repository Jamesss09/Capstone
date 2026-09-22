<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AnswerKey extends Model
{
    protected $table = 'tbl_answer_keys';

    protected $fillable = [
        'exam_title',
        'passing_score',
        'school_year',
        'status',
        'file_path',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'passing_score' => 'decimal:2',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(AnswerKeyItem::class, 'answer_key_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}