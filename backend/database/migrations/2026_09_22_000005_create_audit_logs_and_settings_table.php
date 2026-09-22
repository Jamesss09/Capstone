<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SDD Table 6.0 - Audit Logs (tbl_audit_logs)
        Schema::create('tbl_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('tbl_users')->nullOnDelete();
            $table->string('action', 50);      // LOGIN | SCAN_ANSWER_SHEET | CREATE_USER | ...
            $table->string('table_name', 100)->nullable();
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });

        // SDD Table 10.0 - System Settings (tbl_settings)
        Schema::create('tbl_settings', function (Blueprint $table) {
            $table->id();
            $table->string('setting_key', 100)->unique();
            $table->text('setting_value');
            $table->string('description', 255)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('tbl_users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_settings');
        Schema::dropIfExists('tbl_audit_logs');
    }
};