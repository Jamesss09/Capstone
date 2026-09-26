<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Index created_at on the activity + results tables so the dashboard's
     * "System Activity" feed (ORDER BY created_at DESC LIMIT 10) and the
     * "scanned today" count (WHERE created_at = today) stay fast as rows grow.
     */
    public function up(): void
    {
        Schema::table('tbl_audit_logs', function (Blueprint $table) {
            $table->index('created_at');
        });

        Schema::table('tbl_examination_results', function (Blueprint $table) {
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_audit_logs', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::table('tbl_examination_results', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });
    }
};