<?php

use Illuminate\Support\Facades\Route;

// Route::view keeps web.php closure-free so `php artisan optimize` (route
// cache) can serialize routes — big boot-time win on the dev server.
Route::view('/', 'welcome');
