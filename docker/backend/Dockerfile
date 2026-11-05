FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --optimize-autoloader \
    --prefer-dist

COPY . .
RUN composer dump-autoload --no-dev --no-scripts --optimize

FROM php:8.2-apache

# System deps
RUN apt-get update && apt-get install -y \
    libzip-dev unzip git curl libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# The development Compose file bind-mounts this directory. Production runs the
# same immutable image without a source-code mount.
COPY --from=vendor --chown=www-data:www-data /app /var/www/html

# Apache rewrite
RUN a2enmod rewrite

# Match Laravel's 10 MB answer-sheet validation limit. post_max_size includes
# multipart boundaries and form fields, so it must be slightly larger.
RUN printf 'upload_max_filesize=10M\npost_max_size=12M\n' > /usr/local/etc/php/conf.d/uploads.ini

# Serve Laravel's public/ as the document root (front-controller routing).
# The stock php:8.2-apache image points DocumentRoot at /var/www/html (the
# repo root) with AllowOverride None, which 404s every /api/* request.
RUN sed -i 's#DocumentRoot /var/www/html#DocumentRoot /var/www/html/public#' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's#<Directory /var/www/>#<Directory /var/www/html/public/>#' /etc/apache2/apache2.conf \
    && sed -i 's#AllowOverride None#AllowOverride All#' /etc/apache2/apache2.conf \
    && mkdir -p storage/app/private/answer_sheets storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
