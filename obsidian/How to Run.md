---
tags:
  - capstone
  - howto
  - code-nexus
created: 2026-09-26
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# How to Run — Code Nexus (Local Dev)

> [!info] Dev runtime (recommended): **`php artisan serve`** + Docker MySQL + Vite.
> The backend Docker container is **deploy-only** — it works now but is ~10× slower over Windows bind mounts. Don't use it for daily dev.

## What you need (one-time)

- **Docker Desktop** — runs the MySQL database
- **PHP 8.2+** (`C:\xampp\php\php.exe`) — runs Laravel
- **Node.js + npm** — runs the Vite frontend
- Dependencies installed once: `backend/` via `composer install`, `frontend/` via `npm install`

## Daily start (3 steps)

Open **three terminals** in the project root `C:\Users\ACER\Capstone`:

**Terminal 1 — Database (Docker MySQL)**
```powershell
docker compose up -d mysql
```
> MySQL auto-starts with Docker Desktop (`restart: unless-stopped`), so this is usually a no-op "already running". Check with `docker ps`.

**Terminal 2 — Backend (Laravel API)**
```powershell
cd backend
php artisan serve
```
> Serves `http://127.0.0.1:8000`. Keep exactly **one** of these running.
> After starting (or restarting), fire one warm-up request so the first real page visit skips the ~1s cold compile:
> `curl.exe http://127.0.0.1:8000/api` (a 404/401 response is fine — it warms OPcache).

**Terminal 3 — Frontend (React web app)**
```powershell
cd frontend
npm run dev
```
> Serves `http://localhost:5174`.

## Open the app

1. Browser → **http://localhost:5174**
2. Login: **`admin` / `admin123`**
3. Staff accounts are **mobile-only** — the web app rejects staff logins by design.

The frontend talks to the API at `http://127.0.0.1:8000/api` (set in `frontend/src/api/client.js`).

## Stop

- Terminal 3 + 2: press **Ctrl + C** (or close the window).
- MySQL: leave it — it's lightweight and expected to stay up.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `php artisan serve` fails "address in use" | Another server is on `:8000`. Close extra `php artisan serve` windows; make sure the Docker backend container isn't running: `docker compose stop backend` |
| Page won't load at `localhost:5174` | Vite binds IPv6 `localhost` — use `localhost:5174` (not `127.0.0.1:5174`) |
| MySQL not reachable | `docker compose up -d mysql`, wait for "healthy": `docker ps` |
| Schema changed / errors | `cd backend; php artisan migrate` (rerun migrations only — never wipe data casually) |
| API calls fail after ~1h of coding | `php artisan serve` is single-threaded and can wedge; restart it (Ctrl+C, run again) |
| Performance | Server must be restarted after php.ini changes. OPcache: `php -r "echo ini_get('opcache.enable_cli');"` → `1`, `opcache.revalidate_freq=30` (was 2). The 2s window made the server pay a ~1s stat-scan over ~2,000 cached files whenever a request landed after the window (measured ~1.1s dashboard spikes); 30 keeps checks rare. After editing backend code, **restart `php artisan serve`** for instant pickup (or wait ≤30s). Ini backups: `php.ini.bak-20260926` (original), `php.ini.bak-20260926-revalidate` (pre-30s) |
| First request after server start is slow (1–2s) | Cold compile — expected once. Warm it: `Invoke-WebRequest http://127.0.0.1:8000/api`; subsequent requests run ~100ms |

## Backend Docker container (optional, deploy-only)

The image `code-nexus-backend:latest` is fixed and saved. On a **Linux** server this is the deployment path:

```powershell
docker compose up -d --build backend
```

On Windows it serves the same API at `localhost:8000` but each request takes ~10–27 s (Windows↔WSL2 file bridge) — fine to *verify*, too slow to *develop*.

## Related
- [[README]] — project hub & latest recap
- [[Backend API]] — endpoints & seed accounts