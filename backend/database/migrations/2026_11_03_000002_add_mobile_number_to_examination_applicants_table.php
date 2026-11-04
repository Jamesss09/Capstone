<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->string('mobile_number', 30)->nullable()->after('applicant_name');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->dropColumn('mobile_number');
        });
    }
};
