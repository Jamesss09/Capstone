---
tags:
  - capstone
  - techstack
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Tech Stack

> [!info] Finalized stack for the Code Nexus project. Flowise and a separate vanilla JS/HTML application are not part of the stack; React and React Native still use JavaScript/JSX as their implementation language.

## Frontend Web
- **React.js**
- **Tailwind CSS**

## Mobile
- **React Native** (Android only) + phone camera integration

## Backend
- **Laravel (PHP)**
- RESTful APIs
- MVC Architecture
- Laravel database queue with a dedicated `omr` worker for private FastAPI calls, retry/failure handling, and atomic MySQL persistence

## AI/ML OMR
- **Python**
- **PyTorch**
- **OpenCV**
- Server-side architecture: SIFT/template registration → 410 calibrated 44×44 crops → `BubbleCNN` classification for every bubble → item validation and scoring. The Android app uploads images; it does not bundle the `.pt` checkpoint.
- Container runtime: pinned model-card-tested dependencies with PyTorch 2.12.1 CPU; no CUDA runtime is required.

## Database
- **MySQL**

## Server
- **Apache 2.4.37** or **Nginx**
- **Docker**

## OS / Client
- **Windows 11** or **Ubuntu 20.04+** (server)
- **Android** (mobile app)
- **Chrome / Firefox / Edge** (web client)

## Tools
- **Git / GitHub**

---

## Related
- [[AI - Task and Rules]]
- [[Answer Key Format]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]
