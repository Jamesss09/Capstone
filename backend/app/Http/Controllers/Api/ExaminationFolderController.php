<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ExaminationFolder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExaminationFolderController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            ExaminationFolder::withCount('applicants')->with('creator:id,full_name')->latest()->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'course' => 'required|string|max:100',
            'school_year' => 'required|string|max:50',
            'description' => 'nullable|string',
            'status' => ['sometimes', Rule::in(['Active', 'Archived'])],
        ]);

        $folder = ExaminationFolder::create([
            ...$data,
            'status' => $data['status'] ?? 'Active',
            'created_by' => $request->user()->id,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_FOLDER',
            'table_name' => 'tbl_examination_folders',
            'record_id' => $folder->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($folder, 201);
    }

    public function show(ExaminationFolder $folder): JsonResponse
    {
        return response()->json($folder->load('applicants'));
    }

    public function update(Request $request, ExaminationFolder $folder): JsonResponse
    {
        $data = $request->validate([
            'course' => 'sometimes|string|max:100',
            'school_year' => 'sometimes|string|max:50',
            'description' => 'nullable|string',
            'status' => ['sometimes', Rule::in(['Active', 'Archived'])],
        ]);

        $folder->update($data);

        return response()->json($folder->fresh());
    }

    public function destroy(Request $request, ExaminationFolder $folder): JsonResponse
    {
        if ($folder->applicants()->exists()) {
            return response()->json(['message' => 'Folder has applicants and cannot be deleted.'], 422);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'DELETE_FOLDER',
            'table_name' => 'tbl_examination_folders',
            'record_id' => $folder->id,
            'ip_address' => $request->ip(),
        ]);

        $folder->delete();

        return response()->json(['message' => 'Folder deleted.']);
    }
}