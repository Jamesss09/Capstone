<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExaminationApplicant;
use App\Models\ExaminationFolder;
use App\Models\AnswerKey;
use App\Models\ExaminationResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'applicant_total' => ExaminationApplicant::count(),
            'applicant_pending' => ExaminationApplicant::where('status', 'Pending')->count(),
            'applicant_processed' => ExaminationApplicant::where('status', 'Processed')->count(),
            'examination_count' => AnswerKey::count(),
            'folder_count' => ExaminationFolder::count(),
            'passed' => ExaminationResult::where('status', 'Passed')->count(),
            'failed' => ExaminationResult::where('status', 'Failed')->count(),
            'pass_rate_percent' => $this->passRate(),
            'recent_activities' => \App\Models\AuditLog::with('user:id,full_name')->latest()->limit(10)->get(),
        ]);
    }

    private function passRate(): ?float
    {
        $total = ExaminationResult::count();
        if ($total === 0) {
            return null;
        }
        $passed = ExaminationResult::where('status', 'Passed')->count();

        return round(($passed / $total) * 100, 2);
    }
}