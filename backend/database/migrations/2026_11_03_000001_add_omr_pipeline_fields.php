<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_answer_sheets', function (Blueprint $table) {
            $table->string('storage_disk', 20)->default('public')->after('image_path');
            $table->json('recognition_metadata')->nullable()->after('processed_at');
        });

        Schema::table('tbl_applicant_answers', function (Blueprint $table) {
            $table->string('recognition_status', 20)->default('answered')->after('marked_answer');
            $table->decimal('confidence', 8, 7)->nullable()->after('recognition_status');
            $table->json('flags')->nullable()->after('confidence');
            $table->decimal('points_awarded', 8, 2)->default(0)->after('is_correct');
            $table->decimal('points_possible', 8, 2)->default(1)->after('points_awarded');
        });

        Schema::table('tbl_examination_results', function (Blueprint $table) {
            $table->decimal('earned_points', 8, 2)->default(0)->after('score');
            $table->decimal('total_points', 8, 2)->default(100)->after('earned_points');
            $table->unsignedInteger('answered_count')->default(0)->after('incorrect_count');
            $table->unsignedInteger('blank_count')->default(0)->after('answered_count');
            $table->unsignedInteger('invalid_count')->default(0)->after('blank_count');
            $table->unsignedInteger('low_confidence_count')->default(0)->after('invalid_count');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_examination_results', function (Blueprint $table) {
            $table->dropColumn([
                'earned_points',
                'total_points',
                'answered_count',
                'blank_count',
                'invalid_count',
                'low_confidence_count',
            ]);
        });

        Schema::table('tbl_applicant_answers', function (Blueprint $table) {
            $table->dropColumn([
                'recognition_status',
                'confidence',
                'flags',
                'points_awarded',
                'points_possible',
            ]);
        });

        Schema::table('tbl_answer_sheets', function (Blueprint $table) {
            $table->dropColumn(['storage_disk', 'recognition_metadata']);
        });
    }
};
