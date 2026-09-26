<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Answer sheet header carries a student-type marker (NEW / TRANSFEREE /
        // OLD / RETURNEE) — store it so results can be filtered by student type.
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->string('student_type', 50)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->dropColumn('student_type');
        });
    }
};