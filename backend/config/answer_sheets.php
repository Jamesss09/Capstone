<?php

return [
    /*
    | Processed source images are sensitive and are retained only for the
    | approved review window. Structured answers, scores, and diagnostics are
    | stored separately and remain available after the image is removed.
    */
    'retention_days' => (int) env('ANSWER_SHEET_RETENTION_DAYS', 365),
];
