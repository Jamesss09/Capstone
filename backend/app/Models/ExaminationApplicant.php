<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ExaminationApplicant extends Model
{
    protected $table = 'tbl_examination_applicants';

    protected $fillable = [
        'folder_id',
        'answer_key_id',
        'applicant_name',
        'examination_date',
        'status',
        'student_type',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'examination_date' => 'date',
        ];
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(ExaminationFolder::class, 'folder_id');
    }

    public function answerKey(): BelongsTo
    {
        return $this->belongsTo(AnswerKey::class, 'answer_key_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function answerSheet(): HasOne
    {
        return $this->hasOne(AnswerSheet::class, 'applicant_id');
    }

    public function result(): HasOne
    {
        return $this->hasOne(ExaminationResult::class, 'applicant_id');
    }
}