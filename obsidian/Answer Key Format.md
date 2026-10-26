---
tags:
  - capstone
  - format
  - answer-sheet
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Answer Key Format

> [!info] Source
> Based on the attached **`Answer_Key_Format.jpg`** — the official TMC entrance examination answer sheet.

---

## Sheet Structure

- **Single-page** shaded multiple-choice answer sheet.
- Header contains: **NAME**, **DATE**, **MOBILE NO.**, **COURSE TO ENROLL**, **NEW / TRANSFEREE / OLD / RETURNEE**, and the **TMC logo**.

---

## Sections (100 items total)

| Section | Items | Options |
| --- | --- | --- |
| Inductive / Logical Test | 1 – 10 | **A – E (5 options)** |
| Mathematics | 1 – 30 | A – D (4 options) |
| English | 1 – 30 | A – D (4 options) |
| Science & Technology | 1 – 20 | A – D (4 options) |
| Aptitude | 1 – 10 | A – D (4 options) |

> [!warning] Key change
> Only **Inductive/Logical Test (items 1–10) uses A–E**. All other sections use **A–D**. This replaces the old assumption of A–D everywhere.

### Canonical Section IDs

The template, Laravel answer-key records, and OMR output use these lowercase
identifiers. Display names are for the user interface only; do not store them
as `section` values or use them for model labels.

| ID | Display name | Items | Options |
| --- | --- | --- | --- |
| `inductive` | Inductive / Logical Test | 1 – 10 | A – E |
| `math` | Mathematics | 1 – 30 | A – D |
| `english` | English | 1 – 30 | A – D |
| `science` | Science & Technology | 1 – 20 | A – D |
| `aptitude` | Aptitude | 1 – 10 | A – D |

Legacy display-name aliases are normalized to these IDs when an answer key is
saved. Unknown/custom sections are rejected because they do not exist on the
standardized TMC sheet.

---

## Marking Rules (printed on the sheet)

- Shade **exactly one (1) bubble** per item.
- **Two or more shaded = invalid** answer.
- **Avoid erasures** — erasures/smudges make the answer invalid or unreliable.

---

## Implications for AI/OMR

- The OMR template must know the **option count per section** (5 bubbles in Inductive, 4 elsewhere).
- Items with a mark outside the valid range (e.g., 'E' in Math) must be treated as **invalid**, not guessed.
- Multi-shade and erasure-smudge items must be **flagged**, not auto-scored.

---

## Related
- [[AI - Task and Rules]]
- [[Tech Stack]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]
