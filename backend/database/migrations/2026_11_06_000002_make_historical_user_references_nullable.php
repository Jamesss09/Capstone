<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, string> */
    private array $references = [
        'tbl_examination_folders' => 'created_by',
        'tbl_answer_keys' => 'created_by',
        'tbl_examination_applicants' => 'created_by',
        'tbl_examination_results' => 'computed_by',
        'tbl_omr_processing_jobs' => 'user_id',
    ];

    public function up(): void
    {
        foreach ($this->references as $tableName => $columnName) {
            Schema::table($tableName, function (Blueprint $table) use ($columnName) {
                $table->dropForeign([$columnName]);
                $table->unsignedBigInteger($columnName)->nullable()->change();
                $table->foreign($columnName)->references('id')->on('tbl_users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->references as $tableName => $columnName) {
            if (DB::table($tableName)->whereNull($columnName)->exists()) {
                throw new RuntimeException(
                    "Cannot restore the required {$tableName}.{$columnName} reference after a user was deleted."
                );
            }

            Schema::table($tableName, function (Blueprint $table) use ($columnName) {
                $table->dropForeign([$columnName]);
                $table->unsignedBigInteger($columnName)->nullable(false)->change();
                $table->foreign($columnName)->references('id')->on('tbl_users');
            });
        }
    }
};
