<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OmrProcessingJob extends Model
{
    protected $table = 'tbl_omr_processing_jobs';

    protected $fillable = [
        'sheet_id',
        'user_id',
        'status',
        'queue_position',
        'started_at',
        'completed_at',
        'error_message',
        'retry_count',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function sheet(): BelongsTo
    {
        return $this->belongsTo(AnswerSheet::class, 'sheet_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}