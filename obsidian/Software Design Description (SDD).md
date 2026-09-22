---
tags:
  - capstone
  - sdd
  - design
  - database
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Software Design Description (SDD)

> [!info] File
> `Docu/CODE NEXUS - SDD.docx`

---

## Document Outline
1. **Introduction** — Purpose, Scope, Definitions, References
2. **System Architecture** — 9 Class Diagrams
3. **Data Design** — 12 Database Tables + ERD
4. **Detailed Design** — 8 Sequence Diagrams + Scanner
5. **Human Interface Design**

---

## Class Diagrams (Figure 1.0 – 9.0)
Login, Dashboard, User Account, Applicant, Examination Folder, Answer Key, Answer Sheet, Examination Result, AI-based Answer Sheet Recognition Home Scanner.

## Sequence Diagrams (Figure 11.0 – 18.0)
Login, Dashboard, User Account, Identify Applicant, Examination Folder, Answer Key, Answer Sheet, Examination Result.

---

## Database Schema (`tbl_` tables)

| Table | Purpose |
| --- | --- |
| `tbl_answer_key_items` | Individual items of each key (correct answer, points) |
| `tbl_answer_keys` | Official keys: exam title, passing score, school year, status |
| `tbl_answer_sheets` | Scanned sheet metadata + image (path, hash) |
| `tbl_applicant_answers` | Per-item marked answers (marked_answer, is_correct) |
| `tbl_audit_logs` | Security/traceability log of user actions |
| `tbl_examination_folders` | Result folders by course + school year |
| `tbl_examination_results` | Final scores, statuses (Passed/Failed), counts |
| `tbl_omr_processing_jobs` | Queued/tracked AI processing jobs |
| `tbl_settings` | System-wide configuration |
| `tbl_users` | User accounts (role, is_active) |
| `tbl_examination_applicants` | Applicant info per exam (folder, key) |

> [!warning] Design change needed
> With **A–E in the Inductive section**, `tbl_answer_key_items.correct_answer` and `tbl_applicant_answers.marked_answer` (currently `varchar(5)` — OK) must respect **per-section option counts**. An optional `section` column on key items helps the OMR engine know 4 vs 5 bubbles.

---

## Related
- [[AI - Task and Rules]]
- [[Answer Key Format]]
- [[Tech Stack]]
- [[Software Requirement Specification (SRS)]]