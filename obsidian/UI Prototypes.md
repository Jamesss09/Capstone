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

| File | Maps to (SRS) | Notes |
| --- | --- | --- |
| `Login_Prototype.png` | Fig 10.0 Admin Log-in | ⚠️ No separate Staff Login image (Fig 20.0) found |

---

## 2. Web (Admin)

| File | Maps to (SRS) | Implementation phase |
| --- | --- | --- |
| `Admin_Dashboard_Prototyppe.png` | Fig 11.0 Admin Dashboard | Phase 3 |
| `Answer_Key_Prototype.png` | Fig 12.0 Answer Key Mgmt | Phase 3 |
| `New_Answer_Key_Modal_Prototype.png` | Fig 13.0 Add New Key | Phase 3 |
| `Edit_Answer_Key_Modal_Prorotype.png` | 🆕 not in SRS | Phase 3 |
| `Examination_Result_Prototype.png` | Fig 14.0 Result – Folders | Phase 3 |
| `New_SY_Prototype.png` | Fig 15.0 Add Folder / New School Year | Phase 3 |
| `Examination_Result_Table_Prototype.png` | Fig 16.0 Result – Table | Phase 3 |
| `User_Management_Prototype.png` | Fig 17.0 User Mgmt | Phase 3 |
| `Add_New_User_Prototype.png` | Fig 18.0 Add User | Phase 3 |
| `Edit_user_Prototype.png` | 🆕 not in SRS | Phase 3 |
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

- [ ] **Staff Login (Fig 20.0)** — confirm if `Login_Prototype.png` covers it or add a dedicated image
- [ ] **SRS update** — list the new screens (Audit Logs, Edit Key, Edit User, Scan, Processing, Order) in the SRS figure list
- [ ] **Fix filename typos**: `Admin_Dashboard_Prototyppe.png` → `Admin_Dashboard_Prototype.png`, `Edit_Answer_Key_Modal_Prorotype.png` → `Edit_Answer_Key_Modal_Prototype.png`
- [ ] **Visual verification** — confirm actual UI elements (fields, buttons, sidebar) against these entries

---

## Related
- [[AI - Implementation Plan]]
- [[Software Requirement Specification (SRS)]]
- [[Software Design Description (SDD)]]
- [[Agents - Task and Rules]]