---
tags:
  - capstone
  - srs
  - requirements
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Software Requirement Specification (SRS)

> [!info] File
> `Docu/Software-Requirement-Specification_-Code-Nexus.docx`

---

## Document Outline
1. **Overview** — Project Summary, Definitions, References
2. **Overall Description** — Product Perspective, Functions, Users, Constraints
3. **Specific Requirements** — Interfaces, Use Cases, Prototypes, Performance, Attributes

---

## Key Points

### Product Functions
- **Dashboard** — applicant totals, exam counts, passing stats, recent activity
- **Answer Key Management** — create/edit/maintain keys (Admin only)
- **Result Management** — view, filter, organize, export results
- **System Management** — user accounts, roles, settings
- **AI-Based Answer Sheet Recognition** — OMR detection + scoring
- **Score Computation** — instant pass/fail
- **Mobile Camera** — scan via phone

### Users
- **Administrator** — dashboard, answer keys, results, user/system management
- **Entrance Examination Staff** — AI recognition, mobile camera only

### Hard Constraints
- Only admins manage answer keys
- ~~A–D only~~ → **A–E for Inductive section, A–D elsewhere** *(updated)*
- Single-page shaded sheets only
- Strict RBAC — staff cannot manage keys or users
- Android-only mobile app
- RA 10173 (Data Privacy Act of 2012) compliance
- Checking/scoring only — no scheduling, registration, or admission features

### Soft Constraints
- Clear, well-lit images required (blurry/poor lighting → re-capture)
- **≥95% recognition accuracy** target

### Interfaces & Environment
- **Server:** Intel Core i5-10210U, 8GB RAM, 256GB SSD
- **SW:** Windows 11 / Ubuntu 20.04+, MySQL, Apache 2.4.37 / Nginx, Laravel, React.js, Tailwind, React Native, Python/PyTorch/OpenCV

### Performance
- Score a single sheet **within seconds**
- **≥70% reduction** in processing time

---

## Use Cases (from SRS)
Login, Admin Dashboard, Answer Key Mgmt, Result Mgmt, System Mgmt (User + Settings), AI Home Scanner, Identify Applicant, Examination Result.

## Prototypes (Figures 10.0 – 23.0)
See [[UI Prototypes]] — full inventory in `Prototype/` (login, web, mobile).

> [!warning] SRS/prototype gaps to reconcile
> The prototype set is **ahead of the SRS figure list**. New screens to add to the SRS:
> - Web: **Audit Logs**, **Edit Answer Key Modal**, **Edit User**
> - Mobile: **Scan Answer Sheet**, **Processing**, **Order (flow guide)**
> - **Staff Login (Fig 20.0)** has no dedicated image.

---

## Related
- [[AI - Task and Rules]]
- [[Answer Key Format]]
- [[Tech Stack]]
- [[Software Design Description (SDD)]]