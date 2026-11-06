<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccessToken
{
    /** Prevent a long-lived refresh credential from authorizing API actions. */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user?->is_active) {
            $user?->tokens()->delete();

            return response()->json(['message' => 'Account is deactivated.'], 401);
        }

        $token = $user->currentAccessToken();

        // Persisted bearer tokens must be the short-lived access kind. Sanctum
        // may instead provide a TransientToken for first-party cookie auth.
        if ($token instanceof PersonalAccessToken
            && $token->exists
            && $token->name !== 'access') {
            return response()->json(['message' => 'Forbidden token type.'], 403);
        }

        return $next($request);
    }
}
