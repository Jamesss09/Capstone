<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOmrSheet;
use App\Models\AnswerSheet;
use App\Models\AuditLog;
use App\Models\ExaminationApplicant;
use App\Models\OmrProcessingJob;
use App\Services\Omr\AnswerKeyPayloadFactory;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class OmrJobController extends Controller
{
    public function __construct(private readonly AnswerKeyPayloadFactory $payloadFactory) {}

    /**
     * Staff uploads a captured answer sheet image.
     * Creates the AnswerSheet record + a queued OMR processing job.
     */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'applicant_id' => 'required|exists:tbl_examination_applicants,id',
            'image' => 'required|image|mimes:jpeg,png|max:10240',
        ]);

        $disk = 'local';
        $hash = hash_file('sha256', $request->file('image')->getRealPath());
        $path = $request->file('image')->store('answer_sheets', $disk);
        if ($path === false) {
            abort(500, 'Could not store the uploaded answer sheet.');
        }

        $oldImagePath = null;
        $oldImageDisk = null;

        try {
            [$sheet, $job] = DB::transaction(function () use ($data, $request, $path, $disk, $hash, &$oldImagePath, &$oldImageDisk) {
                $applicant = ExaminationApplicant::query()
                    ->with('answerKey.items')
                    ->lockForUpdate()
                    ->findOrFail($data['applicant_id']);

                if ($applicant->status === 'Processed' || $applicant->result()->exists()) {
                    abort(409, 'This applicant already has a completed examination result.');
                }

                $this->payloadFactory->make($applicant->answerKey);
                $existingSheet = AnswerSheet::query()
                    ->with('processingJobs')
                    ->where('applicant_id', $applicant->id)
                    ->lockForUpdate()
                    ->first();

                if ($existingSheet !== null) {
                    $latestJob = $existingSheet->processingJobs->sortByDesc('id')->first();
                    if ($latestJob === null || $latestJob->status !== 'Failed') {
                        abort(409, 'This applicant already has an answer sheet being processed.');
                    }
                    $oldImagePath = $existingSheet->image_path;
                    $oldImageDisk = $existingSheet->storage_disk ?: 'public';
                    $existingSheet->delete();
                }

                $sheet = AnswerSheet::create([
                    'applicant_id' => $applicant->id,
                    'image_path' => $path,
                    'storage_disk' => $disk,
                    'image_hash' => $hash,
                ]);

                $position = ((int) OmrProcessingJob::query()
                    ->where('status', 'Queued')
                    ->lockForUpdate()
                    ->max('queue_position')) + 1;

                $job = OmrProcessingJob::create([
                    'sheet_id' => $sheet->id,
                    'user_id' => $request->user()->id,
                    'status' => 'Queued',
                    'queue_position' => $position,
                ]);

                AuditLog::create([
                    'user_id' => $request->user()->id,
                    'action' => 'SCAN_ANSWER_SHEET',
                    'table_name' => 'tbl_answer_sheets',
                    'record_id' => $sheet->id,
                    'ip_address' => $request->ip(),
                ]);

                return [$sheet, $job];
            });
        } catch (DomainException $exception) {
            Storage::disk($disk)->delete($path);
            throw ValidationException::withMessages([
                'answer_key' => [$exception->getMessage()],
            ]);
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }

        if ($oldImagePath !== null && $oldImagePath !== $path) {
            Storage::disk($oldImageDisk ?? 'public')->delete($oldImagePath);
        }

        try {
            ProcessOmrSheet::dispatch($job->id);
        } catch (Throwable $exception) {
            $job->update([
                'status' => 'Failed',
                'completed_at' => now(),
                'error_message' => 'Could not dispatch the OMR queue job.',
            ]);
            throw $exception;
        }

        return response()->json([
            'sheet' => $sheet,
            'job' => $job,
        ], 202);
    }

    public function status(Request $request, OmrProcessingJob $job): JsonResponse
    {
        if ($request->user()->role !== 'Administrator' && $job->user_id !== $request->user()->id) {
            abort(403, 'You may only view OMR jobs that you submitted.');
        }

        $job->load([
            'sheet.applicant:id,folder_id,answer_key_id,applicant_name,examination_date,status,student_type,course',
            'sheet.applicant.result',
        ]);

        return response()->json([
            'job' => $job,
            'result' => $job->sheet->applicant->result,
        ]);
    }
}
