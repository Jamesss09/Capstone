<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Scanned applicants stay unfiled until staff explicitly save the
        // completed result to an active school-year folder from the Result
        // screen.
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->foreignId('folder_id')->nullable()->change();
            $table->foreignId('filed_by')->nullable()->after('folder_id')->constrained('tbl_users')->nullOnDelete();
            $table->timestamp('filed_at')->nullable()->after('filed_by');
        });

        // Applicants created before explicit filing already belong to a
        // folder, so treat them as filed to keep their state consistent.
        DB::table('tbl_examination_applicants')
            ->whereNotNull('folder_id')
            ->whereNull('filed_at')
            ->update([
                'filed_at' => DB::raw('updated_at'),
                'filed_by' => DB::raw('created_by'),
            ]);
    }

    public function down(): void
    {
        Schema::table('tbl_examination_applicants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('filed_by');
            $table->dropColumn('filed_at');
        });
    }
};
