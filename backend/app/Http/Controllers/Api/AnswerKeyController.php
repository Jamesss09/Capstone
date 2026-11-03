<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnswerKey;
use App\Models\AuditLog;
use App\Services\Omr\AnswerKeyPayloadFactory;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AnswerKeyController extends Controller
{
    public function __construct(private readonly AnswerKeyPayloadFactory $payloadFactory) {}

    public function index(): JsonResponse
    {
        return response()->json(
            AnswerKey::withCount('items')
                ->with(['creator:id,full_name', 'items:answer_key_id,section'])
                ->latest()
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'exam_title' => 'required|string|max:255',
            'passing_score' => 'required|numeric|between:0,100',
            'school_year' => 'required|string|max:50',
            'status' => 'prohibited',
            'file_path' => 'nullable|string|max:255',
            'items' => 'sometimes|array',
            'items.*.section' => 'required|string|max:100',
            'items.*.item_number' => 'required|integer|min:1',
            'items.*.correct_answer' => ['required', Rule::in(['A', 'B', 'C', 'D', 'E'])],
            'items.*.points' => 'nullable|numeric|min:0',
        ]);
        $data['items'] = $this->normalizeItems($data['items'] ?? []);

        $key = DB::transaction(function () use ($data, $request) {
            $key = AnswerKey::create([
                'exam_title' => $data['exam_title'],
                'passing_score' => $data['passing_score'],
                'school_year' => $data['school_year'],
                'status' => 'Inactive',
                'file_path' => $data['file_path'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            if (! empty($data['items'])) {
                $key->items()->createMany(
                    array_map(fn ($i) => [
                        'section' => $i['section'],
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
            'status' => 'prohibited',
            'file_path' => 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($answerKey, $data) {
            $lockedKey = AnswerKey::query()->lockForUpdate()->findOrFail($answerKey->id);
            $this->ensureMutable($lockedKey);
            $lockedKey->update($data);
        });

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
        DB::transaction(function () use ($request, $answerKey) {
            $lockedKey = AnswerKey::query()->lockForUpdate()->findOrFail($answerKey->id);
            $this->ensureMutable($lockedKey);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'DELETE_ANSWER_KEY',
                'table_name' => 'tbl_answer_keys',
                'record_id' => $lockedKey->id,
                'ip_address' => $request->ip(),
            ]);
            $lockedKey->delete();
        });

        return response()->json(['message' => 'Answer key deleted.']);
    }

    // Set this key as the single Active key (all others become Inactive)
    public function activate(Request $request, AnswerKey $answerKey): JsonResponse
    {
        // Use query-builder updates so the target key always flips to Active even
        // when it was already Active in memory (Eloquent's dirty check would skip
        // the update and leave the key deactivated by the blanket query above).
        try {
            DB::transaction(function () use ($answerKey) {
                AnswerKey::query()->lockForUpdate()->get();
                $lockedKey = AnswerKey::query()->with('items')->findOrFail($answerKey->id);
                $this->payloadFactory->make($lockedKey);

                AnswerKey::where('status', 'Active')->update(['status' => 'Inactive']);
                AnswerKey::whereKey($lockedKey->id)->update(['status' => 'Active']);
            });
        } catch (DomainException $exception) {
            throw ValidationException::withMessages([
                'items' => [$exception->getMessage()],
            ]);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'ACTIVATE_ANSWER_KEY',
            'table_name' => 'tbl_answer_keys',
            'record_id' => $answerKey->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($answerKey->fresh('items'));
    }

    // Toggle a key off. At most one key is Active at a time (enforced by
    // activate()); deactivating is idempotent.
    public function deactivate(Request $request, AnswerKey $answerKey): JsonResponse
    {
        AnswerKey::whereKey($answerKey->id)->update(['status' => 'Inactive']);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'DEACTIVATE_ANSWER_KEY',
            'table_name' => 'tbl_answer_keys',
            'record_id' => $answerKey->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($answerKey->fresh('items'));
    }

    // Replace all items of a key (used by edit modal)
    public function replaceItems(Request $request, AnswerKey $answerKey): JsonResponse
    {
        $data = $request->validate([
            'items' => 'required|array',
            'items.*.section' => 'required|string|max:100',
            'items.*.item_number' => 'required|integer|min:1',
            'items.*.correct_answer' => ['required', Rule::in(['A', 'B', 'C', 'D', 'E'])],
            'items.*.points' => 'nullable|numeric|min:0',
        ]);
        $data['items'] = $this->normalizeItems($data['items']);

        DB::transaction(function () use ($answerKey, $data) {
            $lockedKey = AnswerKey::query()->lockForUpdate()->findOrFail($answerKey->id);
            $this->ensureMutable($lockedKey);
            $lockedKey->items()->delete();
            $lockedKey->items()->createMany(
                array_map(fn ($i) => [
                    'section' => $i['section'],
                    'item_number' => $i['item_number'],
                    'correct_answer' => $i['correct_answer'],
                    'points' => $i['points'] ?? 1.00,
                ], $data['items'])
            );
        });

        return response()->json($answerKey->load('items'));
    }

    /**
     * Convert known display-name aliases to the template/DB identifier and
     * reject invalid section, item-number, or option combinations.
     *
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     *
     * @throws ValidationException
     */
    private function normalizeItems(array $items): array
    {
        $sections = config('omr_sections.sections');
        $aliases = [];

        foreach ($sections as $id => $section) {
            foreach (array_merge([$id, $section['display']], $section['aliases']) as $alias) {
                $aliases[$this->sectionKey($alias)] = $id;
            }
        }

        $errors = [];
        $seen = [];

        foreach ($items as $index => &$item) {
            $path = "items.{$index}";
            $id = $aliases[$this->sectionKey((string) $item['section'])] ?? null;

            if ($id === null) {
                $errors["{$path}.section"] = ['Use one of: '.implode(', ', array_keys($sections)).'.'];

                continue;
            }

            $section = $sections[$id];
            $itemNumber = (int) $item['item_number'];
            $answer = (string) $item['correct_answer'];
            $allowedAnswers = array_slice(['A', 'B', 'C', 'D', 'E'], 0, $section['options']);

            if ($itemNumber > $section['items']) {
                $errors["{$path}.item_number"] = ["{$section['display']} has items 1–{$section['items']}. "];
            }

            if (! in_array($answer, $allowedAnswers, true)) {
                $errors["{$path}.correct_answer"] = [
                    "{$section['display']} accepts only ".implode('–', [reset($allowedAnswers), end($allowedAnswers)]).'.',
                ];
            }

            $key = "{$id}:{$itemNumber}";
            if (isset($seen[$key])) {
                $errors["{$path}.item_number"] = ['Each section may contain an item number only once.'];
            }
            $seen[$key] = true;
            $item['section'] = $id;
        }
        unset($item);

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $items;
    }

    private function sectionKey(string $value): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower(trim($value))) ?? '';
    }

    private function ensureMutable(AnswerKey $answerKey): void
    {
        abort_if(
            $answerKey->applicants()->exists(),
            409,
            'This answer key is already assigned to an applicant and can no longer be edited or deleted.'
        );
    }
}
