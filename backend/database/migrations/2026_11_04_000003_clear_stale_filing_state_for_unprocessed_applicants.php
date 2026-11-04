<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Before explicit filing existed, upload assigned a folder immediately.
        // Applicants without a result were never actually filed, so remove that
        // stale assignment and let the Result screen file them after a
        // successful scan.
        DB::table('tbl_examination_applicants')
            ->whereNotNull('folder_id')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('tbl_examination_results')
                    ->whereColumn('tbl_examination_results.applicant_id', 'tbl_examination_applicants.id');
            })
            ->update([
                'folder_id' => null,
                'filed_at' => null,
                'filed_by' => null,
            ]);
    }

    public function down(): void
    {
        // The original folder assignment cannot be reconstructed safely.
    }
};
