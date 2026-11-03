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
> Browser base URL (dev): `http://localhost:8000/api`
> Web frontend (Phase 3): `http://localhost:5173` (`npm run dev` in `frontend/`)
>
> Keep the browser on `localhost` (not `127.0.0.1`): the httpOnly refresh
> cookie uses `SameSite=Lax`, and `localhost` and `127.0.0.1` are different
> sites. `http://127.0.0.1:8000/api` is suitable for curl/Postman, but a web
> client using it will not send the refresh cookie.

---

## Auth
| Method | Endpoint | Access | Notes |
| --- | --- | --- | --- |
| POST | `/login` | public | body: `login` (username/email) + `password` → returns `token` + `user` |
| POST | `/refresh` | public | exchanges the httpOnly refresh cookie for a fresh `token` + `user`; browser clients must use `credentials: 'include'` |
| POST | `/logout` | auth | revokes current token |
| GET | `/me` | auth | current user |

The access token is held only in browser memory. The refresh token is an
httpOnly cookie, so browser requests must use `credentials: 'include'`. Any
additional browser origin must be explicitly added to `CORS_ALLOWED_ORIGINS`;
the wildcard `*` is invalid when credentialed CORS is enabled.

## Admin-only (role: Administrator)
| Method | Endpoint | Notes |
| --- | --- | --- |
| GET/POST | `/users` | list / create user |
| GET/PUT/DELETE | `/users/{user}` | show / update / delete |
| GET/POST | `/answer-keys` | list / create (+ nested `items`); new keys start Inactive |
| GET/PUT/DELETE | `/answer-keys/{key}` | show / update / delete; content is immutable after assignment |
| PUT | `/answer-keys/{key}/items` | replace all items before the key is assigned |
| POST | `/answer-keys/{key}/activate` | require all 100 items, set this key **Active**, and make all others Inactive |
| POST | `/answer-keys/{key}/deactivate` | toggle key off (idempotent) |
| GET/POST/PUT/DELETE | `/folders` | examination folders; index also returns `applicants_count` + `applicants_result_count` |
| GET/POST/PUT | `/settings` | system settings — the admin UI's **Appearance** toggle upserts a `theme` key (light/dark); every change is audit-logged (`CREATE_SETTING` / `UPDATE_SETTING` / `DELETE_SETTING`) |
| GET | `/audit-logs` | paginated audit trail (50/page; filters `action`, `user_id`; newest first; each row includes the acting user) |
| GET | `/dashboard` | stats + recent activity |
| GET | `/dashboard/activity` | **live System Activity feed** (own endpoint so it never gates the `/dashboard` payload). Latest 10 audit logs, **answer-key actions only** — `CREATE_ANSWER_KEY` · `UPDATE_ANSWER_KEY` · `ACTIVATE_ANSWER_KEY` · `DEACTIVATE_ANSWER_KEY` · `DELETE_ANSWER_KEY` (no general audit trail) — from **active users only** (`is_active`), with the acting user joined |

## Staff + Admin
| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | `/sheets/upload` | multipart: `applicant_id` + `image` (jpeg/png) → privately stored capture and HTTP 202 with sheet + queued OMR job; a Failed capture may be replaced |
| GET | `/omr-jobs/{job}` | job + result status; staff can poll only their own jobs, administrators can poll any |
| GET/POST | `/applicants` | list / identify applicant; **`course` is required**, `student_type` optional; Laravel generates the ID and automatically binds the active key—`answer_key_id` is prohibited |
| GET/PUT/DELETE | `/applicants/{applicant}` | show (with sheet+answers+result) / update / delete |
| GET | `/results` | list (filters: `folder_id`, `status`, `answer_key_id`, `course`, `student_type`, `search` — name **or** examinee ID) |
| GET | `/results/{result}` | detail (with applicant, answer key, sheet + answers) |

## Python OMR service (`http://localhost:5005`)

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/health` | service health and lazy model-load state |
| GET | `/sheet-config` | canonical sections and option counts |
| POST | `/recognize` | multipart JPEG/PNG `file`; optional `answer_key` JSON text field + `answer_key_id`; returns 410 bubbles, 100 item decisions, diagnostics, and optional score |

`answer_key` must contain `passing_score` and all 100 item objects (`section`,
`item_number`, `correct_answer`, optional `points`). The Python service has no
database access, so `answer_key_id` alone is rejected. Laravel's `omr` queue
worker loads and serializes the bound immutable key, calls this private service,
independently verifies the returned items/score, and atomically persists answers,
diagnostics, result, audit event, and job status. Uploads are capped at 10 MB/40 megapixels and serialized
keys at 1 MB; invalid images, registration
failures, and malformed/incomplete keys return 4xx responses.

---

## Rules enforced (from [[Agents - Task and Rules]])
- Staff calling `/users`, `/answer-keys`, `/settings`, `/audit-logs`, `/dashboard`, `/folders` → **403**
- Answer choices restricted to **A, B, C, D, E** (validation rejects anything else)
- Answer key items are unique per `[answer_key_id, section, item_number]` — sections restart numbering at 1
- New keys are Inactive; activation requires exactly 100 canonical items. Assigned key content cannot be edited or deleted.
- Applicant identification resolves the one active key on the server. Clients cannot select a different key.
- OMR jobs retry transient service failures, permanently fail rejected captures/contracts, never persist partial answers/results, and audit both completed and terminally failed processing.
- All state-changing actions write `tbl_audit_logs`
- Folder `school_year` must match `SY YYYY-YYYY` (e.g. `SY 2026-2027`; the `SY` prefix is optional on input)
- `tbl_examination_applicants.student_type` added (Phase 3) for the sheet-header types NEW / TRANSFEREE / OLD / RETURNEE
- `POST /applicants` requires `course` (the mobile Identify Applicant screen's **Course to Enroll**). The API accepts only these canonical codes: `BSIT`, `BA POLSCI`, `BEED`, `BSED`, `BSCRIM`, `BSOA`; aliases such as `BAPOLSCI`, free-text names, and undocumented courses such as `BACOM` are rejected with 422.
- `tbl_examination_applicants.course` is chosen at identification time; `tbl_examination_results.course` snapshots it when the result row is created, so the admin results table/export shows it
- Passwords stored via bcrypt (`password_hash`)
- MySQL runs in Docker (`code-nexus-mysql`, DB `code_nexus`, user `nexus` / root — see root `.env`, never commit real passwords)

## Error handling (API-first)
- Unauthenticated `/api/*` → **401** JSON `{"message":"Unauthenticated."}` — no redirect (fixed the `Route [login] not defined` 500 for clients without a JSON `Accept` header)
- Validation failures on `/api/*` → **422** JSON with `message` + `errors`, regardless of client `Accept` header
- Health check: `GET /up` → 200 when healthy (Laravel default, replaces the older `/health`)

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
