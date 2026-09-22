<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SDD Table 12.0 - Exam Applicants (tbl_examination_applicants)
        Schema::create('tbl_examination_applicants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('folder_id')->constrained('tbl_examination_folders');
            $table->foreignId('answer_key_id')->constrained('tbl_answer_keys');
            $table->string('applicant_name', 255);
            $table->date('examination_date');
            $table->string('status', 50)->default('Pending'); // Pending | Processed
            $table->foreignId('created_by')->constrained('tbl_users');
            $table->timestamps();
        });

        // SDD Table 4.0 - Answer Sheets (tbl_answer_sheets)
        Schema::create('tbl_answer_sheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('applicant_id')->constrained('tbl_examination_applicants')->cascadeOnDelete();
            $table->string('image_path', 255);
            $table->string('image_hash', 255)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        // SDD Table 5.0 - Applicant Answers (tbl_applicant_answers)
        Schema::create('tbl_applicant_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sheet_id')->constrained('tbl_answer_sheets')->cascadeOnDelete();
            $table->string('section', 100)->default('');   // sections restart item numbers at 1
            $table->unsignedInteger('item_number');
            $table->string('marked_answer', 5)->nullable(); // 'A'..'E' or null when blank
            $table->boolean('is_correct')->default(false);
            $table->timestamps();

            $table->unique(['sheet_id', 'section', 'item_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_applicant_answers');
        Schema::dropIfExists('tbl_answer_sheets');
        Schema::dropIfExists('tbl_examination_applicants');
    }
};