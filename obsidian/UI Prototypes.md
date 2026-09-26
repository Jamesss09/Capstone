---
tags:
  - capstone
  - prototype
  - ui
  - screens
  - code-nexus
created: 2026-09-22
project: TMC Entrance Examination Answer Sheet Recognition and Scoring System
---

# UI Prototypes

> [!info] Source
> Folder: `Prototype/` — organized as `login/`, `web/`, `mobile/`. These are the visual references for implementation; wire into [[AI - Implementation Plan]].

---

## 1. Login

| File | Maps to (SRS) | Status | Notes |
| --- | --- | --- | --- |
| `Login_Prototype.png` | Fig 10.0 Admin Log-in | ✅ **Implemented** (Phase 3) | `frontend/src/pages/Login.jsx` — TMC seal (`Prototype/logo/Logo.png`), title/subtitle, User·Lock·Eye icons, beige fields, navy/gold Sign In, remember-me, card footer + below-card text |

⚠️ No separate Staff Login image (Fig 20.0) found — the same form serves both roles (role-based redirect later).

---

## 2. Web (Admin)

| File | Maps to (SRS) | Implementation phase |
| --- | --- | --- |
| `Admin_Dashboard_Prototype.png` | Fig 11.0 Admin Dashboard | Phase 3 |
| `Answer_Key_Prototype.png` | Fig 12.0 Answer Key Mgmt | Phase 3 |
| `New_Answer_Key_Modal_Prototype.png` | Fig 13.0 Add New Key | Phase 3 |
| `Edit_Answer_Key_Modal_Prototype.png` | 🆕 not in SRS | Phase 3 |
| `Examination_Result_Prototype.png` | Fig 14.0 Result – Folders | ✅ **Implemented** (Phase 3) | `frontend/src/pages/ExaminationResults.jsx` (`FolderGrid`) |
| `New_SY_Prototype.png` | Fig 15.0 Add Folder / New School Year | ✅ **Implemented** (Phase 3) | "Add New School Year" modal — SY `YYYY-YYYY` validation, Current/Archived radio, description |
| `Examination_Result_Table_Prototype.png` | Fig 16.0 Result – Table | ✅ **Implemented** (Phase 3) | `FolderResults` — filter bar (search/name-ID, course, student type, status), folder header line, table, CSV export, per-result detail |
| `User_Management_Prototype.png` | Fig 17.0 User Mgmt | ✅ **Implemented** (Phase 3) | `frontend/src/pages/Users.jsx` — table NAME · USERNAME · ROLE · STATUS · ACTION, Add New User (+ email derived as `username@tmc.local`), self-delete blocked |
| `Add_New_User_Prototype.png` | Fig 18.0 Add User | ✅ **Implemented** (Phase 3) | modal — Full Name, Username + Role, Password + Confirm (+ live password strength meter), ACTIVE/INACTIVE, gold Create User |
| `Edit_user_Prototype.png` | 🆕 not in SRS | ✅ **Implemented** (Phase 3) | prefilled Edit modal — New Password blank keeps current password (+ live password strength meter), Save Changes |
| `Settings_Prototype.png` | Fig 19.0 Settings | Phase 3 |
| `Audit_Logs_prototype.png` | 🆕 not in SRS (matches `tbl_audit_logs`) | Phase 3 |

---

## 3. Mobile (Staff)

| File | Maps to (SRS) | Implementation phase |
| --- | --- | --- |
| `Scanner_Home_Prototype.png` | Fig 21.0 Home Scanner | Phase 4 |
| `Scan_answer_sheet_prototype.png` | 🆕 not in SRS (capture screen) | Phase 4 |
| `Identify_applicant_Prototype.png` | Fig 22.0 Identify Applicant | Phase 4 |
| `Processing_Prototype.png` | 🆕 not in SRS (job progress) | Phase 4 |
| `View_Result_Prototype.png` | Fig 23.0 Exam Result | Phase 4 |
| `Order.png` | 🆕 not in SRS (flow/instruction guide) | Phase 4 |

---

## 4. Gaps & Actions

- [ ] **Staff Login (Fig 20.0)** — confirm if `Login_Prototype.png` covers it or add a dedicated image (same form reused for now)
- [x] **Fix filename typos** — done on disk (2026-09-22): `Admin_Dashboard_Prototype.png`, `Edit_Answer_Key_Modal_Prototype.png`
- [ ] **SRS update** — list the new screens (Audit Logs, Edit Key, Edit User, Scan, Processing, Order) in the SRS figure list
- [ ] **Visual verification** — confirm actual UI elements (fields, buttons, sidebar) against these entries
- [ ] **Login visual check** — user compares `Login.jsx` to `Login_Prototype.png` side-by-side

---

## Related
- [[AI - Implementation Plan]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]
- [[Agents - Task and Rules]]