<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $sections = config('omr_sections.sections');
        $aliases = [];

        foreach ($sections as $id => $section) {
            foreach (array_merge([$id, $section['display']], $section['aliases']) as $alias) {
                $aliases[$this->key($alias)] = $id;
            }
        }

        DB::transaction(function () use ($aliases): void {
            $items = DB::table('tbl_answer_key_items')
                ->select(['id', 'answer_key_id', 'section', 'item_number'])
                ->orderBy('id')
                ->get();

            foreach ($items as $item) {
                $section = $aliases[$this->key($item->section)] ?? null;

                if ($section === null) {
                    throw new RuntimeException(
                        "Cannot migrate answer-key item {$item->id}: unknown section '{$item->section}'."
                    );
                }

                if ($section === $item->section) {
                    continue;
                }

                $duplicate = DB::table('tbl_answer_key_items')
                    ->where('answer_key_id', $item->answer_key_id)
                    ->where('section', $section)
                    ->where('item_number', $item->item_number)
                    ->where('id', '!=', $item->id)
                    ->exists();

                if ($duplicate) {
                    throw new RuntimeException(
                        "Cannot migrate answer-key item {$item->id}: canonical section '{$section}' duplicates item {$item->item_number}."
                    );
                }

                DB::table('tbl_answer_key_items')->where('id', $item->id)->update(['section' => $section]);
            }
        });
    }

    public function down(): void
    {
        // This data migration is intentionally not reversed: original aliases
        // cannot be recovered without risking duplicate section/item rows.
    }

    private function key(string $value): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower(trim($value))) ?? '';
    }
};
