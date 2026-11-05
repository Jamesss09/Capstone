<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProductionReadinessTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_is_rate_limited_after_five_attempts_per_minute(): void
    {
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/login', [
                'login' => 'unknown-user',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/login', [
            'login' => 'unknown-user',
            'password' => 'wrong-password',
        ])->assertTooManyRequests();
    }

    public function test_reseeding_does_not_reset_an_existing_admin_password(): void
    {
        $existingPassword = 'existing-secure-password';
        User::create([
            'username' => 'admin',
            'email' => 'existing@example.test',
            'password_hash' => Hash::make($existingPassword),
            'full_name' => 'Existing Administrator',
            'role' => 'Administrator',
            'is_active' => true,
        ]);

        $this->seed(DatabaseSeeder::class);

        $admin = User::where('username', 'admin')->firstOrFail();
        $this->assertTrue(Hash::check($existingPassword, $admin->password_hash));
    }
}
