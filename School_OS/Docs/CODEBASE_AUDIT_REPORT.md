# School_OS — Full Codebase Audit Report

**Date:** August 18, 2026
**Scope:** Backend APIs, frontend integration, dead code, orphaned files, broken features

---

## 1. Backend APIs Created But Not Used by Frontend

### 1.1 — Endpoints With No Frontend Consumer

| Backend Endpoint | App | Notes |
|---|---|---|
| `GET /api/v1/assessments/exams/` | assessments | No frontend page lists or creates exams directly |
| `POST /api/v1/assessments/exams/` | assessments | No frontend call |
| `GET /api/v1/assessments/results/` | assessments | Frontend only uses mark-windows, not raw exam results |
| `POST /api/v1/assessments/results/` | assessments | No frontend call |
| `GET/POST /api/v1/gov/inspections/` | government | GovInspections.tsx is a static shell, never calls API |
| `GET/POST /api/v1/gov/findings/` | government | No frontend consumer |
| `GET/POST /api/v1/gov/corrective-actions/` | government | No frontend consumer |
| `GET/POST /api/v1/gov/documents/` | government | No frontend consumer |
| `GET/POST /api/v1/gov/schedules/` | government | No frontend consumer |
| `GET /api/v1/gov/inspector-dashboard/` | government | Only called from admin, not /gov/ portal |
| `GET/POST /api/v1/students/discipline/` | students | DisciplineAndTransfers.tsx exists but integration unverified |
| `GET/POST /api/v1/students/transfers/` | students | Frontend page exists but integration unverified |
| `GET/POST /api/v1/students/promotions/` | students | Promotion uses promote/ action, not this CRUD endpoint |
| `GET/POST /api/v1/staff/leave-requests/` | staff | No frontend page for teacher leave requests |
| `GET/POST /api/v1/staff/performance-reviews/` | staff | FacultyPerformance.tsx exists but integration unverified |
| `GET/POST /api/v1/documents/files/` | documents | No dedicated frontend page for document management |
| `GET/POST /api/v1/documents/categories/` | documents | No frontend consumer |
| `GET /api/v1/notifications/notifications/unread-count/` | notifications | No frontend consumer — fetches full list instead |
| `GET /api/v1/notifications/messages/unread-count/` | notifications | No frontend consumer |
| `GET /api/v1/notifications/announcements/unread-count/` | notifications | No frontend consumer |
| `POST /api/v1/timetable/timetables/{id}/generate/` | timetable | No frontend button triggers auto-generation |
| `POST /api/v1/timetable/timetables/{id}/approve/` | timetable | No frontend approval workflow |
| `POST /api/v1/timetable/timetables/{id}/commit/` | timetable | No frontend commit workflow |
| Multiple timetable solver actions (~15) | timetable | No frontend consumers |
| `POST /api/v1/finance/invoices/ensure-invoices/` | finance | No frontend consumer |
| `POST /api/v1/finance/invoices/send-reminders/` (bulk) | finance | Only individual send-reminder is called |
| `GET /api/v1/finance/invoices/{id}/statement/` | finance | No frontend consumer |
| `GET /api/v1/finance/transactions/{id}/receipt/` | finance | No frontend consumer |
| `GET /api/v1/logbook/schemes/` | logbook | Teacher logbook uses entries/ not schemes/ directly |
| `POST /api/v1/logbook/lessons/generate/` | logbook | No frontend consumer |
| `POST /api/v1/logbook/lessons/import/` | logbook | No frontend consumer |
| `GET /api/v1/logbook/lessons/suggested/` | logbook | No frontend consumer |

### 1.2 — Serializers Defined But Never Used

| Serializer | File | Status |
|---|---|---|
| `GradeScaleSerializer` | `assessments/serializers.py` | Never referenced in any view |
| `UserRoleMappingSerializer` | `authentication/serializers.py` | Never referenced in any view |
| `StudentInvoiceLineItemSerializer` | `finance/serializers.py` | Never referenced — views use InvoiceLineItemSerializer |

### 1.3 — Broken Serializer Field References

| Serializer | Issue |
|---|---|
| `InspectorSerializer` (government) | References `government_role` on User — field does not exist (should be `is_government_official`) |
| `SchoolSerializer` (government) | References `school_code`, `city`, `is_active` on Tenant — fields do not exist (should be `slug`, `division`, `status`) |

---

## 2. Frontend Features That Don't Work or Aren't Implemented

### 2.1 — Broken Backend Integration

| Frontend Call | File | Issue |
|---|---|---|
| `api.get('/community/values/')` | `CommunityEthos.tsx:15` | **No community app exists in the backend.** This call will 404. The entire CommunityEthos page is non-functional. |

### 2.2 — Static/Placeholder Pages (No API Integration)

| Page | Route | Issue |
|---|---|---|
| `GovInspections.tsx` | `/gov/inspections` | 21 lines. Pure static JSX. Button has no handler. (Deferred to gov v2) |
| `GovPolicy.tsx` | `/gov/policy` | 29 lines. Hardcoded content, non-functional downloads. (Deferred to gov v2) |
| `GovSupport.tsx` | `/gov/support` | 14 lines. Button with no onClick. (Deferred to gov v2) |
| `PlaceholderDashboard` | `/unauthorized` | Inline component — title + logout button only. |

### 2.3 — Partially Implemented Features

| Feature | Route | Issue |
|---|---|---|
| Integrations page | `/admin/settings/integrations` | Only Email/SMTP works. 5 others show "coming soon" toast. |

### 2.4 — Planned Features Not Yet Built

| Feature | Status |
|---|---|
| Assignment Conflict Detection | Not implemented in TeachingAssignmentModal |
| Auto-save Hook Extraction | Duplicated debounced auto-save in Assessments and Planner |
| Teacher Rating System | No endpoint for schools/admins to rate teachers |
| Teacher Photo Upload | Backend uses CharField instead of ImageField (missing Pillow) |
| Marketplace Contact Flow | No "Request to Hire" or "Contact Teacher" from marketplace |
| Bulk Import Dry-Run | No preview-only mode before committing |
| `django-filter` Re-enablement | Disabled in settings due to missing package |
| `Pillow` Re-enablement | ImageField reverted to CharField |

---

## 3. Dead Code & Orphaned Files

### 3.1 — Frontend Dead Code Files

| File | Lines | Issue |
|---|---|---|
| `GradingControls.tsx` | 221 | Fully functional page — replaced by ExamWorkflow.tsx but never deleted |
| `ComparisonWidget.tsx` | — | Fully built dashboard widget — never imported anywhere |
| `TimeSavedWidget.tsx` | — | Fully built dashboard widget — never imported anywhere |
| `backNavStore.ts` | — | Zustand store — never imported by any file |
| `cn.ts` | — | Utility function (clsx + tailwind-merge) — never imported |
| `types/academic.ts` | 127 | 13 TypeScript interfaces — never imported. Pages define types inline |
| `_ssr_test.tsx` / `_ssr_test.cjs` | — | Standalone test scripts — not part of the app |
| `src/layouts/` | — | Empty directory |
| `src/data/` | — | Empty directory |

### 3.2 — Unused npm Dependencies

| Package | Reason |
|---|---|
| `jwt-decode` | Never imported — auth store handles tokens directly |
| `clsx` | Only imported by cn.ts which is itself never used |
| `tailwind-merge` | Only imported by cn.ts which is itself never used |

### 3.3 — Backend Dead Code

| Item | Location | Issue |
|---|---|---|
| `seed_data.py` | `backend/seed_data.py` | Inconsistent indentation — would crash if run directly |
| `TestEmailSerializer` | `notifications/serializers.py` | Debug utility that should not be in production |
| `BaseTenantViewSet` | `academic/views.py` | Cross-app dependency — should be in core/views.py |
| `Tenant.subscription_plan` | `tenants/models.py` | Field exists but no enforcement logic |
| `TenantConfig.finance_recording` | `tenants/models.py` | Field exists but no enforcement in finance views |
| `SchoolPerformanceReport.is_submitted_to_gov` | `reports/models.py` | Flag exists but no automated submission pipeline |

---

## 4. Summary

| Category | Count |
|---|---|
| Backend endpoints with no frontend consumer | ~30+ |
| Broken frontend-to-backend calls | 1 (community/values) |
| Dead serializers | 3 |
| Broken serializer field references | 2 |
| Static/placeholder frontend pages | 3 (gov, deferred) |
| Dead frontend code files | 7 |
| Empty frontend directories | 2 |
| Unused npm packages | 3 |
| Backend features with no enforcement | 3 |
| Planned features not built | 6 |
