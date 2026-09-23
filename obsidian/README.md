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
- [ ] Phase 2 – AI/OMR Engine — ⏸️ **deferred**: user builds own lightweight model + dataset first
- [ ] Phase 3 – Web Admin (remaining screens: Results, Users, Settings, Audit Logs)
- [ ] Phase 4 – Mobile Scanner (React Native)
- [ ] Phase 5 – Integration & Testing
- [ ] Phase 6 – Deployment & Documentation

---

## Latest Session Recap (2026-09-23)

**Done (committed `8ff95cf`, pushed to `origin/develop`):**
- **Answer Key Mgmt page**: card grid with ACTIVE/ARCHIVED badges, section breakdown, per-section answer builder + New/Edit modals, JSON/CSV import with downloadable templates, `AK-<year>-<id>` key codes
- **Set as Active / Set as Inactive toggle** on every card + **Delete on all keys** (warns when deleting the active key); one-active-at-a-time enforced server-side (`activate()` deactivates all others; fixed Eloquent dirty-check no-op bug)
- Backend routes added: `POST /answer-keys/{key}/activate`, `POST /answer-keys/{key}/deactivate`
- **Live System Activity feed** on the dashboard — real audit logs (actor, action, relative time, IP), 5s polling + manual refresh; KPI cards refresh on the same poll

**Env note:** dev backend on `:8000` (one `php artisan serve` — avoid stacking duplicates), MySQL in Docker (`code-nexus-mysql`), web dev server on `:5174` (`admin`/`admin123`).

**Next session options:**
1. Audit Logs page (backend `GET /audit-logs` ready)
2. Examination Results Mgmt (folders, filter, CSV/PDF export)
3. Users / Settings Mgmt
4. Phase 4 mobile scanner / Phase 2 OMR (model pending)

---

## Related
- [[Overview]]
- [[AI - Implementation Plan]]
- [[Agents - Task and Rules]]