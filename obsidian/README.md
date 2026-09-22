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
- [ ] Phase 1 – Database & Backend (Laravel + MySQL)
- [ ] Phase 2 – AI/OMR Engine (Python + PyTorch + OpenCV)
- [ ] Phase 3 – Web Admin (React.js + Tailwind)
- [ ] Phase 4 – Mobile Scanner (React Native)
- [ ] Phase 5 – Integration & Testing
- [ ] Phase 6 – Deployment & Documentation

---

## Related
- [[Overview]]
- [[AI - Implementation Plan]]
- [[Agents - Task and Rules]]