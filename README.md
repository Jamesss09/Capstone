# Code Nexus — TMC Entrance Examination Answer Sheet Recognition and Scoring System

Automated checking and scoring of entrance exam answer sheets for **Trinidad Municipal College (TMC)**.

## What it does
- **Mobile (React Native, Android):** staff scan a single-page shaded answer sheet with the camera
- **AI/OMR (Python, PyTorch, OpenCV):** detects shaded bubbles, compares with the answer key, computes score + Passed/Failed
- **Web (React.js + Tailwind CSS + Laravel + MySQL):** administrators manage answer keys, results, folders, users, settings, audit logs

### Answer sheet (100 items)
| Section | Items | Options |
|---|---|---|
| Inductive / Logical Test | 1–10 | **A–E** |
| Mathematics | 1–30 | A–D |
| English | 1–30 | A–D |
| Science & Technology | 1–20 | A–D |
| Aptitude | 1–10 | A–D |

Rules: exactly one bubble per item; multi-shade and erasures are invalid.

## Tech stack
React.js · Tailwind CSS · React Native (Android) · Laravel (PHP) · MySQL · Python/PyTorch/OpenCV · Apache/Nginx · Docker · Git/GitHub

## Repository layout
```
Capstone/
├── backend/     # Laravel REST API (Phase 1)
├── frontend/    # React.js + Tailwind web admin (Phase 3)
├── mobile/      # React Native Android scanner (Phase 4)
├── omr/         # Python/PyTorch/OpenCV OMR service (Phase 2)
├── docker/      # Dockerfiles + compose
├── docker-compose.yml
├── Docu/        # SRS, SDD, SPMP documents
├── Prototype/   # UI prototype screenshots (login, web, mobile)
└── obsidian/    # Project vault: requirements, AI rules, build plan
```

## Build plan
See `obsidian/AI - Implementation Plan.md` — Phase 0 (setup) → 6 (deploy).

## Quick start (dev)
```bash
# services (MySQL, Laravel backend, OMR)
docker compose up -d --build

# web frontend
cd frontend && npm install && npm run dev
```