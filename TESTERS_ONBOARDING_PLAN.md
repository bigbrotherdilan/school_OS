# Tester Onboarding & Bursar/Parent Workflows — Implementation Plan

Status: Approved — In Progress
Date: August 7, 2026

## Goal

Get 12 testers working, one per school, on the 12 real Cameroon schools that are
currently empty (no admins, students, or teachers). Testers receive the admin
credentials for "their" school, then create teachers, bursars, and parents
themselves using those credentials. Email is NOT configured, so every created
account must display its temporary password on screen for the admin to hand
over manually.

## Current State (verified)

- 14 tenants exist; 12 real schools (from `seed_real_schools`) are **completely
  empty** — 0 admins, 0 classes, 0 subjects, 0 academic years, 0 students,
  0 teachers. The 2 dev schools (Saint Joseph, Greenfield) are populated.
- Teacher/bursar onboarding **emails** the temp password and never returns it
  to the admin → the password is lost when email is off.
- Parents: role mappings are per-school; a parent linked to children in
  another school is blocked by the tenant middleware unless they have a role
  mapping there. No "Add Parent" UI exists.
- Finance: both admin and bursar can record transactions; no way to restrict
  recording to the bursar only. Online payment endpoints are mock
  (auto-confirm, no real gateway).

## Phases

### Phase 1 — 12 School Admins + Baseline Academic Setup (Tester Readiness)

New management command: `python manage.py setup_tester_schools`

For each of the 12 real schools (idempotent — safe to re-run):
1. Create admin user `admin.<slug>@schoolos.sos` with a unique 12-char temp
   password, `must_change_password=True`, role mapping `admin`.
2. Seed baseline so testers can immediately register students and add
   teachers/bursars (teacher onboarding requires subject/class/academic year):
   - AcademicYear `2026/2027` (active) + 3 Terms + 6 Sequences
   - Cycles (1st/2nd), Sections (Anglophone `en` / Francophone `fr` per
     `education_type`; bilingual gets both)
   - Classes via `recommended_classes` (Form 1–Upper Sixth / 6ème–Terminale)
   - Subjects via `recommended_subjects` + `ClassSubject` links + 2nd-cycle
     Series
3. Writes `tester_credentials.csv` at repo root (school, admin email, password)
   and prints the same table to the console.

### Phase 2 — On-Screen Password Delivery (Email Off)

- Backend: `onboard_bursar`, `TeacherViewSet.onboard`, `UserViewSet.create`
  (`UserCreateSerializer`) and `reset-password` return `temp_password` in the
  API response (previously only emailed).
- Frontend: success screens for Add Bursar / Add Faculty / Add Parent show a
  highlighted "Temporary Password" card with a copy-to-clipboard button and a
  warning that it is shown only once.

### Phase 3 — Global Parents (No School Binding)

- `TenantMiddleware`: a user holding an active `parent` role mapping (in any
  school) passes the tenant isolation check for every active tenant. Security
  is preserved because every parent endpoint filters strictly by
  `ParentStudentRelationship(parent_user=request.user)` — a parent only ever
  sees their own linked children, in any school.
- New endpoint `POST /api/v1/staff/parents/onboard/` (school admin):
  create parent user + `parent` role mapping at the current school (the "home"
  mapping that puts `parent` in their JWT) + optional student links +
  returns `temp_password`.
- `ParentStudentLinkViewSet` gains `search` (find global parents by email/name
  across all schools) and `link` (link an existing parent to a student by
  email — no tenant mapping required) actions.
- New frontend page `Add Parent` (`/admin/operations/parents/new`) with two
  modes: **Create new parent** (form + student multi-select + password screen)
  and **Link existing parent** (search by email → link to student). Entry card
  added to Operations Center.

### Phase 4 — Bursar-Only Finance Recording (School-Level Toggle)

- `TenantConfig.finance_recording`: `admin_and_bursar` (default) |
  `bursar_only`.
- New permission `CanWriteFinance` (`apps/finance/permissions.py` or in
  authentication permissions): bursar always allowed; admin allowed only when
  config is `admin_and_bursar`. Applied to all finance write actions
  (transactions, expenses, categories, structures, invoice
  create/generate/batch-generate). Reads stay open to admin.
- `school-config` serializer exposes the field; admin Finance page gets the
  toggle. When `bursar_only`: admin UI hides the record-payment/expense
  actions (Record Payment route shows a read-only notice).

### Phase 5 — Online Payments (Future — Planned, Not Built)

Current mock endpoints: `POST /finance/payments/initiate/` and
`POST /students/parent-payment/` auto-confirm with fake references. When a
gateway is available (MTN MoMo / Orange Money / Paystack):

1. Add `PaymentTransaction.status` (`pending|success|failed`) + provider
   reference + `attempted_at`.
2. `initiate_payment`/`parent-payment` create a `pending` transaction and
   return the provider checkout/redirect payload instead of auto-confirming.
3. New public webhook view (`/api/v1/finance/webhooks/<provider>/`) verifies
   the callback signature, flips status to `success`, applies the payment to
   the invoice, sends notifications.
4. Frontend `PaymentModal` polls `GET /finance/payments/<ref>/` until success
   or failure instead of jumping straight to success.
5. `.env`: `MOMO_API_KEY`, `MOMO_SUBSCRIPTION_KEY`, `MOMO_ENV`, or
   `PAYSTACK_SECRET_KEY`.

## Verification

- `python manage.py check` + migrations
- `python manage.py setup_tester_schools` → CSV + table output
- Backend smoke tests via Django shell / curl for each new endpoint
- Frontend: `npm run build` (tsc + vite)

## Files Touched

| Area | Files |
|---|---|
| Phase 1 | `backend/apps/tenants/management/commands/setup_tester_schools.py` (new), `tester_credentials.csv` (generated) |
| Phase 2 | `backend/apps/staff/views.py`, `backend/apps/authentication/serializers.py`, `backend/apps/authentication/views.py`; frontend `AddBursarPage.tsx`, `AddFacultyPage.tsx`, new `CredentialsCard.tsx` |
| Phase 3 | `backend/apps/tenants/middleware.py`, `backend/apps/staff/views.py` (+urls), `backend/apps/students/views.py` (+urls), `backend/apps/students/serializers.py`; frontend `AddParentPage.tsx` (new), `OperationsCenter.tsx`, `App.tsx` |
| Phase 4 | `backend/apps/tenants/models.py`, `backend/apps/finance/permissions.py` (new), finance views, `backend/apps/tenants/serializers.py`; frontend admin finance pages |
| Phase 5 | — (future) |
