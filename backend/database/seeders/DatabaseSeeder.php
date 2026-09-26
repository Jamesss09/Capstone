<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Default Administrator (initial login)
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'email' => 'admin@codenexus.local',
                'password_hash' => Hash::make('admin123'),
                'full_name' => 'System Administrator',
                'role' => 'Administrator',
                'is_active' => true,
            ]
        );

        // Default Staff account
        User::updateOrCreate(
            ['username' => 'staff'],
            [
                'email' => 'staff@codenexus.local',
                'password_hash' => Hash::make('staff123'),
                'full_name' => 'Entrance Examination Staff',
                'role' => 'Staff',
                'is_active' => true,
            ]
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
}