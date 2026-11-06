<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_answer_sheets', function (Blueprint $table) {
            $table->string('image_path', 255)->nullable()->change();
            $table->timestamp('image_deleted_at')->nullable()->after('processed_at')->index();
            $table->index('processed_at');
        });
    }

    public function down(): void
    {
        DB::table('tbl_answer_sheets')->whereNull('image_path')->update(['image_path' => '']);

        Schema::table('tbl_answer_sheets', function (Blueprint $table) {
            $table->dropIndex(['processed_at']);
            $table->dropIndex(['image_deleted_at']);
            $table->dropColumn('image_deleted_at');
            $table->string('image_path', 255)->nullable(false)->change();
        });
    }
};
