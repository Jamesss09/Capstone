---
tags:
  - capstone
  - agents
  - workflow
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Agents - Task and Rules

> [!info] Purpose
> Defines the **tasks** and **rules** that AI agents must follow when working on the **Code Nexus** project (TMC Entrance Examination Answer Sheet Recognition and Scoring System). Any agent — coding, research, or documentation — operates under this guide.

---

## 1. Agent Roles

| Agent | Responsibility |
| --- | --- |
| **Orchestrator** | Understands the full project, breaks down work, delegates to specialized agents, keeps docs in sync |
| **Coding Agent** | Writes/refactors code for web, mobile, backend, and AI/OMR modules |
| **Research Agent** | Finds references, best practices, and alternatives (OMR, bubble detection, camera pre-processing) |
| **Docs Agent** | Maintains SRS / SDD / SPMP / Obsidian notes in sync with actual implementation |

---

## 2. Tasks per Agent

> [!tip] Common task — ALL agents
> At the end of every chat/session, **summarize and explain** to the owner what happened and what changed: files modified, commits made, decisions taken, tests run, and what's next. Use plain, easy-to-understand language.

### 2.1 Orchestrator
- [ ] Keep a single source of truth: the Obsidian vault in `obsidian/`
- [ ] Read the docs first (`Docu/*.docx`) before starting any task
- [ ] Break features into: Answer Key Mgmt → OMR Pipeline → Scoring → Results → Dashboard
- [ ] Flag inconsistencies between docs and code

### 2.2 Coding Agent
- [ ] Build per the **Tech Stack** (no extra frameworks without approval)
- [ ] Implement backend (Laravel + MySQL) REST APIs using MVC
- [ ] Implement web frontend (React.js + Tailwind) only for Admin/Staff roles
- [ ] Implement mobile (React Native, Android-only) camera capture + upload
- [ ] Implement AI/OMR in **Python + PyTorch + OpenCV** (no Flowise)
- [ ] Implement the 100-item sheet parse with **per-section option counts**

### 2.3 Research Agent
- [ ] Validate OMR/bubble-detection approach against cited references
- [ ] Recommend pre-processing steps for camera angle/lighting/distortion
- [ ] Document accuracy expectations (≥95% detection, 100% scoring)

### 2.4 Docs Agent
- [ ] Update SRS/SDD when requirements change (e.g., A–D → A–E per section)
- [ ] Keep Obsidian notes linked and current
- [ ] Record design decisions with rationale

---

## 3. Hard Rules (non-negotiable)

1. **Tech stack only** — React.js + Tailwind (web), React Native (Android), Laravel (backend), Python/PyTorch/OpenCV (AI), MySQL, Apache/Nginx, Docker, Git/GitHub.
2. **No Flowise**, no JavaScript-to-replace (JS/HTML removed from stack).
3. **Answer options are per-section, not global A–D:**
   - Inductive/Logical 1–10 → **A–E**
   - Math 1–30, English 1–30, Science 1–20, Aptitude 1–10 → **A–D**
4. Rules found on the printed sheet must be enforced:
   - exactly **one shaded bubble** per item
   - **multi-shade = invalid** (flag, never guess)
   - **erasures = invalid/re-inspect**
   - **blank = incorrect**
5. Only **Administrators** manage answer keys, users, and settings.
6. **Staff** only scan sheets (mobile camera) and view results.
7. **RA 10173 compliance** — applicant names and scores protected; RBAC enforced.
8. Single-page shaded answer sheets only; other formats rejected.
9. Scoring engine must be **100% accurate**; bubble detection **≥95%**.
10. A single sheet must score **within seconds**.
11. **Summarize after every chat** — the agent must summarize and explain to the owner what happened and what changed (files, commits, decisions, tests, next steps) before ending a session. Never leave the owner guessing what was done.

---

## 4. Soft Rules

- Prefer clear, well-lit images; if input is blurry/poorly lit, request a re-capture rather than guessing.
- Keep modules separate (OMR, scoring, user mgmt) for maintainability.
- Follow RESTful API conventions and MVC on Laravel.
- Use Git/GitHub for version control; commit logical units of work.
- Ask before adding a new dependency or changing documented behavior.

---

## 5. Workflow

```text
1. Read requirements  →  Obsidian notes + Docu SRS/SDD
2. Confirm applicability (include the Answer Key Format)
3. Implement (backend → AI/OMR → web → mobile)
4. Test (accuracy, timing, RBAC, privacy)
5. Update documentation (SRS/SDD/Obsidian)
6. Request review/approval before merging
7. End of chat: summarize and explain what happened and what changed (files, decisions, tests, next steps)
```

---

## 6. Glossary Guardrails

- **OMR** = Optical Mark Recognition (bubble detection)
- **Passed/Failed** = from comparing score vs `passing_score` in the answer key
- **Invalid** = an item that must NOT be auto-scored (multi-shade / erasure / out-of-range choice)
- **RBAC** = Role-Based Access Control (Admin vs Staff)

---

## Related
- [[AI - Task and Rules]]
- [[Answer Key Format]]
- [[Tech Stack]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]