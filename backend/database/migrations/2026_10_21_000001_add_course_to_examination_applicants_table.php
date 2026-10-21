<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Course is chosen by staff when the applicant is identified on the
        // mobile scanner. The examination result snapshots this value when the
        // result is written, so the admin results table/export can show it.
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->string('course', 100)->nullable()->after('student_type');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->dropColumn('course');
        });
    }
};
