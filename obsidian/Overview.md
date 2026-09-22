---
tags:
  - capstone
  - overview
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Overview

> [!info]
> **Project:** TMC Entrance Examination Answer Sheet Recognition and Scoring System (**Code Nexus**)
> **Client:** Trinidad Municipal College (TMC) — Admissions Office
> **Status:** Planning complete — build starts at [[AI - Implementation Plan]] Phase 0

---

## Why (Problem)

Checking entrance exam answer sheets at TMC is currently **manual**:
- Time-consuming (inspect marks, compare to key, compute scores one by one)
- Prone to fatigue/human error in checking and scoring
- Slow result release (days)
- Poorly suited to large volumes of candidates

## What (Solution)

An automated system that:

1. **Scans** a single-page shaded multiple-choice answer sheet using an **Android phone camera** (staff) or uploaded image
2. **Recognizes** the shaded answers per item using **AI/OMR** (Python, PyTorch, OpenCV)
3. **Scores** automatically — compares to the official answer key, computes score, and decides **Passed / Failed**
4. **Manages** answer keys, results, folders, users, settings via a **web platform** (React.js + Tailwind + Laravel + MySQL)

**Targets:** ≥70% faster than manual, ≥95% bubble-detection accuracy, 100% calculation accuracy, results in minutes.

## Who (Users)

| Role | Capabilities |
| --- | --- |
| **Administrator** | Dashboard, Answer Key Mgmt, Result Mgmt, User/Settings Mgmt, Audit Logs |
| **Entrance Examination Staff** | Scan sheets (mobile camera), view results — **no key/user management** |

## Sheet Format (100 items)

| Section | Items | Options |
| --- | --- | --- |
| Inductive / Logical Test | 1 – 10 | **A – E** |
| Mathematics | 1 – 30 | A – D |
| English | 1 – 30 | A – D |
| Science & Technology | 1 – 20 | A – D |
| Aptitude | 1 – 10 | A – D |

Rules: exactly **one** bubble per item; **multi-shade and erasures are invalid**; blank = incorrect.
See [[Answer Key Format]].

## How (Architecture)

```text
┌──────────────┐      ┌───────────────────────────┐      ┌─────────────────┐
│ Mobile (RN)  │ ───► │ Laravel API + MySQL +     │ ◄─── │ Web Admin       │
│ Staff scans  │      │ OMR job queue             │      │ (React+Tailwind)│
│ answer sheet │      │                    ▲      │      └─────────────────┘
└──────────────┘      │                    │      │
                      │   Python/PyTorch/ │      │
                      │   OpenCV (AI/OMR) └──────┤
                      └───────────────────────────┘
     capture → upload → job → recognize → score → result → dashboard/export
```

- **Backend:** Laravel (PHP) REST APIs, MVC, MySQL, Apache/Nginx + Docker
- **AI/OMR:** Python, PyTorch, OpenCV (no Flowise)
- **Web:** React.js, Tailwind CSS
- **Mobile:** React Native (Android-only)

## Key Requirements (must always hold)

- Only **Administrators** manage answer keys/users/settings — strict RBAC
- Single-page shaded sheets only; other formats rejected
- Data handling complies with **RA 10173** (Data Privacy Act of 2012)
- Scope: checking & scoring only — no scheduling, registration, or admission decisions
- Score a single sheet **within seconds**

## Build Plan

Follow [[AI - Implementation Plan]] — Phase 0 (setup) → Phase 1 (backend/DB) → Phase 2 (AI/OMR) → Phase 3 (web) → Phase 4 (mobile) → Phase 5 (integration/test) → Phase 6 (deploy/docs).

Deliverables map to the software engineering documents in `Docu/` (SRS, SDD, SPMP). See [[README]] for the vault map.

---

## Related
- [[README]]
- [[Tech Stack]]
- [[Answer Key Format]]
- [[AI - Implementation Plan]]
- [[Agents - Task and Rules]]