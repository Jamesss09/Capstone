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
            'applicant:id,folder_id,applicant_name',
            'answerKey:id,exam_title,passing_score',
        ]);

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('answer_key_id')) {
            $query->where('answer_key_id', $request->integer('answer_key_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('applicant', fn ($q) => $q->where('applicant_name', 'like', "%{$search}%"));
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