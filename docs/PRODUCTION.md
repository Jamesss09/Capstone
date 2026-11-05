# Production deployment and recovery

## Minimum host

- 8 logical CPU threads
- At least 6 GB assigned to Docker; 8 GB is preferred
- Permanent HTTPS hostnames for the API and admin web application
- Docker Engine with Compose v2

The OMR service must remain private. Only the HTTPS reverse proxy should be
publicly reachable. MySQL and OMR have no published ports in
`docker-compose.production.yml`; Laravel is bound to host loopback port 8000 for
a host-level Nginx, Apache, or Caddy reverse proxy.

`TRUSTED_PROXIES=*` is safe only while that loopback-only binding is preserved.
It lets Laravel use the proxy-provided client IP and HTTPS scheme for throttling
and secure cookies. If Laravel is moved behind a different network topology,
replace `*` with the proxy IP or CIDR list before exposing it.

## First deployment

1. Copy `.env.production.example` to `.env.production` outside version control.
2. Generate `APP_KEY` with `php artisan key:generate --show` and set long,
   independent database and initial-user passwords.
3. Set `APP_URL` and `CORS_ALLOWED_ORIGINS` to permanent HTTPS URLs.
4. Build and start:

   ```powershell
   docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
   docker compose --env-file .env.production -f docker-compose.production.yml exec backend php artisan migrate --force
   docker compose --env-file .env.production -f docker-compose.production.yml exec backend php artisan db:seed --force
   ```

5. Configure the reverse proxy for TLS and forward the API hostname to
   `http://127.0.0.1:8000`. Do not expose port 5005 or MySQL.
6. Change the seeded user passwords after the first successful login. Re-running
   the seeder does not reset existing passwords.

## Web and Android configuration

Build the web administrator with the permanent API address:

```powershell
cd frontend
$env:VITE_API_URL="https://api.example.edu/api"
npm ci
npm run build
```

For Expo SDK 58, configure the public API URL in the Expo Services environment,
then create an internal APK or production app bundle:

```powershell
cd mobile
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://api.example.edu/api --environment production --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
```

`EXPO_PUBLIC_API_URL` is embedded in the client and is not a secret. Never build
with a LAN-only or temporary trycloudflare URL for production.

## Mobile dependency-audit exception

As of 2026-11-05, `npm audit --omit=dev` reports 1 low and 21 moderate
advisories in Expo CLI, fingerprinting, Jest, and ESLint dependency trees. These
packages are build, test, and lint tooling and are not executed in the installed
Android application's JavaScript bundle. npm's offered remediation would
downgrade Expo SDK 58 to SDK 52 and Jest 30 to 29, which is incompatible with
the validated application. Do not run `npm audit fix --force`.

Recheck these advisories whenever Expo SDK 58 publishes compatible patched
tooling. Keep EAS builds isolated, avoid untrusted project files in CI, and
continue blocking release on any high or critical runtime advisory.

## Backup policy

- Run `scripts/backup.ps1` daily.
- Retain daily backups for 30 days and monthly backups for one year.
- Copy backups to encrypted storage on a different physical machine.
- Run `scripts/verify-backup.ps1` monthly. It restores the SQL dump into a
  temporary database, verifies the private-storage archive, and then removes the
  temporary database without changing live data.

```powershell
.\scripts\backup.ps1
.\scripts\verify-backup.ps1 -BackupDirectory backups\20261105-120000
```

Backups include MySQL data, answer metadata/results, audit records, and private
answer-sheet images. Each set includes SHA-256 checksums.

## Recovery procedure

1. Provision a clean server and start only MySQL.
2. Verify the selected backup with `verify-backup.ps1`.
3. Restore into a new database name rather than overwriting the damaged one.
4. Extract `private-storage.tar.gz` into the production private-storage volume.
5. Point Laravel at the restored database, start backend and worker, and confirm
   `/up` and OMR `/health` before enabling the reverse proxy.
6. Verify applicant, result, answer, active-key, and audit-log counts before
   allowing new scans.

Always retain the damaged database and storage volume until the restored system
has been accepted by an administrator.

## Release checks

Before each release:

- `php artisan test`
- `python -m pytest -q`
- locked OMR pipeline validation
- mobile tests, typecheck, lint, and `npx expo-doctor`
- frontend lint and production build
- `docker compose config --quiet` for development and production files
- one upload, one rejected capture, and two queued scans on the target server
