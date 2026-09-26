---
tags:
  - capstone
  - implementation
  - roadmap
  - agents
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# AI - Implementation Plan

> [!info] Phased roadmap
> Build sequence for the **Code Nexus** project. Agents follow this order; each phase depends on the previous one. Covers backend → AI/OMR → web → mobile → integration → deployment.

---

## Phase 0 — Foundation & Setup
**Goal:** Reproducible dev environment.

- [x] Create Git repo (GitHub) with branch strategy (`main`, `develop`, feature branches)
- [x] Docker compose: `mysql`, `php-fpm/laravel`, `nginx`, `python-omr` services
- [ ] Define env configs (`dev`, `staging`, `prod`)
- [x] Scaffold Laravel app + React.js app + React Native app + Python service skeleton
- **Deliverable:** `docker compose up` runs the full skeleton

---

## Phase 1 — Database & Backend (Laravel + MySQL)
**Goal:** Data layer + REST APIs with RBAC that every other layer consumes.

- [x] Migrations + models for all 11 tables:
  - `users`, `settings`, `audit_logs`
  - `answer_keys`, `answer_key_items` *(include `section` column for A–E mapping)*
  - `examination_folders`, `examination_applicants`
  - `answer_sheets`, `applicant_answers`, `examination_results`
  - `omr_processing_jobs`
- [x] Auth (Laravel Sanctum) + role middleware (**Admin** vs **Staff**)
- [x] CRUD APIs: Answer Keys (Admin-only), Folders, Applicants, Results
- [x] File upload endpoint for answer sheet images (`image_path`, `image_hash`)
- [x] OMR job queue API (create job → status via `tbl_omr_processing_jobs`)
- [x] Audit logging middleware
- **Deliverable:** postman-tested REST endpoints, seeded roles

---

## Phase 2 — AI/OMR Engine (Python + PyTorch + OpenCV)
**Goal:** Convert a captured sheet image into verified answers + score.

> [!warning] ⏸️ DEFERRED — owner builds own lightweight model + dataset first
> The OMR microservice skeleton (`omr/` FastAPI + `sheet_config.py`) already exists, but real
> recognition work waits for the custom model/dataset. Design notes below stay valid.

- [ ] Pre-processing: perspective correction, rotation, lighting, despeckle
- [ ] Sheet template config per section (from [[Answer Key Format]]):
  - Inductive 1–10 → **5 bubbles (A–E)**
  - Math 1–30, English 1–30, Science 1–20, Aptitude 1–10 → **4 bubbles (A–D)**
- [ ] Bubble detection (OpenCV contour analysis + PyTorch model fallback)
- [ ] Shade validation: single shade OK, multi-shade/erasure/blank → **invalid flag**
- [ ] Out-of-range option (e.g., 'E' in Math) → invalid, never guessed
- [ ] Answer-key comparison engine (input: key + detected answers → score)
- [ ] Pass/Fail via `passing_score`; output correct/incorrect/total counts
- [ ] Wrap as REST microservice consumed by Laravel job workers
- **Deliverable:** test harness on sample sheets; ≥95% detection, 100% calc accuracy, <seconds/sheet

---

## Phase 3 — Web Admin (React.js + Tailwind)
**Goal:** Web platform for Admins (manage) and Staff (view).

- [x] Login (**admin-only on web**) — prototype-matched; `admin/admin123`. Staff accounts are rejected on the web ("Staff accounts sign in via the mobile app."). Staff login uses the same design in the mobile app (Phase 4).
- [x] Admin **Dashboard** — matches `Admin_Dashboard_Prototype`: navy sidebar w/ nav + logout, header strip, KPI cards (Total Applicants / Sheets Scanned Today / Passing Rate), Recent Scoring Activity table, System Activity feed. Backed by `GET /dashboard`.
- [x] Admin: Answer Key Mgmt (with per-section editor + Edit/Add modals)
- [x] Admin: Audit Logs — "Recent Activity" card, color-coded action chips, paginated 50 (Prev/Next), refresh; empty state matches prototype
- [x] Admin: Result Mgmt (school-year folder launcher → per-folder results table, filters, export)
- [x] Admin: User Mgmt (list, Add/Edit modal, delete with self-delete guard)
- [x] Admin: Settings Mgmt — **Appearance Light/Dark** toggle (Fig 19.0); persists `theme` to `tbl_settings` (+ localStorage mirror) and applies a **full dark theme** across the admin UI (CSS-variable tokens in `index.css`, `.dark` class on `<html>`; sidebar stays navy). Settings changes are audit-logged (`CREATE_SETTING`/`UPDATE_SETTING`/`DELETE_SETTING`).
- [x] Result table with Passed/Failed status + **CSV export** and **PDF export** (client-side jsPDF + autotable, honors active filters)
- [x] UI polish — **skeleton loading** on all admin data screens (`frontend/src/components/Skeleton.jsx`: pulsing StatCard / Card / Table / Feed / Form placeholders replacing "Loading…" text while data fetches); browser tab title **"TMC Entrance Examination: Answer Sheet Recognition and Scoring System"** + **TMC-seal favicon** (`index.html` → `src/assets/logo.png`)
- **Deliverable:** all web prototypes from [[UI Prototypes]] (incl. Audit Logs + Edit modals) — admin-only

---

## Phase 4 — Mobile Scanner (React Native, Android)
**Goal:** On-device capture + upload.

- [ ] Staff login — same design as the web login (`Login_Prototype`), inside the mobile app
- [ ] Home Scanner → camera capture with capture guidance (lighting/straight-on hints)
- [ ] Scan Answer Sheet screen (capture + preview)
- [ ] Identify applicant (name confirmation)
- [ ] Processing/status screen (job progress per `tbl_omr_processing_jobs`)
- [ ] Order (flow guide) screen
- [ ] Upload → creates OMR job → status feedback
- **Deliverable:** all mobile prototypes from [[UI Prototypes]] (Home, Scan, Identify, Processing, Result, Order)

---

## Phase 5 — Integration & Testing
**Goal:** End-to-end correctness.

- [ ] Flow: Mobile capture → job queue → OMR process → score → result → dashboard
- [ ] RBAC enforcement tests (Staff blocked from keys/users/settings)
- [ ] Scoring accuracy tests (100%) incl. invalid/multi-shade/erasure cases
- [ ] Timing test (≥70% faster than manual)
- [ ] Privacy checks (RA 10173): access logs, audit trail, secure storage
- **Deliverable:** Software Testing Document (STD) results

---

## Phase 6 — Deployment & Documentation
**Goal:** Production-ready at TMC.

- [ ] Dockerized deployment on local server (Windows 11 / Ubuntu 20.04+, Nginx/Apache)
- [ ] Backup/recovery plan
- [ ] User manual + admin manual
- [ ] Finalize SRS/SDD/SPMP + Obsidian notes
- **Deliverable:** Deployed system + full documentation

---

## Dependency Map

```text
Phase 0 (setup) ──► Phase 1 (backend/DB) ──► Phase 3 (web admin)
                     │ ▲                        ▲
                     ▼ │                        │
              Phase 2 (AI/OMR) ────► Phase 5 (integration/testing)
                                          │
                     Phase 4 (mobile) ─────┤
                                          ▼
                              Phase 6 (deploy + docs)
```

> [!tip] Parallel work
> Phase 3 (web) can start as soon as Phase 1 APIs exist. Phase 4 (mobile) only needs the upload + job APIs. Phase 2 (AI) can run in parallel with Phase 3/4 using sample sheets.

---

## Definition of Done (per phase)
- [ ] Code committed to GitHub with meaningful history
- [ ] Tests pass (unit + integration)
- [ ] Obsidian notes + docs updated
- [ ] Reviewed per [[Agents - Task and Rules]]

---

## Related
- [[Agents - Task and Rules]]
- [[AI - Task and Rules]]
- [[Answer Key Format]]
- [[Tech Stack]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]