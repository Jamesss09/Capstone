param(
    [string]$ComposeFile = "docker-compose.production.yml",
    [string]$EnvFile = ".env.production",
    [string]$Destination = "backups"
)

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $Destination $stamp
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

$compose = @("compose", "--env-file", $EnvFile, "-f", $ComposeFile)
$mysqlContainer = (& docker @compose ps -q mysql).Trim()
$backendContainer = (& docker @compose ps -q backend).Trim()
if (-not $mysqlContainer -or -not $backendContainer) {
    throw "The mysql and backend services must be running before a backup can be created."
}

$databaseArchive = Join-Path $backupDirectory "database.sql"
$privateArchive = Join-Path $backupDirectory "private-storage.tar.gz"

try {
    & docker exec $mysqlContainer sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --routines --triggers --no-tablespaces -uroot "$MYSQL_DATABASE" > /tmp/code-nexus-database.sql'
    if ($LASTEXITCODE -ne 0) { throw "Database backup failed." }
    & docker cp "${mysqlContainer}:/tmp/code-nexus-database.sql" $databaseArchive
    if ($LASTEXITCODE -ne 0) { throw "Could not copy the database backup." }

    & docker exec $backendContainer sh -lc 'tar -C /var/www/html/storage/app/private -czf /tmp/code-nexus-private-storage.tar.gz .'
    if ($LASTEXITCODE -ne 0) { throw "Private-storage backup failed." }
    & docker cp "${backendContainer}:/tmp/code-nexus-private-storage.tar.gz" $privateArchive
    if ($LASTEXITCODE -ne 0) { throw "Could not copy the private-storage backup." }
} finally {
    & docker exec $mysqlContainer rm -f /tmp/code-nexus-database.sql 2>$null
    & docker exec $backendContainer rm -f /tmp/code-nexus-private-storage.tar.gz 2>$null
}

$hashes = @(
    "{0}  database.sql" -f (Get-FileHash $databaseArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    "{0}  private-storage.tar.gz" -f (Get-FileHash $privateArchive -Algorithm SHA256).Hash.ToLowerInvariant()
)
$hashes | Set-Content -Encoding ascii (Join-Path $backupDirectory "SHA256SUMS.txt")

[ordered]@{
    created_at = (Get-Date).ToUniversalTime().ToString("o")
    compose_file = $ComposeFile
    database_bytes = (Get-Item $databaseArchive).Length
    private_storage_bytes = (Get-Item $privateArchive).Length
} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $backupDirectory "metadata.json")

Write-Output "Backup created: $backupDirectory"
