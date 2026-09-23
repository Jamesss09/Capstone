<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExaminationResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResultController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ExaminationResult::with([
            'applicant:id,folder_id,applicant_name,student_type,examination_date',
            'answerKey:id,exam_title,passing_score',
            'applicant.folder:id,course,school_year',
        ]);

        if ($request->filled('folder_id')) {
            $query->whereHas('applicant', fn ($q) => $q->where('folder_id', $request->integer('folder_id')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('answer_key_id')) {
            $query->where('answer_key_id', $request->integer('answer_key_id'));
        }

        if ($request->filled('course')) {
            $query->whereHas('applicant.folder', fn ($q) => $q->where('course', $request->string('course')));
        }

        if ($request->filled('student_type')) {
            $query->whereHas('applicant', fn ($q) => $q->where('student_type', $request->string('student_type')));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('applicant', function ($q) use ($search) {
                $q->where('applicant_name', 'like', "%{$search}%");
                if (is_numeric($search)) {
                    $q->orWhere('id', (int) $search);
                }
            });
        }

        return response()->json($query->latest()->get());
    }

    public function show(ExaminationResult $result): JsonResponse
    {
        return response()->json($result->load([
            'applicant',
            'answerKey',
            'applicant.answerSheet.answers',
        ]));
    }
}