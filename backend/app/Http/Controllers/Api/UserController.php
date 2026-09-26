<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(User::orderBy('id')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:100', 'unique:tbl_users,username'],
            'email' => ['required', 'email', 'max:100', 'unique:tbl_users,email'],
            'password' => ['required', 'string', 'min:8'],
            'full_name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(['Administrator', 'Staff'])],
            'is_active' => ['boolean'],
        ]);

        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password_hash' => Hash::make($data['password']),
            'full_name' => $data['full_name'],
            'role' => $data['role'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_USER',
            'table_name' => 'tbl_users',
            'record_id' => $user->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($user, 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'username' => ['sometimes', 'string', 'max:100', Rule::unique('tbl_users', 'username')->ignore($user->id)],
            'email' => ['sometimes', 'email', 'max:100', Rule::unique('tbl_users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'full_name' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', Rule::in(['Administrator', 'Staff'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['password'])) {
            $data['password_hash'] = Hash::make($data['password']);
            unset($data['password']);
        }

        $user->update($data);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_USER',
            'table_name' => 'tbl_users',
            'record_id' => $user->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json($user);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'DELETE_USER',
            'table_name' => 'tbl_users',
            'record_id' => $user->id,
            'ip_address' => $request->ip(),
        ]);

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}