<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExaminationApplicant;
use App\Services\Omr\ActiveAnswerKeyResolver;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ApplicantController extends Controller
{
    public function __construct(private readonly ActiveAnswerKeyResolver $activeAnswerKeyResolver) {}

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
            'answer_key_id' => 'prohibited',
            'applicant_name' => 'required|string|max:255',
            'examination_date' => 'required|date',
            'status' => 'prohibited',
            'student_type' => 'sometimes|nullable|in:NEW,TRANSFEREE,OLD,RETURNEE',
            // Chosen by staff on the mobile Identify Applicant screen.
            'course' => ['required', 'string', 'max:100', Rule::in(config('courses'))],
        ]);

        try {
            $applicant = DB::transaction(function () use ($data, $request) {
                $answerKey = $this->activeAnswerKeyResolver->resolve();

                return ExaminationApplicant::create([
                    ...$data,
                    'answer_key_id' => $answerKey->id,
                    'status' => 'Pending',
                    'created_by' => $request->user()->id,
                ]);
            });
        } catch (DomainException $exception) {
            throw ValidationException::withMessages([
                'answer_key' => [$exception->getMessage()],
            ]);
        }

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
            'answer_key_id' => 'prohibited',
            'applicant_name' => 'sometimes|string|max:255',
            'examination_date' => 'sometimes|date',
            'status' => 'prohibited',
            'student_type' => 'sometimes|nullable|in:NEW,TRANSFEREE,OLD,RETURNEE',
            'course' => ['sometimes', 'required', 'string', 'max:100', Rule::in(config('courses'))],
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
