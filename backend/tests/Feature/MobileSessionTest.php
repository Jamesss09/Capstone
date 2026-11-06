<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Support\CreatesOmrFixtures;
use Tests\TestCase;

class MobileSessionTest extends TestCase
{
    use CreatesOmrFixtures;
    use RefreshDatabase;

    public function test_mobile_login_returns_a_rotating_refresh_token_without_changing_the_web_cookie_contract(): void
    {
        $user = $this->omrUser();

        $mobile = $this->postJson('/api/login', [
            'login' => $user->username,
            'password' => 'password',
            'remember' => true,
            'client' => 'mobile',
        ]);

        $mobile->assertOk()
            ->assertCookieMissing('refresh_token')
            ->assertJsonStructure([
                'token',
                'expires_at',
                'refresh_token',
                'refresh_expires_at',
                'user' => ['id', 'username', 'role'],
            ]);

        $web = $this->postJson('/api/login', [
            'login' => $user->username,
            'password' => 'password',
            'remember' => true,
        ]);

        $web->assertOk()
            ->assertCookie('refresh_token')
            ->assertJsonMissingPath('refresh_token')
            ->assertJsonMissingPath('refresh_expires_at');
    }

    public function test_mobile_refresh_rotates_the_refresh_token_and_rejects_reuse(): void
    {
        $user = $this->omrUser();
        $login = $this->postJson('/api/login', [
            'login' => $user->username,
            'password' => 'password',
            'client' => 'mobile',
        ])->assertOk();
        $oldRefreshToken = $login->json('refresh_token');

        $refresh = $this->postJson('/api/refresh', [
            'refresh_token' => $oldRefreshToken,
        ]);

        $refresh->assertOk()
            ->assertJsonStructure(['token', 'expires_at', 'refresh_token', 'refresh_expires_at', 'user']);
        $this->assertNotSame($oldRefreshToken, $refresh->json('refresh_token'));
        $this->assertNull(PersonalAccessToken::findToken($oldRefreshToken));

        $this->postJson('/api/refresh', [
            'refresh_token' => $oldRefreshToken,
        ])->assertUnauthorized();
    }

    public function test_web_refresh_cookie_flow_still_rotates_without_exposing_the_secret(): void
    {
        $user = $this->omrUser();
        $login = $this->postJson('/api/login', [
            'login' => $user->username,
            'password' => 'password',
            'remember' => true,
        ])->assertOk()->assertCookie('refresh_token');
        $cookie = $login->getCookie('refresh_token');

        $refresh = $this->withCredentials()
            ->withCookie('refresh_token', $cookie->getValue())
            ->postJson('/api/refresh');

        $refresh->assertOk()
            ->assertCookie('refresh_token')
            ->assertJsonStructure(['token', 'expires_at', 'user'])
            ->assertJsonMissingPath('refresh_token')
            ->assertJsonMissingPath('refresh_expires_at');
        $this->withToken($refresh->json('token'))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('id', $user->id);
    }

    public function test_refresh_token_cannot_be_used_as_an_api_access_token(): void
    {
        $user = $this->omrUser();
        $login = $this->postJson('/api/login', [
            'login' => $user->username,
            'password' => 'password',
            'client' => 'mobile',
        ])->assertOk();

        $this->withToken($login->json('refresh_token'))
            ->getJson('/api/me')
            ->assertForbidden();
    }

    public function test_mobile_logout_revokes_both_tokens_even_after_access_expiry(): void
    {
        $user = $this->omrUser();
        $login = $this->postJson('/api/login', [
            'login' => $user->username,
            'password' => 'password',
            'client' => 'mobile',
        ])->assertOk();
        $accessToken = $login->json('token');
        $refreshToken = $login->json('refresh_token');

        PersonalAccessToken::findToken($accessToken)?->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/mobile/logout', [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
        ])->assertOk()->assertJsonPath('message', 'Logged out.');

        $this->assertNull(PersonalAccessToken::findToken($accessToken));
        $this->assertNull(PersonalAccessToken::findToken($refreshToken));
        $this->postJson('/api/refresh', [
            'refresh_token' => $refreshToken,
        ])->assertUnauthorized();
    }
}
