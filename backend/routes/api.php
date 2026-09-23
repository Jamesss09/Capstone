<?php

use App\Http\Controllers\Api\AnswerKeyController;
use App\Http\Controllers\Api\ApplicantController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExaminationFolderController;
use App\Http\Controllers\Api\OmrJobController;
use App\Http\Controllers\Api\ResultController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public: staff & admin login
Route::post('/login', [AuthController::class, 'login']);

// Authenticated
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Admin-only: user management (RBAC hard constraint)
    Route::middleware('role:Administrator')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::apiResource('answer-keys', AnswerKeyController::class);
        Route::post('answer-keys/{answer_key}/activate', [AnswerKeyController::class, 'activate']);
        Route::post('answer-keys/{answer_key}/deactivate', [AnswerKeyController::class, 'deactivate']);
        Route::put('answer-keys/{answer_key}/items', [AnswerKeyController::class, 'replaceItems']);
        Route::apiResource('settings', SettingController::class);
        Route::get('audit-logs', [AuditLogController::class, 'index']);
    });

    // Admin-only: folders (result management)
    Route::middleware('role:Administrator')->group(function () {
        Route::apiResource('folders', ExaminationFolderController::class);
    });

    // Staff: upload sheet + OMR job queue
    Route::post('sheets/upload', [OmrJobController::class, 'upload']);
    Route::get('omr-jobs/{job}', [OmrJobController::class, 'status']);

    // Both roles: applicants (create) & results (view)
    Route::apiResource('applicants', ApplicantController::class);
    Route::apiResource('results', ResultController::class)->only(['index', 'show']);

    // Dashboard stats (Admin)
    Route::get('dashboard', DashboardController::class)->middleware('role:Administrator');
});