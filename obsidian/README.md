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

**Docker backend runtime fixed — it had been silently serving wrong/old code:**
- `docker-compose.yml` volume bug: `../backend` / `../omr` resolve *relative to the compose file*, landing on `C:\Users\ACER\backend` + `C:\Users\ACER\omr` — stale sibling folders outside the repo. The container was running a pre-API copy (no `routes/api.php`) → every `/api/*` call fell through to a Laravel 404. Fixed to `./backend` / `./omr` (verified via `docker inspect` mount source + container route listing).
- `docker/backend/Dockerfile` gap: stock `php:8.2-apache` serves the repo root with `AllowOverride None`, so Laravel was never executed by Apache. Added `DocumentRoot /var/www/html/public`, `<Directory>` scoping, and `AllowOverride All`. Rebuilt; `apachectl -t` → Syntax OK.
- Post-fix, the container serves the real app: `POST /api/login → 200` and dashboard `200` confirmed in the Apache access log.

**Performance verdict (measured 2026-09-26, same code + same MySQL):**
- Container: login **27.1 s**, dashboard **8.9–11.4 s** — every PHP request boots Laravel (~2,000 file reads) across the Windows ↔ WSL2 file bridge (9p/gRPC-FUSE).
- `php artisan serve` (XAMPP PHP, native NTFS): login **1.3 s**, dashboard **0.8–1.5 s**.
- **Decision:** `php artisan serve` remains the dev runtime. The container is now *deploy-correct* (matches a Linux prod host where bind mounts are native and fast) — use it for Phase 6 deployment, not local dev.
- Backend container left **stopped** (`docker compose start backend` brings it back); MySQL stays up.

**Staged for owner commit:** the frontend perf round (session-cache dashboard, in-flight dedupe, theme-sync-once, TMC-seal favicon/logo, index.html) **+** the Docker fixes above.

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