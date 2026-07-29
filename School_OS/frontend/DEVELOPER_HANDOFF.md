# Teacher Portal - Developer Handoff & Progress Log

This document outlines the current progress, architectural approaches, and state of the **Teacher Portal** module within School OS. It should be maintained and updated at the end of every major development session to allow any developer to quickly understand what has been built and how to seamlessly continue development.

## 1. Architectural Approach & Design Philosophy

The Teacher Portal was built following **"The Digital Atheneum"** design philosophy. The core tenets are:
*   **Vibrant & Premium Aesthetics:** We lean heavily into glassmorphism (`.glass-panel`), carefully selected dynamic gradients (`bg-gradient-premium`), and specific shadow depths (`shadow-premium`) defined in `tailwind.config.js`.
*   **Zero-Border Sectioning:** Soft background contrast (e.g., `bg-surface-container-low` vs `bg-white`) separates content blocks rather than harsh lines.
*   **Interactive Micro-Animations:** Almost all actionable elements provide hover or transit feedback (e.g., `-translate-y-1`, `group-hover:scale-110`).

### State & Logic Handling Approach
*   **Dynamic API Integration**: The module is fully connected to the Django REST API via the `useTeacherData` hook and the `useCurrentClass` hook.
*   **Centralized Tracking**: Project credentials and environment patches are tracked in `PROJECT_STATUS.md` at the root.

## 2. Completed Milestones & Current State

The routing framework for the Teacher Portal has been actively integrated into `App.tsx` replacing previous placeholder dashboards.

### A. Dashboard (`TeacherDashboardHome.tsx`)
*   **Functionality:** Serves as the "Flight Deck". Displays the ongoing/next class layout.
*   **Backend Status:** ✅ Connected. Uses `useCurrentClass` hook which fetches from `/timetable/time-slots/` and maps `subject_details.name` + `class_details.name`.

### B. Assessments & Marks (`TeacherAssessmentsPage.tsx`)
*   **Functionality:** A spreadsheet-style gradebook grid with auto-save.
*   **Backend Status:** ✅ Fully integrated with `/assessments/results/` (GET) and `/students/students/` (GET). Merges student lists with exam scores.

### C. Digital Logbook (`TeacherLogbookPage.tsx`)
*   **Functionality:** A chronological tracker for weekly lesson pacing and documentation logging.
*   **Backend Status:** ✅ POSTs to `/logbook/entries/`. The backend `perform_create` auto-fills `tenant` and `teacher` from auth context.

### D. Session Timetable (`TeacherTimetablePage.tsx`)
*   **Functionality:** A premium, horizontal grid displaying the week's layout.
*   **Backend Status:** ✅ Connected to `/timetable/time-slots/`. `TimeSlotSerializer` now includes `class_details` (via timetable.class_obj) and `subject_details`.

### E. Lesson Planner (`TeacherPlannerPage.tsx`)
*   **Functionality:** A workspace structured strictly around the **5E Instructional Model** (Engage, Explore, Explain, Elaborate, Evaluate).
*   **Backend Status:** ✅ Auto-saves to `/logbook/schemes/` using `update_or_create` to handle repeated saves to the same week gracefully.

### F. Strategic Assignment Manager (`TeachingAssignmentModal.tsx`)
*   **Functionality:** Managed via the Faculty Directory. Allows admins to dynamically assign subjects and classes to teachers without re-onboarding.
*   **Implementation:** Integrated into `TeacherDirectory.tsx`.

### G. Seamless Portal Switcher (`PortalSwitcher.tsx`)
*   **Functionality:** A persistent UI toggle for dual-role users (Admin + Teacher) to swap dashboards instantly.
*   **Logic:** Favoring the Teacher Portal as the default landing page for faculty leaders.

## 3. API Endpoint Reference

| Feature | Method | Endpoint | Notes |
|:---|:---|:---|:---|
| Time Slots | GET | `/timetable/time-slots/` | Returns `subject_details`, `class_details`, `teacher_details` |
| Students | GET | `/students/students/` | Filterable by `?current_class=<id>` |
| Exam Results | GET/PATCH | `/assessments/results/` | Score updates via PATCH |
| Logbook Entry | POST | `/logbook/entries/` | Auto-fills tenant, teacher |
| Scheme of Work | POST | `/logbook/schemes/` | Uses update_or_create on unique (tenant, year, term, subject, class, week) |
| Assignments | GET/POST/DEL| `/staff/assignments/` | Supports `my_assignments/` and filtering by tenant |

## 4. Known Issues & Recent Fixes
*   **Fixed (Apr 19):** Backend 500 error in `my_assignments` resolved by adding the `tenant` field to `TeachingAssignment` model and ensuring strict multi-tenant isolation in `BaseTenantViewSet`.
*   **Fixed (Apr 19):** Institutional Directory missing names — added `full_name` to `UserSerializer`.
*   **Fixed (Apr 19):** Login Redirection Bug — Dr. Song (dual-role) landing on `/admin` instead of `/teacher`. Resolved via `PortalRedirect` in `App.tsx`.
*   **Fixed (Apr 19):** 3 API endpoint URL mismatches between frontend and backend (`exam-results` → `results`, `logbook-entries` → `entries`, `scheme-of-work` → `schemes`).
*   **Fixed (Apr 19):** `useCurrentClass` used wrong field names (`timetable.class_obj.name` → `class_details.name`).
*   **Fixed (Apr 19):** Planner auto-save caused `UNIQUE constraint failed` — resolved with `update_or_create`.
*   **Fixed (Apr 19):** Logbook/Planner POST returned 400 — resolved by adding `perform_create` overrides and `read_only_fields` to serializers.

## 5. Next Steps for Development

1.  **Program Coverage Page:** The `/teacher/coverage` route currently still points to the `PlaceholderDashboard`. A "Program Coverage" view depicting curriculum macro-completion needs to be designed and built.
2.  **Assignment Conflict Detection:** The `TeachingAssignmentModal` should ideally prevent overlapping schedules before submission.
3.  **Extract Auto-Save Hook:** The debounced auto-save effect lives redundantly in Assessments and Planner. Extract into `useAutoSave<T>`.
4.  **Environment Reversion:** Re-install `django-filter` and `Pillow` once network is restored (see `PROJECT_STATUS.md`).
