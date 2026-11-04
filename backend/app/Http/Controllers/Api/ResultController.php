<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ExaminationApplicant;
use App\Models\ExaminationResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ResultController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ExaminationResult::with([
            'applicant:id,folder_id,applicant_name,student_type,course,examination_date',
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
            // Course lives on the result row (snapshot) and on the applicant
            // (chosen when identified). Fall back to the applicant's folder
            // for rows written before the result column existed.
            $course = (string) $request->string('course');
            $query->where(function ($q) use ($course) {
                $q->where('tbl_examination_results.course', $course)
                    ->orWhereHas('applicant', fn ($qq) => $qq->where('course', $course))
                    ->orWhereHas('applicant.folder', fn ($qq) => $qq->where('course', $course));
            });
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

    /**
     * File a completed scan into an active school-year folder. The applicant
     * remains unfiled until this explicit action, and repeating the same save
     * is idempotent so a lost response cannot move or duplicate a result.
     */
    public function fileResult(Request $request, ExaminationResult $result): JsonResponse
    {
        $data = $request->validate([
            'folder_id' => [
                'required',
                'integer',
                Rule::exists('tbl_examination_folders', 'id')->where('status', 'Active'),
            ],
        ], [
            'folder_id.exists' => 'The selected school year folder is not active or no longer exists.',
        ]);

        $result->loadMissing('applicant');
        $applicant = $result->applicant;

        if ($request->user()->role !== 'Administrator' && $applicant->created_by !== $request->user()->id) {
            abort(403, 'You may only file results that you submitted.');
        }

        if ($applicant->filed_at !== null && (int) $applicant->folder_id !== (int) $data['folder_id']) {
            abort(409, 'This result is already saved to another school year folder.');
        }

        $folderId = (int) $data['folder_id'];

        $filedApplicant = DB::transaction(function () use ($applicant, $folderId, $request, $result) {
            $locked = ExaminationApplicant::query()
                ->lockForUpdate()
                ->findOrFail($applicant->id);

            if ($locked->filed_at !== null && (int) $locked->folder_id !== $folderId) {
                abort(409, 'This result is already saved to another school year folder.');
            }

            if ($locked->filed_at === null) {
                $locked->update([
                    'folder_id' => $folderId,
                    'filed_at' => now(),
                    'filed_by' => $request->user()->id,
                ]);

                AuditLog::create([
                    'user_id' => $request->user()->id,
                    'action' => 'FILE_RESULT',
                    'table_name' => 'tbl_examination_results',
                    'record_id' => $result->id,
                    'ip_address' => $request->ip(),
                ]);
            }

            return $locked->fresh(['folder', 'result']);
        });

        return response()->json([
            'message' => 'Successfully Saved To Admin Portal',
            'applicant' => $filedApplicant,
            'result' => $result->fresh(),
        ]);
    }
}
