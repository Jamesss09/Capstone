---
tags:
  - capstone
  - api
  - backend
  - laravel
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# Backend API

> [!info] Phase 1 — Laravel 12 + MySQL (Docker) + Sanctum
> Base URL (dev): `http://127.0.0.1:8000/api`

---

## Auth
| Method | Endpoint | Access | Notes |
| --- | --- | --- | --- |
| POST | `/login` | public | body: `login` (username/email) + `password` → returns `token` + `user` |
| POST | `/logout` | auth | revokes current token |
| GET | `/me` | auth | current user |

## Admin-only (role: Administrator)
| Method | Endpoint | Notes |
| --- | --- | --- |
| GET/POST | `/users` | list / create user |
| GET/PUT/DELETE | `/users/{user}` | show / update / delete |
| GET/POST | `/answer-keys` | list / create (+ nested `items`) |
| GET/PUT/DELETE | `/answer-keys/{key}` | show / update / delete |
| PUT | `/answer-keys/{key}/items` | replace all items (edit modal) |
| GET/POST/PUT/DELETE | `/folders` | examination folders |
| GET/POST/PUT | `/settings` | system settings |
| GET | `/audit-logs` | paginated audit trail |
| GET | `/dashboard` | stats + recent activity |

## Staff + Admin
| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | `/sheets/upload` | multipart: `applicant_id` + `image` (jpeg/png) → creates sheet + queued OMR job |
| GET | `/omr-jobs/{job}` | job status |
| GET/POST | `/applicants` | list (filters: folder_id, status) / create |
| GET/PUT/DELETE | `/applicants/{applicant}` | show (with sheet+answers+result) / update / delete |
| GET | `/results` | list (filters: status, answer_key_id, search) |
| GET | `/results/{result}` | detail |

---

## Rules enforced (from [[Agents - Task and Rules]])
- Staff calling `/users`, `/answer-keys`, `/settings`, `/audit-logs`, `/dashboard`, `/folders` → **403**
- Answer choices restricted to **A, B, C, D, E** (validation rejects anything else)
- Answer key items are unique per `[answer_key_id, section, item_number]` — sections restart numbering at 1
- All state-changing actions write `tbl_audit_logs`
- Passwords stored via bcrypt (`password_hash`)
- MySQL runs in Docker (`code-nexus-mysql`, DB `code_nexus`, user `nexus`/`nexus_pass`, root `root_pass`)

## Seed accounts (dev)
| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Administrator |
| `staff` | `staff123` | Staff |

> [!warning] Change these before any real deployment.

## Related
- [[AI - Implementation Plan]] (Phase 1)
- [[Software Design Description (SDD)]] (schema)
- [[Agents - Task and Rules]]