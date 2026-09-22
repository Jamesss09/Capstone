<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnswerKey;
use App\Models\AnswerKeyItem;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AnswerKeyController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            AnswerKey::withCount('items')->with('creator:id,full_name')->latest()->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'exam_title' => 'required|string|max:255',
            'passing_score' => 'required|numeric|between:0,100',
            'school_year' => 'required|string|max:50',
            'status' => ['sometimes', Rule::in(['Active', 'Inactive'])],
            'file_path' => 'nullable|string|max:255',
            'items' => 'sometimes|array',
            'items.*.section' => 'nullable|string|max:100',
            'items.*.item_number' => 'required|integer|min:1',
            'items.*.correct_answer' => ['required', Rule::in(['A', 'B', 'C', 'D', 'E'])],
            'items.*.points' => 'nullable|numeric|min:0',
        ]);

        $key = DB::transaction(function () use ($data, $request) {
            $key = AnswerKey::create([
                'exam_title' => $data['exam_title'],
                'passing_score' => $data['passing_score'],
                'school_year' => $data['school_year'],
                'status' => $data['status'] ?? 'Active',
                'file_path' => $data['file_path'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            if (!empty($data['items'])) {
                $key->items()->createMany(
                    array_map(fn ($i) => [
                        'section' => $i['section'] ?? null,
                        'item_number' => $i['item_number'],
                        'correct_answer' => $i['correct_answer'],
                        'points' => $i['points'] ?? 1.00,
                    ], $data['items'])
                );
            }

            return $key;
        });

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_ANSWER_KEY',
            'table_name' => 'tbl_answer_keys',
            'record_id' => $key->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($key->load('items'), 201);
    }

    public function show(AnswerKey $answerKey): JsonResponse
    {
        return response()->json($answerKey->load('items'));
    }

    public function update(Request $request, AnswerKey $answerKey): JsonResponse
    {
        $data = $request->validate([
            'exam_title' => 'sometimes|string|max:255',
            'passing_score' => 'sometimes|numeric|between:0,100',
            'school_year' => 'sometimes|string|max:50',
            'status' => ['sometimes', Rule::in(['Active', 'Inactive'])],
            'file_path' => 'nullable|string|max:255',
        ]);

        $answerKey->update($data);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_ANSWER_KEY',
            'table_name' => 'tbl_answer_keys',
            'record_id' => $answerKey->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($answerKey->fresh());
    }

    public function destroy(Request $request, AnswerKey $answerKey): JsonResponse
    {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'DELETE_ANSWER_KEY',
            'table_name' => 'tbl_answer_keys',
            'record_id' => $answerKey->id,
            'ip_address' => $request->ip(),
        ]);

        $answerKey->delete();

        return response()->json(['message' => 'Answer key deleted.']);
    }

    // Replace all items of a key (used by edit modal)
    public function replaceItems(Request $request, AnswerKey $answerKey): JsonResponse
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.section' => 'nullable|string|max:100',
            'items.*.item_number' => 'required|integer|min:1',
            'items.*.correct_answer' => ['required', Rule::in(['A', 'B', 'C', 'D', 'E'])],
            'items.*.points' => 'nullable|numeric|min:0',
        ]);

        DB::transaction(function () use ($answerKey, $data) {
            $answerKey->items()->delete();
            $answerKey->items()->createMany(
                array_map(fn ($i) => [
                    'section' => $i['section'] ?? null,
                    'item_number' => $i['item_number'],
                    'correct_answer' => $i['correct_answer'],
                    'points' => $i['points'] ?? 1.00,
                ], $data['items'])
            );
        });

        return response()->json($answerKey->load('items'));
    }
}