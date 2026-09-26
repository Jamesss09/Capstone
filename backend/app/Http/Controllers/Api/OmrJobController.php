<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnswerSheet;
use App\Models\AuditLog;
use App\Models\OmrProcessingJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OmrJobController extends Controller
{
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

        $path = $request->file('image')->store('answer_sheets', 'public');
        $hash = hash_file('sha256', $request->file('image')->getRealPath());

        $sheet = AnswerSheet::create([
            'applicant_id' => $data['applicant_id'],
            'image_path' => $path,
            'image_hash' => $hash,
        ]);

        // queue position: next available
        $position = OmrProcessingJob::max('queue_position') + 1;

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

        return response()->json([
            'sheet' => $sheet,
            'job' => $job,
            'image_url' => Storage::disk('public')->url($path),
        ], 201);
    }

    public function status(Request $request, OmrProcessingJob $job): JsonResponse
    {
        return response()->json($job->load('sheet.applicant'));
    }
}