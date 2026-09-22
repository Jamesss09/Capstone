<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SDD Table 8.0 - Examination Result (tbl_examination_results)
        Schema::create('tbl_examination_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('applicant_id')->constrained('tbl_examination_applicants')->cascadeOnDelete();
            $table->foreignId('answer_key_id')->constrained('tbl_answer_keys');
            $table->decimal('score', 5, 2);
            $table->string('status', 50);                 // Passed | Failed
            $table->unsignedInteger('total_items');
            $table->unsignedInteger('correct_count');
            $table->unsignedInteger('incorrect_count');
            $table->decimal('passing_score', 5, 2);
            $table->foreignId('computed_by')->constrained('tbl_users');
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
        });

        // SDD Table 9.0 - OMR Processing Jobs (tbl_omr_processing_jobs)
        Schema::create('tbl_omr_processing_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sheet_id')->constrained('tbl_answer_sheets')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('tbl_users');
            $table->string('status', 50)->default('Queued'); // Queued | Processing | Completed | Failed
            $table->unsignedInteger('queue_position')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_omr_processing_jobs');
        Schema::dropIfExists('tbl_examination_results');
    }
};