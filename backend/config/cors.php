<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | The refresh token is an httpOnly cookie, so the browser only stores it if
    | the request is made with credentials. Two consequences:
    |
    | 1. "supports_credentials" must be true, otherwise the cookie is dropped.
    | 2. "allowed_origins" can no longer be "*" — the CORS spec forbids a
    |    wildcard once credentials are allowed, so the frontend origins have to
    |    be listed explicitly. Set CORS_ALLOWED_ORIGINS in .env.
    |
    | SameSite note: the cookie is sent as "lax", which browsers allow because
    | the SPA and this API share the same host (localhost:5173 -> localhost:8000
    | is same-site; only the port differs). Keep the hostnames aligned.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];