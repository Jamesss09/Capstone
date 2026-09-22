<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Setting::orderBy('setting_key')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'setting_key' => 'required|string|max:100|unique:tbl_settings,setting_key',
            'setting_value' => 'required|string',
            'description' => 'nullable|string|max:255',
        ]);

        $setting = Setting::create([
            ...$data,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($setting, 201);
    }

    public function update(Request $request, Setting $setting): JsonResponse
    {
        $data = $request->validate([
            'setting_value' => 'required|string',
            'description' => 'nullable|string|max:255',
        ]);

        $setting->update([...$data, 'updated_by' => $request->user()->id]);

        return response()->json($setting->fresh());
    }

    public function destroy(Request $request, Setting $setting): JsonResponse
    {
        $setting->delete();

        return response()->json(['message' => 'Setting deleted.']);
    }
}