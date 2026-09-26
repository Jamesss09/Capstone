<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Latest System Activity for the admin dashboard's live feed.
 * Kept as its own endpoint so the feed never gates the /dashboard payload —
 * stats paint first, the feed fills in beside it.
 */
class ActivityController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json(
            AuditLog::with('user:id,full_name,is_active')
                ->whereIn('action', [
                    'CREATE_ANSWER_KEY',
                    'UPDATE_ANSWER_KEY',
                    'ACTIVATE_ANSWER_KEY',
                    'DEACTIVATE_ANSWER_KEY',
                    'DELETE_ANSWER_KEY',
                ])
                ->whereHas('user', fn ($q) => $q->where('is_active', true))
                ->latest()
                ->limit(10)
                ->get()
        );
    }
}