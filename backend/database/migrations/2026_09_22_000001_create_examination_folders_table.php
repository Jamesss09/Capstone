<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SDD Table 7.0 - Examination Folders (tbl_examination_folders)
        Schema::create('tbl_examination_folders', function (Blueprint $table) {
            $table->id();
            $table->string('course', 100);
            $table->string('school_year', 50);
            $table->text('description')->nullable();
            $table->string('status', 50)->default('Active'); // Active | Archived
            $table->foreignId('created_by')->constrained('tbl_users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_examination_folders');
    }
};