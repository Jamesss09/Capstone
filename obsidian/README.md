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
- [ ] Phase 2 – AI/OMR Engine — ⏸️ **deferred**: user builds own lightweight model + dataset first
- [ ] Phase 3 – Web Admin (remaining screens: Dashboard, Answer Keys, Results, Users, Settings, Audit Logs)
- [ ] Phase 4 – Mobile Scanner (React Native)
- [ ] Phase 5 – Integration & Testing
- [ ] Phase 6 – Deployment & Documentation

---

## Last Session Recap (2026-09-23)

**Done:**
- Phase 1 backend verified live (login/RBAC/answer-keys/dashboard APIs)
- Phase 3 started: React + Tailwind + React Router wired; login form implemented with `Prototype/logo/Logo.png`, field icons (User/Lock/Eye), and the exact Login_Prototype layout/text; works with `admin/admin123` (Administrator) & `staff/staff123` (Staff)

**Deliberate simplifications (frontend is login-only right now):**
- `src/pages/Dashboard.jsx`, `StaffHome.jsx`, `components/ProtectRoute.jsx` removed
- `App.jsx`: `/` shows Login when logged out, a minimal `Home` landing (welcome + logout) when logged in
- Role-based redirect (`Admin → /dashboard`, `Staff → /staff`) returns when real screens are built

**⚠️ Uncommitted (waiting on human to commit):**
```powershell
git add .
git commit -m "phase 3: login form + app shell (fix blank page on npm run dev)"
git push origin develop
```

**Next session options:**
1. Sidebar/layout shell (all web screens reuse it)
2. Admin Dashboard from `Admin_Dashboard_Prototype.png`
3. A dedicated `Session Log.md` note to track daily progress habitually

---

## Related
- [[Overview]]
- [[AI - Implementation Plan]]
- [[Agents - Task and Rules]]