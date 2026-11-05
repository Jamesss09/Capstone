<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $adminPassword = $this->initialPassword('INITIAL_ADMIN_PASSWORD', 'admin123');
        $staffPassword = $this->initialPassword('INITIAL_STAFF_PASSWORD', 'staff123');

        $this->seedUser(
            'admin',
            'admin@codenexus.local',
            'System Administrator',
            'Administrator',
            $adminPassword,
        );
        $this->seedUser(
            'staff',
            'staff@codenexus.local',
            'Entrance Examination Staff',
            'Staff',
            $staffPassword,
        );

        // System-wide settings
        Setting::updateOrCreate(
            ['setting_key' => 'system_name'],
            ['setting_value' => 'Code Nexus', 'description' => 'Display name of the system.']
        );
        Setting::updateOrCreate(
            ['setting_key' => 'max_retries'],
            ['setting_value' => '3', 'description' => 'Max OMR processing retries.']
        );
    }

    private function initialPassword(string $name, string $localDefault): string
    {
        $password = (string) env($name, app()->environment('production') ? '' : $localDefault);
        if ($password === '' || (app()->environment('production') && strlen($password) < 12)) {
            throw new RuntimeException("{$name} must contain at least 12 characters.");
        }

        return $password;
    }

    private function seedUser(
        string $username,
        string $email,
        string $fullName,
        string $role,
        string $password,
    ): void {
        $user = User::firstOrNew(['username' => $username]);
        $user->fill([
            'email' => $email,
            'full_name' => $fullName,
            'role' => $role,
            'is_active' => true,
        ]);
        if (! $user->exists) {
            $user->password_hash = Hash::make($password);
        }
        $user->save();
    }
}
