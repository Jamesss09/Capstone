param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDirectory,
    [string]$ComposeFile = "docker-compose.production.yml",
    [string]$EnvFile = ".env.production"
)

$ErrorActionPreference = "Stop"
$databaseArchive = Join-Path $BackupDirectory "database.sql"
$privateArchive = Join-Path $BackupDirectory "private-storage.tar.gz"
$hashFile = Join-Path $BackupDirectory "SHA256SUMS.txt"
foreach ($file in @($databaseArchive, $privateArchive, $hashFile)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing backup file: $file" }
}

$expected = @{}
foreach ($line in Get-Content $hashFile) {
    if ($line -match '^([0-9a-fA-F]{64})\s+(.+)$') { $expected[$Matches[2]] = $Matches[1].ToLowerInvariant() }
}
foreach ($name in @("database.sql", "private-storage.tar.gz")) {
    $actual = (Get-FileHash (Join-Path $BackupDirectory $name) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected[$name] -ne $actual) { throw "SHA-256 verification failed for $name." }
}

$compose = @("compose", "--env-file", $EnvFile, "-f", $ComposeFile)
$mysqlContainer = (& docker @compose ps -q mysql).Trim()
$backendContainer = (& docker @compose ps -q backend).Trim()
if (-not $mysqlContainer -or -not $backendContainer) {
    throw "The mysql and backend services must be running for a restore drill."
}

$scratchDatabase = "code_nexus_restore_check_$(Get-Date -Format 'yyyyMMddHHmmss')"
try {
    & docker cp $databaseArchive "${mysqlContainer}:/tmp/code-nexus-restore-check.sql"
    & docker exec $mysqlContainer sh -lc "MYSQL_PWD=`"`$MYSQL_ROOT_PASSWORD`" mysql -uroot -e 'CREATE DATABASE ``$scratchDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'"
    if ($LASTEXITCODE -ne 0) { throw "Could not create the restore-check database." }
    & docker exec $mysqlContainer sh -lc "MYSQL_PWD=`"`$MYSQL_ROOT_PASSWORD`" mysql -uroot '$scratchDatabase' < /tmp/code-nexus-restore-check.sql"
    if ($LASTEXITCODE -ne 0) { throw "Database restore drill failed." }

    $tableCount = (& docker exec $mysqlContainer sh -lc "MYSQL_PWD=`"`$MYSQL_ROOT_PASSWORD`" mysql -uroot -D '$scratchDatabase' -N -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()'").Trim()
    if ([int]$tableCount -lt 1) { throw "The restored database contains no tables." }

    & docker cp $privateArchive "${backendContainer}:/tmp/code-nexus-private-restore-check.tar.gz"
    $null = & docker exec $backendContainer tar -tzf /tmp/code-nexus-private-restore-check.tar.gz
    if ($LASTEXITCODE -ne 0) { throw "Private-storage archive verification failed." }

    Write-Output "Backup verified successfully ($tableCount restored database tables)."
} finally {
    & docker exec $mysqlContainer sh -lc "MYSQL_PWD=`"`$MYSQL_ROOT_PASSWORD`" mysql -uroot -e 'DROP DATABASE IF EXISTS ``$scratchDatabase``'" 2>$null
    & docker exec $mysqlContainer rm -f /tmp/code-nexus-restore-check.sql 2>$null
    & docker exec $backendContainer rm -f /tmp/code-nexus-private-restore-check.tar.gz 2>$null
}
