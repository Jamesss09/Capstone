<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SDD Table 8.0 - Examination Result (tbl_examination_results).
        // Course is a per-result attribute (chosen at examination time), not a
        // property of the school-year folder, so it lives on the result row.
        Schema::table('tbl_examination_results', function (Blueprint $table) {
            $table->string('course', 100)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_examination_results', function (Blueprint $table) {
            $table->dropColumn('course');
        });
    }
};
