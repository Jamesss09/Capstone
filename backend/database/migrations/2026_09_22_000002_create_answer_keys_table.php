<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SDD Table 3.0 - Answer Keys (tbl_answer_keys)
        Schema::create('tbl_answer_keys', function (Blueprint $table) {
            $table->id();
            $table->string('exam_title', 255);
            $table->decimal('passing_score', 5, 2);
            $table->string('school_year', 50);
            $table->string('status', 50)->default('Active'); // Active | Inactive
            $table->string('file_path', 255)->nullable();
            $table->foreignId('created_by')->constrained('tbl_users');
            $table->timestamps();
        });

        // SDD Table 2.0 - Answer Key Items (tbl_answer_key_items)
        Schema::create('tbl_answer_key_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('answer_key_id')->constrained('tbl_answer_keys')->cascadeOnDelete();
            $table->string('section', 100)->default('');   // e.g. 'Inductive / Logical Test', 'Mathematics'
            $table->unsignedInteger('item_number');
            $table->string('correct_answer', 5);          // 'A','B','C','D','E'
            $table->decimal('points', 5, 2)->default(1.00);
            $table->timestamps();

            $table->unique(['answer_key_id', 'section', 'item_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_answer_key_items');
        Schema::dropIfExists('tbl_answer_keys');
    }
};