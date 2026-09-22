<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExaminationApplicant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ExaminationApplicant::with(['folder:id,course,school_year', 'answerKey:id,exam_title', 'result']);

        if ($request->filled('folder_id')) {
            $query->where('folder_id', $request->integer('folder_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'folder_id' => 'required|exists:tbl_examination_folders,id',
            'answer_key_id' => 'required|exists:tbl_answer_keys,id',
            'applicant_name' => 'required|string|max:255',
            'examination_date' => 'required|date',
            'status' => 'sometimes|in:Pending,Processed',
        ]);

        $applicant = ExaminationApplicant::create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($applicant->load('folder', 'answerKey'), 201);
    }

    public function show(ExaminationApplicant $applicant): JsonResponse
    {
        return response()->json($applicant->load(['folder', 'answerKey', 'answerSheet.answers', 'result']));
    }

    public function update(Request $request, ExaminationApplicant $applicant): JsonResponse
    {
        $data = $request->validate([
            'folder_id' => 'sometimes|exists:tbl_examination_folders,id',
            'answer_key_id' => 'sometimes|exists:tbl_answer_keys,id',
            'applicant_name' => 'sometimes|string|max:255',
            'examination_date' => 'sometimes|date',
            'status' => 'sometimes|in:Pending,Processed',
        ]);

        $applicant->update($data);

        return response()->json($applicant->fresh()->load('folder', 'answerKey'));
    }

    public function destroy(ExaminationApplicant $applicant): JsonResponse
    {
        $applicant->delete();

        return response()->json(['message' => 'Applicant deleted.']);
    }
}