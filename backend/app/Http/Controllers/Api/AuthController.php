<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    private const ACCESS_TOKEN_NAME = 'access';

    /**
     * Name stamped on the long-lived refresh token. Checked on every exchange so
     * a short-lived access token can never be presented to /refresh and used to
     * mint fresh access tokens (which would defeat the expiry).
     */
    private const REFRESH_TOKEN_NAME = 'refresh';

    /** httpOnly cookie holding the browser refresh token. */
    private const REFRESH_COOKIE = 'refresh_token';

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => 'required|string',          // username or email
            'password' => 'required|string',
            'remember' => 'sometimes|boolean',     // persist the refresh cookie
            'client' => 'sometimes|string|in:web,mobile',
        ]);

        $user = User::where('username', $data['login'])
            ->orWhere('email', $data['login'])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'login' => ['Invalid credentials.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Account is deactivated.'], 403);
        }

        $user->update(['last_login' => now()]);

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'LOGIN',
            'ip_address' => $request->ip(),
        ]);

        return $this->issueTokens(
            $user,
            remember: (bool) ($data['remember'] ?? false),
            mobile: ($data['client'] ?? 'web') === 'mobile',
        );
    }

    /**
     * Exchange the browser's httpOnly cookie or a native app refresh token for
     * a new access token.
     *
     * Runs without auth:sanctum because the access token has expired by design.
     * The browser flow is CSRF-safe because the cookie is SameSite=lax, so a
     * cross-site POST never carries it. Native clients send the secret in the
     * JSON body instead of relying on platform cookie persistence.
     */
    public function refresh(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refresh_token' => 'sometimes|string',
        ]);
        $isMobile = isset($data['refresh_token']);
        $plain = $isMobile ? $data['refresh_token'] : $request->cookie(self::REFRESH_COOKIE);
        $token = $plain ? PersonalAccessToken::findToken($plain) : null;

        $valid = $token instanceof PersonalAccessToken
            && $token->name === self::REFRESH_TOKEN_NAME
            && ! ($token->expires_at && $token->expires_at->isPast());

        if (! $valid) {
            if (! $isMobile) {
                $this->forgetRefreshCookie(); // stop resending a dead cookie
            }

            return response()->json(['message' => 'Invalid or expired refresh token.'], 401);
        }

        $user = $token->tokenable;

        if (! $user || ! $user->is_active) {
            $token->delete();
            if (! $isMobile) {
                $this->forgetRefreshCookie();
            }

            return response()->json(['message' => 'Account is deactivated.'], 401);
        }

        // Rotate: burn the presented refresh token so a stolen cookie is
        // single-use, and hand back a fresh access + refresh pair.
        $token->delete();

        return $this->issueTokens($user, remember: true, mobile: $isMobile);
    }

    /** Revoke a native app session even when its short-lived access token expired. */
    public function mobileLogout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refresh_token' => 'required|string',
            'access_token' => 'sometimes|string',
        ]);
        $refreshToken = PersonalAccessToken::findToken($data['refresh_token']);
        $user = $refreshToken instanceof PersonalAccessToken
            && $refreshToken->name === self::REFRESH_TOKEN_NAME
                ? $refreshToken->tokenable
                : null;

        if ($user instanceof User) {
            $refreshToken->delete();

            if (isset($data['access_token'])) {
                $accessToken = PersonalAccessToken::findToken($data['access_token']);
                if ($accessToken instanceof PersonalAccessToken
                    && $accessToken->name === self::ACCESS_TOKEN_NAME
                    && $accessToken->tokenable_type === User::class
                    && $accessToken->tokenable_id === $user->id) {
                    $accessToken->delete();
                }
            }

            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'LOGOUT',
                'ip_address' => $request->ip(),
            ]);
        }

        // Always return the same response so this endpoint cannot be used to
        // discover whether a captured token is valid.
        return response()->json(['message' => 'Logged out.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'LOGOUT',
            'ip_address' => $request->ip(),
        ]);

        $user->currentAccessToken()?->delete();

        // End the whole session: also revoke the refresh token behind the cookie
        // so a refresh can't resurrect this login after logout.
        $plain = $request->cookie(self::REFRESH_COOKIE);
        if ($plain) {
            $cookieToken = PersonalAccessToken::findToken($plain);
            if ($cookieToken instanceof PersonalAccessToken
                && $cookieToken->name === self::REFRESH_TOKEN_NAME
                && $cookieToken->tokenable_id === $user->id) {
                $cookieToken->delete();
            }
        }
        $this->forgetRefreshCookie();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->safeUser($request->user()));
    }

    /**
     * Mint an access/refresh pair for $user. Browsers receive the refresh token
     * in an httpOnly cookie; native clients receive it in the response body for
     * storage in the operating system's secure credential store.
     */
    private function issueTokens(User $user, bool $remember, bool $mobile = false): JsonResponse
    {
        $access = $user->createToken(
            self::ACCESS_TOKEN_NAME,
            [self::ACCESS_TOKEN_NAME],
            now()->addMinutes(config('auth.access_token_ttl_minutes'))
        );

        $refreshExpiresAt = now()->addDays(config('auth.refresh_token_ttl_days'));

        $refresh = $user->createToken(
            self::REFRESH_TOKEN_NAME,
            [self::REFRESH_TOKEN_NAME],
            $refreshExpiresAt,
        );

        if (! $mobile) {
            $this->queueRefreshCookie($refresh->plainTextToken, $remember);
        }

        $payload = [
            'token' => $access->plainTextToken,
            'expires_at' => $access->accessToken->expires_at?->toIso8601String(),
            'user' => $this->safeUser($user),
        ];

        if ($mobile) {
            $payload['refresh_token'] = $refresh->plainTextToken;
            $payload['refresh_expires_at'] = $refreshExpiresAt->toIso8601String();
        }

        return response()->json($payload);
    }

    /**
     * @param  bool  $remember  when true the cookie persists for the configured TTL
     *                          (survives a browser restart); otherwise it is a
     *                          session cookie that dies with the browser, so the
     *                          next visit starts at the login screen.
     */
    private function queueRefreshCookie(string $plainTextToken, bool $remember): void
    {
        $minutes = config('auth.refresh_token_ttl_days') * 24 * 60;

        Cookie::queue(Cookie::make(
            self::REFRESH_COOKIE,
            $plainTextToken,
            $remember ? $minutes : 0, // 0 => session cookie when not remembered
            '/api',                   // scope to the API paths only (leading / per RFC 6265)
            null,                     // host-only: no cross-subdomain leak
            config('session.secure'), // Secure in production (HTTPS)
            true,                     // httpOnly: invisible to document.cookie
            false,
            'lax',                    // sent same-site; blocks cross-site POSTs
        ));
    }

    private function forgetRefreshCookie(): void
    {
        Cookie::queue(Cookie::forget(self::REFRESH_COOKIE, '/api'));
    }

    private function safeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'full_name' => $user->full_name,
            'role' => $user->role,
            'is_active' => $user->is_active,
            'last_login' => $user->last_login?->toIso8601String(),
        ];
    }
}
