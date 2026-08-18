# School_OS — Audit Fix Implementation Plan

**Date:** August 18, 2026
**Scope:** Fix all issues from the codebase audit EXCEPT government portal (deferred to v2)
**Reference:** `Docs/CODEBASE_AUDIT_REPORT.md`

---

## Phase 1: Dead Code Cleanup (Quick Wins)

No functional changes — just removing dead weight from the codebase.

### 1.1 — Delete Frontend Dead Files

| # | File | Action |
|---|---|---|
| 1.1.1 | `frontend/src/pages/admin/academic/GradingControls.tsx` | **Delete.** Replaced by ExamWorkflow.tsx. Route already redirects. |
| 1.1.2 | `frontend/src/components/admin/ComparisonWidget.tsx` | **Delete.** Never imported. |
| 1.1.3 | `frontend/src/components/admin/TimeSavedWidget.tsx` | **Delete.** Never imported. |
| 1.1.4 | `frontend/src/stores/backNavStore.ts` | **Delete.** Never imported. |
| 1.1.5 | `frontend/src/utils/cn.ts` | **Delete.** Never imported. |
| 1.1.6 | `frontend/src/types/academic.ts` | **Delete.** Never imported. Pages define types inline. |
| 1.1.7 | `frontend/_ssr_test.tsx` | **Delete.** Standalone test script, not part of the app. |
| 1.1.8 | `frontend/_ssr_test.cjs` | **Delete.** Standalone test script, not part of the app. |
| 1.1.9 | `frontend/src/layouts/` | **Delete empty directory.** |
| 1.1.10 | `frontend/src/data/` | **Delete empty directory.** |

### 1.2 — Remove Unused npm Dependencies

| # | Package | Action |
|---|---|---|
| 1.2.1 | `jwt-decode` | Run `npm uninstall jwt-decode` |
| 1.2.2 | `clsx` | Run `npm uninstall clsx` |
| 1.2.3 | `tailwind-merge` | Run `npm uninstall tailwind-merge` |

### 1.3 — Delete Backend Dead Serializers

| # | Serializer | File | Action |
|---|---|---|---|
| 1.3.1 | `GradeScaleSerializer` | `backend/apps/assessments/serializers.py` | Remove class definition. Keep `GradeBoundarySerializer` (used nested). |
| 1.3.2 | `UserRoleMappingSerializer` | `backend/apps/authentication/serializers.py` | Remove class definition. No view uses it. |
| 1.3.3 | `StudentInvoiceLineItemSerializer` | `backend/apps/finance/serializers.py` | Remove class definition. Views use `InvoiceLineItemSerializer`. |

### 1.4 — Clean Up Backend Miscellany

| # | Item | Action |
|---|---|---|
| 1.4.1 | `TestEmailSerializer` | Remove from `notifications/serializers.py`. Replace with inline serializer in the test endpoint if needed. |
| 1.4.2 | `seed_data.py` | Fix inconsistent indentation so the script doesn't crash. |

**Estimated effort:** 1-2 hours
**Risk:** Very low — purely removing unused code

---

## Phase 2: Fix Broken Integrations

### 2.1 — Fix CommunityEthos `/community/values/` Call

The frontend `CommunityEthos.tsx` calls `api.get('/community/values/')` but no community app exists.

**Options:**
- **Option A (Recommended):** Convert CommunityEthos to use existing backend data. Replace the `/community/values/` call with data from announcements, school info, or a static config. The page already fetches students, attendance, and sections successfully — just the "values" call is broken.
- **Option B:** Create a minimal `community` backend app with a `CommunityValue` model and API endpoint. Only worth it if community values are a real feature.

**Recommended approach — Option A:**
1. Remove the `api.get('/community/values/')` call from `CommunityEthos.tsx`
2. Replace with hardcoded community values array or fetch from tenant config
3. Verify the rest of the page (students, attendance, sections) still works

### 2.2 — Fix Government Serializer Field References

| # | Serializer | Fix |
|---|---|---|
| 2.2.1 | `InspectorSerializer` | Change `government_role` to `is_government_official` |
| 2.2.2 | `SchoolSerializer` | Change `school_code` to `slug`, `city` to `division`, `is_active` to `status` |

**Note:** These will be needed when government portal v2 is built, so fix them now to prevent future confusion.

**Estimated effort:** 1-2 hours
**Risk:** Low — isolated fixes

---

## Phase 3: Wire In Orphaned Frontend Components

### 3.1 — Wire `ComparisonWidget` Into Admin Dashboard

The `ComparisonWidget` was built to show school benchmark comparisons but never imported.

| # | Action |
|---|---|
| 3.1.1 | Import `ComparisonWidget` in `DashboardHome.tsx` |
| 3.1.2 | Add it to the dashboard grid layout (next to existing stat cards) |
| 3.1.3 | Verify the `/reports/comparison/` endpoint returns data |
| 3.1.4 | Test rendering with real data |

### 3.2 — Wire `TimeSavedWidget` Into Admin Dashboard or Audit Page

| # | Action |
|---|---|
| 3.2.1 | Import `TimeSavedWidget` in `DashboardHome.tsx` or `AuditLogs.tsx` |
| 3.2.2 | Add it to the appropriate grid |
| 3.2.3 | Test rendering |

**Estimated effort:** 1-2 hours
**Risk:** Low — components already exist, just need importing

---

## Phase 4: Fix Backend Infrastructure

### 4.1 — Re-enable `django-filter`

| # | Action |
|---|---|
| 4.1.1 | Add `django-filter` to `requirements.txt` |
| 4.1.2 | Re-enable `django_filters` in `INSTALLED_APPS` in `settings.py` |
| 4.1.3 | Re-enable `django_filters` in `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS` |
| 4.1.4 | Verify no import errors on server start |

### 4.2 — Re-enable `Pillow` for Image Handling

| # | Action |
|---|---|---|
| 4.2.1 | Add `Pillow` to `requirements.txt` |
| 4.2.2 | Revert `User.profile_photo` from `CharField` to `ImageField` in `authentication/models.py` |
| 4.2.3 | Revert `Tenant.logo` from `CharField` to `ImageField` in `tenants/models.py` |
| 4.2.4 | Create migration for the field type change |
| 4.2.5 | Test profile photo upload and logo upload |

### 4.3 — Move `BaseTenantViewSet` to `core/views.py`

| # | Action |
|---|---|---|
| 4.3.1 | Move `BaseTenantViewSet` class from `academic/views.py` to `core/views.py` |
| 4.3.2 | Update imports in `students/views.py`, `staff/views.py`, `finance/views.py`, `academic/views.py` |
| 4.3.3 | Run tests to verify nothing breaks |

### 4.4 — Enforce `TenantConfig.finance_recording`

| # | Action |
|---|---|---|
| 4.4.1 | In `finance/views.py`, add a check in `PaymentTransactionViewSet.create()` and `ExpenseViewSet.create()` |
| 4.4.2 | If `finance_recording == 'bursar_only'` and user role is not bursar, reject with 403 |
| 4.4.3 | Test with both admin and bursar roles |

**Estimated effort:** 3-4 hours
**Risk:** Medium — involves model changes and migrations

---

## Phase 5: Fix Duplicated Code & Extract Shared Utilities

### 5.1 — Extract Shared Auto-Save Hook

The debounced auto-save logic is duplicated in `TeacherAssessmentsPage` and `TeacherPlannerPage`.

| # | Action |
|---|---|---|
| 5.1.1 | Create `frontend/src/hooks/useAutoSave.ts` |
| 5.1.2 | Move debounced PUT/PATCH logic into the hook with generic typing: `useAutoSave<T>(endpoint: string, data: T, delay?: number)` |
| 5.1.3 | Refactor `TeacherAssessmentsPage.tsx` to use `useAutoSave` |
| 5.1.4 | Refactor `TeacherPlannerPage.tsx` to use `useAutoSave` |
| 5.1.5 | Test both pages auto-save behavior |

### 5.2 — Fix `seed_data.py` Indentation

| # | Action |
|---|---|---|
| 5.2.1 | Fix the inconsistent indentation in lines 73-131 so the script runs without IndentationError |
| 5.2.2 | Verify the script runs successfully |

**Estimated effort:** 1-2 hours
**Risk:** Low

---

## Phase 6: Complete Partially Implemented Features

### 6.1 — Assignment Conflict Detection

| # | Action |
|---|---|---|
| 6.1.1 | In `TeachingAssignmentModal.tsx`, before submitting a new assignment, fetch existing assignments for the same teacher |
| 6.1.2 | Check for time slot overlaps (same class, same time, same teacher) |
| 6.1.3 | Show a warning/conflict dialog if overlap detected |
| 6.1.4 | Optionally block submission or allow override with confirmation |

### 6.2 — Bulk Import Dry-Run Mode

| # | Action |
|---|---|---|
| 6.2.1 | Add a `dry_run=true` query parameter to the `bulk-import` endpoints (students + teachers) |
| 6.2.2 | In the backend, process the CSV but skip actual database writes — return validation results only |
| 6.2.3 | In `BulkCsvUpload.tsx`, add a "Preview" button that calls with `dry_run=true` |
| 6.2.4 | Show preview results before allowing the user to commit |

### 6.3 — Teacher Photo Upload

| # | Action |
|---|---|---|
| 6.3.1 | Depends on Phase 4.2 (Pillow re-enablement) |
| 6.3.2 | In `TeacherProfileEdit.tsx`, verify the photo upload endpoint works with ImageField |
| 6.3.3 | Test the full upload → display flow |

### 6.4 — Marketplace Contact Flow

| # | Action |
|---|---|---|
| 6.4.1 | Add a "Contact Teacher" button to `TeacherMarketplace.tsx` |
| 6.4.2 | On click, show a modal with a simple message form |
| 6.4.3 | POST to `/notifications/messages/` with the teacher as recipient |
| 6.4.4 | Show success toast after sending |

**Estimated effort:** 4-6 hours
**Risk:** Medium — new feature development

---

## Phase 7: Notification Optimization

### 7.1 — Use Unread-Count Endpoints

The backend has `unread-count` actions on notifications, messages, and announcements — but the frontend fetches full lists instead.

| # | Action |
|---|---|---|
| 7.1.1 | In `NotificationsDropdown.tsx`, use `/notifications/notifications/unread-count/` instead of fetching full unread list for the badge count |
| 7.1.2 | Only fetch the full list when the dropdown is opened |
| 7.1.3 | Same pattern for messages and announcements unread counts |
| 7.1.4 | This reduces unnecessary API calls on every page load |

**Estimated effort:** 1 hour
**Risk:** Very low

---

## Execution Order & Dependencies

```
Phase 1 (Dead Code Cleanup)      ← Start here, no dependencies
    ↓
Phase 2 (Fix Broken Integrations) ← Can run parallel with Phase 1
    ↓
Phase 3 (Wire Orphaned Components) ← After Phase 1 cleanup
    ↓
Phase 4 (Backend Infrastructure)   ← Independent, but do after Phase 1
    ↓
Phase 5 (Shared Utilities)         ← After Phase 1 cleanup
    ↓
Phase 6.1 (Conflict Detection)     ← After Phase 4
Phase 6.2 (Bulk Import Dry-Run)    ← Independent
Phase 6.3 (Teacher Photo Upload)   ← Depends on Phase 4.2 (Pillow)
Phase 6.4 (Marketplace Contact)    ← Independent
    ↓
Phase 7 (Notification Optimization) ← Independent, can be anytime
```

---

## Summary

| Phase | Description | Effort | Risk |
|---|---|---|---|
| 1 | Dead code cleanup | 1-2 hrs | Very Low |
| 2 | Fix broken integrations | 1-2 hrs | Low |
| 3 | Wire orphaned components | 1-2 hrs | Low |
| 4 | Backend infrastructure fixes | 3-4 hrs | Medium |
| 5 | Extract shared utilities | 1-2 hrs | Low |
| 6 | Complete partial features | 4-6 hrs | Medium |
| 7 | Notification optimization | 1 hr | Very Low |
| **Total** | | **12-19 hrs** | |

---

## What's NOT In This Plan (Deferred to Gov v2)

- Government portal pages (GovInspections, GovPolicy, GovSupport) — full static shells
- Government serializer fixes (will be done when building gov v2 properly)
- Government app frontend-backend wiring
- Any new government features
