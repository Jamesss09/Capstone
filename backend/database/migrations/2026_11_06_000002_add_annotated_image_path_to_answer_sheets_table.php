<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_answer_sheets', function (Blueprint $table) {
            $table->string('annotated_image_path', 255)
                ->nullable()
                ->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_answer_sheets', function (Blueprint $table) {
            $table->dropColumn('annotated_image_path');
        });
    }
};
