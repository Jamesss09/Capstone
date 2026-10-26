<?php

return [
    /*
     * Canonical identifiers shared with omr/core/templates/tmc_v1.json.
     * Database records store the array key; display names are UI-only.
     */
    'sections' => [
        'inductive' => [
            'display' => 'Inductive / Logical Test',
            'items' => 10,
            'options' => 5,
            'aliases' => ['Inductive/Logical Test', 'Inductive Logical Test'],
        ],
        'math' => [
            'display' => 'Mathematics',
            'items' => 30,
            'options' => 4,
            'aliases' => ['Math'],
        ],
        'english' => [
            'display' => 'English',
            'items' => 30,
            'options' => 4,
            'aliases' => [],
        ],
        'science' => [
            'display' => 'Science & Technology',
            'items' => 20,
            'options' => 4,
            'aliases' => ['Science and Technology'],
        ],
        'aptitude' => [
            'display' => 'Aptitude',
            'items' => 10,
            'options' => 4,
            'aliases' => [],
        ],
    ],
];
