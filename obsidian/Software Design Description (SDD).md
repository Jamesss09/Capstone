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
3. **Data Design** — 11 domain database tables + ERD *(the source document numbers them Tables 2.0–12.0; Table 1.0 is the glossary, not a database table)*
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

> [!info] Implemented design update
> `tbl_answer_key_items` and `tbl_applicant_answers` include a required `section` value so item numbers can restart within each section and option ranges can be validated. Stored IDs are `inductive`, `math`, `english`, `science`, and `aptitude`; only `inductive` accepts E. Both answer columns remain `varchar(5)`.

## Implemented OMR service design

The Python service registers each uploaded image to the versioned reference,
refines the printed bubble lattice, extracts exactly 410 44×44 crops, classifies
every crop with `BubbleCNN`, and reduces them to 100 item states. Blank items are
incorrect; multiple shades and detected erasures are invalid; low-confidence
single answers are retained with an audit flag. A complete validated answer key
is then used for weighted points, percentage score, counts, and Passed/Failed.
`POST /recognize` exposes this pipeline; Laravel queue consumption and database
persistence remain a separate integration responsibility.

---

## Related
- [[AI - Task and Rules]]
- [[Answer Key Format]]
- [[Tech Stack]]
- [[Software Requirement Specification (SRS)]]
