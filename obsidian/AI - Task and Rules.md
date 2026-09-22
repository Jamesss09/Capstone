---
tags:
  - capstone
  - ai
  - omr
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# AI - Task and Rules

> [!info] Overview
> The AI/OMR module is the core of the **TMC Entrance Examination Answer Sheet Recognition and Scoring System (Code Nexus)**. It detects shaded bubbles from scanned/captured single-page answer sheets, compares them against the answer key, and computes the applicant's score.
>
> **Stack:** Python, PyTorch, OpenCV 

---

## 1. Task of the AI

The AI module handles the full pipeline from image input to final score:

### 1.1 Image Pre-processing
- Accept images captured via **Android phone camera** or **document scanner** (JPEG/PNG).
- Correct for real-world capture issues:
  - camera angle / perspective distortion (warp/perspective correction)
  - paper position / rotation
  - lighting / shadow / glare
  - blur / noise
- Normalize the sheet to a standard template for consistent bubble detection.

### 1.2 Bubble / Mark Detection (OMR)
- Locate the answer sheet structure: bubbles per item + section blocks.
- Detect which bubble is **shaded** for each item.
- Recognize 4-option rows (A–D) and 5-option rows (A–E) depending on the section (see Rules).
- Handle partial/incomplete shading (target: **≥95% detection accuracy**).

### 1.3 Answer Extraction
- Convert detected marks into per-item answers (e.g., item 1 = B, item 2 = E, ...).
- Flag items where the answer is ambiguous, blank, or invalid (multi-shade).

### 1.4 Scoring
- Compare extracted answers against the official answer key.
- Compute total score, correct count, incorrect count, total items.
- Determine **Passed / Failed** using the answer key's passing score.
- Output must be **100% accurate** in calculations.

### 1.5 Result Storage
- Store recognized answers (`tbl_applicant_answers`) and final result (`tbl_examination_results`) through the Laravel backend.
- Processing is queued/tracked via `tbl_omr_processing_jobs` (queued → processing → completed/failed).

### 1.6 Performance
- A single answer sheet must be checked and scored **within seconds** of submitting the image.
- Overall goal: **≥70% reduction** in processing time vs manual checking.

---

## 2. Rules of the AI

These rules are **non-negotiable** and must be enforced by the OMR engine:

### 2.1 Answer Sheet Format
- **Single-page only** — any other format is rejected.
- Standardized template (positions/sizes of bubbles are known in advance for model training).
- Only shaded **multiple-choice** bubbles are processed.

### 2.2 Answer Options (per section)
The sheet has **100 items** in 5 sections:

| Section | Items | Options |
| --- | --- | --- |
| Inductive / Logical Test | 1 – 10 | **A – E (5 options)** |
| Mathematics | 1 – 30 | A – D (4 options) |
| English | 1 – 30 | A – D (4 options) |
| Science & Technology | 1 – 20 | A – D (4 options) |
| Aptitude | 1 – 10 | A – D (4 options) |

> [!warning] Important
> Only the **Inductive/Logical Test section uses A–E**. All other sections are A–D. The OMR detector must know the option count per section and only accept choices within the valid range for that section.

### 2.3 Marking Rules
- The applicant must shade **exactly one (1) bubble** per item.
- **Two or more shades = invalid** — the item is marked incorrect / flagged; do not guess.
- **Erasures / smudges** — the answer is considered invalid or re-inspected.
- **Blank (unshaded)** — treated as no answer → incorrect.

### 2.4 Role & Constraint Rules
- Answer keys may only be created/edited by **Administrators**.
- Staff can only scan sheets and view results — never manage keys.
- All data handling must comply with the **Data Privacy Act of 2012 (RA 10173)**.

### 2.5 Quality Rules
- **≥95% accuracy** in detecting shaded bubbles (ambiguous or incomplete shading may error).
- **100% accuracy** in score computation.
- Clear, well-lit images expected; blurry/poorly lit images may require the staff to re-capture.

---

## 3. Checklist for Implementation

- [ ] Pre-processing pipeline (perspective, lighting, noise) in OpenCV
- [ ] Option-count mapping per section (A–E for Inductive, A–D elsewhere)
- [ ] Bubble detector (PyTorch) per section template
- [ ] Multi-shade / blank / erasure detection & invalid flagging
- [ ] Answer-key comparison + score computation engine
- [ ] Integration with Laravel backend (queued OMR jobs)
- [ ] Result pass/fail determination using passing_score
- [ ] Audit logging of AI actions

---

## Related
- [[Answer Key Format]]
- [[Tech Stack]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]