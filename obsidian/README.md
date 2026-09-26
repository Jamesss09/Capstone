---
tags:
  - capstone
  - readme
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# README - Code Nexus Vault

> [!info] Project Hub
> This vault is the **single source of truth** for the **TMC Entrance Examination Answer Sheet Recognition and Scoring System (Code Nexus)**. Agents and contributors start here before any task.

---

## What is this project?

A system for **Trinidad Municipal College (TMC)** that replaces manual checking of entrance examination answer sheets:
- **Mobile (React Native, Android)** — staff scan a single-page shaded answer sheet with the phone camera
- **AI/OMR (Python, PyTorch, OpenCV)** — detects shaded bubbles, compares to the answer key, computes the score
- **Web (React.js + Tailwind + Laravel + MySQL)** — administrators manage answer keys, results, folders, users & settings; staff view results

See [[Overview]] for the full rundown.

---

## Vault Map

| Note | Purpose |
| --- | --- |
| [[Overview]] | High-level project overview (why, what, how) |
| [[Tech Stack]] | Finalized technologies (no Flowise, no JS/HTML) |
| [[Answer Key Format]] | The 100-item sheet: A–E vs A–D per section |
| [[AI - Task and Rules]] | What the AI/OMR module must do + its rules |
| [[Agents - Task and Rules]] | Tasks & rules governing AI agents on this project |
| [[AI - Implementation Plan]] | Phased build roadmap (Phase 0 → 6) |
| [[UI Prototypes]] | Screens in `Prototype/` mapped to SRS + phases |
| [[Backend API]] | Live REST endpoints + seed accounts (Phase 1) |
| [[How to Run]] | Step-by-step local dev startup guide |
| [[Software Requirement Specification (SRS)]] | Requirements summary |
| [[Software Design Description (SDD)]] | Design + database schema |

Source documents: `Docu/*.docx` (SRS, SDD, SPMP).

Prototype screenshots: `Prototype/` (login, web, mobile).

---

## Quick Start for Agents

1. Read [[Overview]]
2. Read the phase you are working on in [[AI - Implementation Plan]]
3. Follow [[Agents - Task and Rules]] (non-negotiable rules)
4. Check [[UI Prototypes]] for the screens to match
5. After changes: update the affected notes + `Docu/*.docx` if requirements changed

---

## Current Status

- [x] Requirements analyzed (SRS, SDD, SPMP)
- [x] Answer key format confirmed (A–E for Inductive, A–D elsewhere)
- [x] Tech stack finalized
- [x] Prototype inventory mapped
- [x] Build plan written
- [x] Phase 0 – Foundation & Setup (monorepo, Docker, Laravel 12, React+Vite, OMR skeleton, git init)
- [x] GitHub remote connected — https://github.com/Jamesss09/Capstone (`main` + `develop` pushed)
- [x] Phase 1 – Database & Backend — 11 tables (incl. `section` key for A–E), Sanctum auth, RBAC (Admin/Staff), REST APIs, dashboard, audit logs, OMR upload queue — see [[Backend API]]
- [x] Phase 3 – **Login screen** (prototype-matched: TMC seal, navy/gold, icons, remember-me, footer)
- [x] Phase 3 – **Admin Dashboard** (KPI cards, Recent Scoring Activity, **live System Activity feed** from audit logs)
- [x] Phase 3 – **Answer Key Mgmt** (card grid, per-section builder, JSON/CSV import, Set as Active/Inactive toggle, delete — one-active enforced)
- [x] Phase 3 – **Exam Results Mgmt** (school-year folder launcher → per-folder results table, filters incl. fixed course list, View detail, CSV export)
- [x] Phase 3 – **User Mgmt** (table: NAME · USERNAME · ROLE · STATUS · ACTION, Add/Edit modals, delete with self-delete guard)
- [x] Phase 3 – **Settings Mgmt** (Appearance Light/Dark toggle — full dark theme via CSS tokens) & **Audit Logs** (color-coded chips, paginated 50)
- [x] Phase 3 – **UI polish** (skeleton loading across admin screens; TMC-seal favicon + system-title browser tab)
- [ ] Phase 2 – AI/OMR Engine — ⏸️ **deferred**: user builds own lightweight model + dataset first
- [ ] Phase 4 – Mobile Scanner (React Native)
- [ ] Phase 5 – Integration & Testing
- [ ] Phase 6 – Deployment & Documentation

---

## Latest Session Recap (2026-09-26)

**OPcache enabled in XAMPP (`C:\xampp\php\php.ini`, backup `php.ini.bak-20260926`):**
- Was fully commented out → PHP recompiled ~2,000 Laravel files on *every* request (that was the dashboard latency, not the frontend).
- Enabled: `zend_extension=opcache`, `opcache.enable_cli=1` (**critical** — `artisan serve` runs the CLI sapi), `memory_consumption=256`, `max_accelerated_files=20000`, `validate_timestamps=1` + `revalidate_freq=2` (dev edits auto-picked within ~2s).
- Measured same-moment, same code: dashboard API **~400–600 ms → ~100 ms** (client-side, 4-call runs). First request after server start is still ~1–1.6 s (cold compile).
- Requires restarting `php artisan serve` to apply (ini is read at process start).

**Docker backend runtime fixed — it had been silently serving wrong/old code:**
- `docker-compose.yml` volume bug: `../backend` / `../omr` resolve *relative to the compose file*, landing on `C:\Users\ACER\backend` + `C:\Users\ACER\omr` — stale sibling folders outside the repo. The container was running a pre-API copy (no `routes/api.php`) → every `/api/*` call fell through to a Laravel 404. Fixed to `./backend` / `./omr` (verified via `docker inspect` mount source + container route listing).
- `docker/backend/Dockerfile` gap: stock `php:8.2-apache` serves the repo root with `AllowOverride None`, so Laravel was never executed by Apache. Added `DocumentRoot /var/www/html/public`, `<Directory>` scoping, and `AllowOverride All`. Rebuilt; `apachectl -t` → Syntax OK.
- Post-fix, the container serves the real app: `POST /api/login → 200` and dashboard `200` confirmed in the Apache access log.

**Performance verdict (measured 2026-09-26, same code + same MySQL):**
- Container: login **27.1 s**, dashboard **8.9–11.4 s** — every PHP request boots Laravel (~2,000 file reads) across the Windows ↔ WSL2 file bridge (9p/gRPC-FUSE).
- `php artisan serve` (XAMPP PHP, native NTFS): login **1.3 s**, dashboard **0.8–1.5 s**.
- **Decision:** `php artisan serve` remains the dev runtime. The container is now *deploy-correct* (matches a Linux prod host where bind mounts are native and fast) — use it for Phase 6 deployment, not local dev.
- Backend container left **stopped** (`docker compose start backend` brings it back); MySQL stays up.

**Dashboard load time — root cause found and fixed (same day):**
- **The real "dashboard never loads" bug:** `main.jsx` wraps the app in `<StrictMode>`, which in dev simulates mount → unmount → remount (runs every effect, its cleanup, then the effect again). Dashboard's unmount guard only ever set `mountedRef.current = false` and never back to `true`, so after StrictMode's double-run every fetch response was discarded and `setLoading(false)` was skipped → the dashboard sat on "Loading…" **forever on a fresh mount** (no cache yet). That — not skeletons, not the activity feed — was the "won't load / loads too long" culprit. Fixed: `mountedRef.current = true` at the top of the effect.
- **Residual per-request cost measured + cut:** dashboard HTTP avg ~350–450 ms with periodic **~1.1 s spikes** whenever a request landed after opcache's `revalidate_freq=2` window (stat-scan over ~2,000 cached files); queries were only ~24 ms in-process. Raised `opcache.revalidate_freq` **2 → 30** in `C:\xampp\php\php.ini` (backup `php.ini.bak-20260926-revalidate`); restart `artisan serve` after backend edits for instant pickup. After restart: dashboard **80–166 ms** with no spikes (activity feed **117 ms**). `php artisan optimize` was tried first — no measurable gain on the built-in server, so cleared to keep dev friction-free.
- **System Activity feed restored, split off the critical path:** back in `Dashboard.jsx` (UI, `describeAction`, `timeAgo`, 15 s poll paused on hidden tabs) — but served by its own endpoint `GET /dashboard/activity` (`ActivityController`), so the feed never gates the `/dashboard` payload: stats paint first, the live feed fills in beside it. Only the feed polls; stats refresh on mount/tab-focus.
- Also same day: Skeletons removed (never the cause — that was a wedged Vite dev server), `created_at` indexes migration applied.

**Staged for owner commit:** the frontend perf round (session-cache dashboard, in-flight dedupe, theme-sync-once, TMC-seal favicon/logo, index.html) **+** the Docker fixes **+** dashboard StrictMode fix + feed split (`ActivityController`, route) + `Route::view` in web.php + the index migration (apply via `php artisan migrate` on deploy).

**Same-session follow-up (owner requests):**
- **System Activity shows active users only** — `ActivityController` now filters `whereHas('user', fn ($q) => $q->where('is_active', true))` (users use boolean `is_active`, not a status string). Verified: 10 entries, 0 from inactive users.
- **…and only answer-key events** (owner tweak — the feed shouldn't look like the full audit log): `whereIn('action', ['CREATE_ANSWER_KEY', 'DELETE_ANSWER_KEY'])`. Verified live: 8 entries, all add/delete answer key, 0 stray. Dashboard feed empty-state text updated to match.
- **…now the whole answer-key lifecycle** (owner confirmed): added `UPDATE_ANSWER_KEY`, `ACTIVATE_ANSWER_KEY`, `DEACTIVATE_ANSWER_KEY` to the filter + a **Clear** (✕) button in the System Activity panel header — clears the visible feed, shows "Feed cleared" until the next poll refills it (empty-state variant + `feedCleared` reset on load).
- **Skeleton loading restored** everywhere (`Skeleton.jsx` re-added from git history). They were never the load bug — the StrictMode mount guard was; that's fixed, so skeletons are safe again.
- **Password visibility toggles** (Eye/EyeOff) added to both Password + Confirm fields in the Add/Edit user modals (`Users.jsx`).
- **Agent guardrail added — Hard Rule 13** in [[Agents - Task and Rules]]: agents must **pause and warn the owner** whenever a request or bit of code drifts from the documented tech stack / SRS / SDD / Answer Key Format / RBAC / prototypes — and get explicit approval before building. Docs synced: `Backend API.md` (new `/dashboard/activity` row), `AI - Implementation Plan.md` (Phase 3 bullets), `Agents - Task and Rules.md`.
- **Stack/doc audit (Rule-13 self-check, same day):** verified frontend (React+Tailwind, no Flowise), backend (Laravel+Sanctum only), OMR (torch/opencv/fastapi) all match the Tech Stack. **Found one lie in the docs:** the React Native scaffold was marked done in Phase 0 but `mobile/` is only a README placeholder — corrected the plan checkbox. Also fixed a stale `:5173` → `localhost:5174` port in `Backend API.md`. **Owner confirmed: mobile app + AI/model are both intentionally later** (neither blocks Phase 3 web work).

---

## Latest Session Recap (2026-09-23)

**Done (committed `1667d36` + tweak `85b6608`, pushed to `origin/develop`):**
- **User Mgmt** (`frontend/src/pages/Users.jsx`, route `/users`): table NAME · USERNAME · ROLE (admin/staff badge) · STATUS (ACTIVE/INACTIVE) · ACTION (Edit/Delete); **Add New User** modal (Full Name, Username+Role, Password+Confirm, ACTIVE/INACTIVE segmented) + prefilled **Edit User** modal (New Password blank = keep current); delete confirm with **self-delete blocked** (button disabled + server 422); email auto-derived as `username@tmc.local` (prototype has no email field, schema requires it)
- **Exam Results Mgmt** (`frontend/src/pages/ExaminationResults.jsx`, routes `/results` + `/results/{folderId}`):
  - **Folder launcher** — school-year folder cards (Current 🟢/Archived badges, result + applicant counts, "Open Folder"), gold "+ Add New SY"
  - **Add New School Year modal** — `SY YYYY-YYYY` validation (regex also enforced by backend), Current/Archived radio, optional description; `+ Add New SY` + `+ New School Year` both open it
  - **Results table** — filter bar (🔍 name or examinee ID, All Courses, All Student Types, All Status, Clear), folder header line `SY … · N of N result(s) shown`, columns APPLICANT · EXAMINEE ID · EXAM DATE · SCORE · STATUS · ACTION, **View** detail modal, **Export CSV**, empty states for "no results yet" / "no match"
- Backend: `GET /folders` now returns `applicants_result_count`; `GET /results` gains `folder_id`, `course`, `student_type` filters + search-by-examinee-ID; folder `school_year` validated as `SY YYYY-YYYY`; migration adds `tbl_examination_applicants.student_type` (NEW/TRANSFEREE/OLD/RETURNEE)
- Sidebar label "Examination Results" → "Exam Results" per prototype
- **Tweak (`85b6608`)**: removed the two "Add New SY / New School Year" buttons from the folder table view (create SY from launcher only); "All Courses" filter is now the fixed list **BSIT · BSCRIM · BSED · BSOA · BEED · BAPOLSCI · BACOM**
- Earlier this day: Answer Key Mgmt + live dashboard feed (`8ff95cf`)

**Env note:** dev backend on `:8000` (one `php artisan serve` — avoid stacking duplicates), MySQL in Docker (`code-nexus-mysql`), web dev server on `:5174` (`admin`/`admin123`). Backend Docker container = deploy-only (correct after 2026-09-26 fix, but ~10× slower over Windows bind mounts).

**Next session options:**
1. Audit Logs page (backend `GET /audit-logs` ready)
2. Settings page
3. PDF export for results (CSV done)
4. Phase 4 mobile scanner / Phase 2 OMR (model pending)

---

## Related
- [[Overview]]
- [[AI - Implementation Plan]]
- [[Agents - Task and Rules]]