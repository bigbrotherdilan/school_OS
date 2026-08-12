# School OS (SOS) — System Design Document

**Version:** 1.0 (living document — updated as the system grows)
**Status:** Grounded in the *actual implemented codebase* (this is the source of truth), with design-vision documents referenced where they guide future work.

> This document is written for one purpose: to let you (the owner) answer technical questions from engineers, architects, and contractors about how School OS is actually designed and built. Every claim here maps to real code paths you can point to.
> Related design-vision docs live alongside this file and describe intent/roadmap: `source_of_truth.md`, `technical_bleprint.md`, `microservices_architecture.md`, `data_mode_specifications.md`, `DevOps.md`, `Security&Complience.md`, `tech_stack.md`.

---

## 1. What School OS Is

School OS (SOS) is a **multi-tenant SaaS platform** that lets a school run paperless — students, staff, classes, timetables, lesson schemes of work, digital logbooks, marks, report cards, fees/payments, attendance, communications, ID cards — while giving the government/ministry an **aggregated, read-only analytics layer** over all schools.

- One **school = one tenant**.
- Every school sees only its own data (enforced at the middleware + query layer, not just in the UI).
- Users log in once and can belong to **many tenants** (a teacher can teach at two schools; a parent can have children at several schools).
- The system is bilingual-ready: **Anglo-Saxon and Francophone** structures, grading systems, and terminology are first-class (Form 1–5 / 6ème–3ème, GCE / Baccalauréat, coefficients, sequences).

**The core promise:** teacher records work in seconds; the school runs paperless; the ministry sees live, aggregated national intelligence without ever touching raw school data.

---

## 2. Architecture at a Glance

The current implementation is a **modular monolith** (one Django project, many focused Django apps) that serves a **React SPA**, deployed as a single deployable unit. It is designed so domain boundaries are clean enough to split into services later without a rewrite.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Users (Browsers / PWA)                         │
│   Admin · Teacher · Bursar · Parent · Government · Public visitors     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + JSON (axios)
                                    ▼
                      ┌──────────────────────────┐
                      │   React 19 SPA (Vite)    │   frontend/
                      │ 5 portals + public site  │
                      └──────────────────────────┘
                                    │  /api/v1/...  + X-Tenant-ID + Bearer JWT
                                    ▼
        ┌────────────────────────────────────────────────────────────┐
        │  Django 5 + Django REST Framework (single process)         │  backend/
        │                                                             │
        │  Middleware stack (order matters):                          │
        │   SecurityHeaders → RequestID → WhiteNoise → Session → CORS │
        │   → Auth → TenantMiddleware → FinanceSession → Audit        │
        │                                                             │
        │  Apps (bounded contexts):                                   │
        │   tenants · authentication · academic · students · staff    │
        │   timetable · logbook · assessments · reports · finance     │
        │   attendance · notifications · documents · government ·     │
        │   audit · public                                            │
        └─────────────────────────────────────┬──────────────────────┘
                                              ▼
                       ┌──────────────────────────────────┐
                       │  Relational DB                    │
                       │  SQLite (dev) / PostgreSQL (prod) │
                       │  Shared DB + tenant_id isolation  │
                       └──────────────────────────────────┘
        Caching: LocMemCache (dev) / Redis (prod) — tenant rows, public pages
        Storage: local filesystem (dev) / S3-compatible bucket (prod)
        Static/SPA: WhiteNoise serves built frontend/dist from Django
```

### Key architectural decisions (the "why")

| Decision | Why |
|---|---|
| **Modular monolith, not microservices** | One deployable, one DB, shared transactions. Correct call for current scale (a school, a region) — microservices would add operational cost with zero benefit now. The app boundaries map 1:1 to the microservices vision, so a later split is mechanical. |
| **Shared database + `tenant_id` column (logical isolation), NOT schema-per-tenant** | The design-vision docs (`source_of_truth.md`, `data_mode_specifications.md`) originally said schema-per-tenant. Implementation uses shared-DB row-level isolation because it is far cheaper to operate (one migration set, one backup, one pool) and isolation is enforced in middleware + every queryset. Vision docs have not been rewritten; **the code is the truth.** |
| **Role/permission checks in the DB, not only in the JWT** | The JWT carries a `roles` claim for convenience, but authorization always re-queries `UserRoleMapping` for the current tenant. This makes role changes effective immediately (no waiting for token expiry). |
| **Tenant context via `X-Tenant-ID` header, validated per request** | Stateless and simple. The middleware rejects requests with a missing/invalid/inactive tenant and double-checks the user actually has a role in that tenant. |
| **Django templates render the SPA + serve its assets** | Single origin in production: no separate static host, no CORS in prod, simpler ops. CORS config exists for local dev (Vite on :5173). |

---

## 3. Tech Stack (Actual)

### Backend — `backend/`
| Piece | Technology |
|---|---|
| Language / framework | Python + **Django 5.2** |
| API framework | **Django REST Framework 3.15** |
| Auth | **djangorestframework-simplejwt 5.5** (JWT, access + rotating refresh, blacklist) |
| DB (dev) | SQLite (file `db.sqlite3`) |
| DB (prod) | PostgreSQL via `psycopg2` — configured automatically when `DATABASE_URL` is set |
| Caching | LocMemCache (dev) / Redis (`django-redis` + hiredis) when `CACHE_REDIS_URL` set |
| Filters | `django-filter` |
| PDFs | **ReportLab 5** (report cards), `qrcode` (receipt QR codes) |
| Timetable solver | **Google OR-Tools** (CP-SAT) — `apps/timetable/solver.py` |
| Files | `django-storages[s3]` + `boto3` (S3-compatible) when `AWS_STORAGE_BUCKET_NAME` set |
| Static/SPA serving | WhiteNoise |
| Server | Gunicorn (see `Procfile`) |
| Secrets | `.env` / env vars (`DJANGO_SECRET_KEY` is mandatory; app refuses to start without it) |
| Image work | Pillow |

### Frontend — `frontend/`
| Piece | Technology |
|---|---|
| Framework | **React 19** + TypeScript 5.9 |
| Build | **Vite 8** (production build output: `frontend/dist`, served by Django) |
| Styling | Tailwind CSS 3 + `clsx`/`tailwind-merge` (`src/utils/cn.ts`) |
| Routing | **react-router-dom 7** (portal-scoped routes) |
| State | **Zustand 5** stores: `authStore`, `tenantStore`, `teacherStore`, `parentStore`, `govStore`, `sectionStore`, `toastStore` |
| HTTP | **axios** instance with token/tenant/session interceptors + 401 refresh queue (`src/services/api.ts`) |
| Icons | `lucide-react` |
| Data fetching | Custom hooks (`src/hooks/`) + direct API calls from pages |

### Dev/ops
- Python: `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`.
- Frontend scripts: `npm run dev` (Vite :5173), `npm run build` (`tsc -b && vite build`), `npm run lint`.
- Seeds: `backend/seed_data.py`, `seed_greenfield.py`, `seed_parent.py`.

---

## 4. Repository Structure

```
School_OS/
├── backend/
│   ├── manage.py
│   ├── config/            # settings.py, urls.py, wsgi, asgi
│   ├── apps/
│   │   ├── core/          # cross-cutting middleware (security headers, request IDs)
│   │   ├── authentication/# User, roles, sessions, JWT, RBAC permissions
│   │   ├── tenants/       # Tenant, TenantConfig, TenantMiddleware
│   │   ├── academic/      # AcademicYear, Term, Sequence, Cycle, Section, Series, Class, Subject, coefficients
│   │   ├── students/      # Student, parent links, discipline, transfers, promotions
│   │   ├── staff/         # Teacher profiles, TeachingAssignment, leave, reviews
│   │   ├── timetable/     # Timetable, TimeSlot, Lesson, unavailability, OR-Tools solver
│   │   ├── logbook/       # SchemeOfWork (lesson planner + coverage), modules, lessons, LogbookEntry
│   │   ├── assessments/   # GradeScale, GradeBoundary, MarkEntryWindow, Exam, ExamResult
│   │   ├── reports/       # ReportCardTemplate, StudentReportCard, performance reports, analytics
│   │   ├── finance/       # FeeCategory, FeeStructure, StudentInvoice, PaymentTransaction, expenses
│   │   ├── attendance/    # AttendanceSession, AttendanceRecord
│   │   ├── notifications/ # Announcements, DirectMessage, Notification, EmailSetting, email backend
│   │   ├── documents/     # Document, IDCardTemplate, GeneratedIDCard
│   │   ├── government/    # national dashboard, monitoring, ministry export
│   │   ├── audit/         # AuditLog + AuditMiddleware
│   │   ├── public/        # public site API (schools, enrollment inquiries, teacher marketplace)
│   │   └── tenants/management/commands, etc.
│   ├── media/             # dev file storage (photos, report card PDFs)
│   └── requirements*.txt, Procfile, seed scripts
├── frontend/
│   ├── src/
│   │   ├── services/api.ts        # axios + auth/tenant interceptors
│   │   ├── stores/                # Zustand stores
│   │   ├── hooks/                 # useAuthLogin, useTeacherData, useTenantTheme, ...
│   │   ├── components/            # layout/, ui/, admin/
│   │   ├── pages/                 # admin/, teacher/, parent/, bursar/, gov/, auth/, public/
│   │   ├── types/, utils/         # academic.ts, cn.ts, pdf.ts, theme.ts
│   │   ├── App.tsx                # all routes + portal protection
│   │   └── main.tsx
│   └── package.json, vite.config, tailwind.config, ...
└── Docs/                 # vision + implementation docs (this file included)
```

---

## 5. Multi-Tenancy (How Isolation Actually Works)

### 5.1 The model — `backend/apps/tenants/models.py`
- `Tenant` = one school: `school_name`, `slug`, `education_type` (anglophone/francophone/bilingual), `school_type` (general/technical/vocational), `session_type`, `region`, `country`, `logo`, `theme_config` (JSON), `status` (pending/active/suspended), `subscription_plan`, `max_students`.
- `TenantConfig` = per-school runtime config: currency (`XAF`), grading scale max (`20`), grade thresholds (A/B/C), promotion cutoff, payment methods (MTN MoMo / Orange Money / bank), and `finance_recording` policy (admin+bursar vs bursar-only).
- **Every domain table carries a `tenant` FK** and is filtered by it. This is the isolation backbone.

### 5.2 Request flow — `TenantMiddleware` (`apps/tenants/middleware.py`)
1. Non-`/api/` paths pass straight through (SPA shell, static, admin).
2. Certain paths are **tenant-exempt**: auth login/register/refresh, `/api/v1/tenants`, `/api/v1/gov/`, health, public receipt verify, `pub/`, admin, static/media.
3. Otherwise the request **must** include `X-Tenant-ID`. Missing → `400`; invalid/inactive tenant → `403`.
4. Tenant lookup is **cached** (`cache key tenant:{id}`, TTL 60s, invalidated by `post_save`/`post_delete` signals) to avoid a DB hit per request.
5. **Double-check:** if a user is authenticated, they must have an active `UserRoleMapping` for that tenant → else `403 "You do not belong to this school."`.
   - Exception: a user holding the **parent** role anywhere may hit the parent-scoped endpoints for any tenant (parents can have children at multiple schools). Parent data is still strictly scoped to their own `ParentStudentRelationship` rows.

### 5.3 The answer to "how do you guarantee a school can't see another school's data?"
1. Middleware rejects requests without a valid tenant membership (already scoped at the door).
2. Every ViewSet filters its queryset by `request.tenant` (or by the user's own tenant-scoped records, e.g. a teacher's assignments).
3. `AuditMiddleware` records every data-modifying request with the tenant.
4. The **government layer never touches tenant rows** — it reads only aggregate snapshots.

---

## 6. Identity, Authentication & Authorization

### 6.1 Identity — `apps/authentication/models.py`
- `User` extends Django's `AbstractUser`, **UUID primary key**, login by **email** (`USERNAME_FIELD = 'email'`). Extra flags: `is_platform_admin` (super admin), `is_government_official` + `government_region` (ministry scoping), `failed_login_attempts` / `locked_until` (brute-force lockout), `must_change_password`, `password_changed_at` (token invalidation).
- `UserRoleMapping` = **the** authorization primitive: `(user, tenant, role, is_active)`, unique per `(user, tenant, role)`. Roles: `super_admin`, `admin`, `bursar`, `teacher`, `parent`, `student`, `government`. A user has many mappings across tenants — this is what makes "one account, many schools" possible.
- `UserSession` = server-side session tracking (device, IP, refresh-token hash) used for "your account is logged in on other devices" management and concurrent-session limits (`MAX_SESSIONS_PER_USER = 2`).

### 6.2 Auth endpoints (`apps/authentication/urls.py`)
`POST /api/v1/auth/login/` (SOS login: lockout check → credentials → returns access + refresh + user + roles + tenants), `auth/refresh/` (rotating refresh with blacklist), `auth/logout/` (blacklist + session close), `auth/me/`, `auth/change-password/`, `auth/upload-photo/`, `auth/password-reset-request/`, `auth/password-reset-confirm/`, `auth/sessions/` (+ kill session / kill-all), `auth/login/confirm-kill/`. Users CRUD via `/api/v1/users/`.

### 6.3 JWT design (`apps/authentication/serializers.py`, `backends.py`, `config/settings.py`)
- Access token **2h**, refresh **7 days**, rotation + blacklist enabled.
- Claims: `email`, `full_name`, `is_platform_admin`, `password_changed_at`, and `roles` (a `{tenant_id: [role, ...]}` map). **But servers never trust the claim** — permission classes re-query `UserRoleMapping`.
- `SOSJWTAuthentication` rejects any token issued *before* `password_changed_at` (password change kills all existing tokens).
- Login hardening:
  - **Account lockout**: 5 failed attempts → locked 15 min (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`).
  - **Breach check** at account creation: SHA-1 prefix (k-anonymity) against HaveIBeenPwned `api.pwnedpasswords.com`. Network failure never blocks registration.
  - Admin-created accounts get a temporary password + `must_change_password=True` (frontend forces `/force-password-change` before any portal).

### 6.4 RBAC permission classes (`apps/authentication/permissions.py`)
- `IsPlatformAdmin` (super admin bypasses everything).
- `IsSchoolAdmin` (admin/super_admin role in current tenant), `IsSchoolAdminOrBursar`.
- `CanWriteFinance` — **bursars always record; admins record only if `TenantConfig.finance_recording = 'admin_and_bursar'`** (a school can lock admins out of recording).
- `IsTeacher`, `IsParent`, `IsGovernment`, `IsSchoolMember`, `IsAdminOrTeacher`.
- Permission gates are per-action, not just per-view (e.g. the logbook SchemeOfWork viewset gates only `create/destroy/generate/import_schemes` to admins while teachers may PATCH their notes).

---

## 7. API Layer

### 7.1 Conventions (`config/settings.py`, `config/urls.py`)
- Base path: `/api/v1/<module>/...`. Public (no-auth) endpoints: `/pub/v1/...`. Health: `/api/v1/health/`.
- DRF defaults: JSON-only renderer (Browsable API in DEBUG), JWT auth, `IsAuthenticated` default, `PageNumberPagination` (**page size 25**), Django-filter + search + ordering backends.
- **Throttling** (rate limits): anon 100/h, user 1000/h, login 10/min, public 20/min, enrollment-per-school 5/min, and a dedicated high cap **`mark_entry: 6000/h`** so teachers' ~1-request-per-2s auto-save is never throttled mid-entry.
- Every response carries **`X-Request-ID`** (RequestIDMiddleware) for tracing.
- Error shape: DRF standard `{"detail": ...}` / field-errors objects; auth/tenant errors are explicit JSON with machine-readable `code`s.

### 7.2 Endpoint catalog (all under `/api/v1/`)
| Module | Routes |
|---|---|
| **auth** | `auth/login|refresh|logout|me|change-password|upload-photo|password-reset-*|sessions...`, `users/` |
| **tenants** | `tenants/` (CRUD, public list) |
| **academic** | `academic/academic-years`, `terms`, `sequences`, `cycles`, `sections`, `series`, `classes`, `subjects`, `class-subjects`, `section-subjects` |
| **students** | `students/`, `parent-student-links`, `discipline`, `transfers`, `promotions`, `upload-photo/`, parent endpoints (`parent-dashboard`, `parent-fees`, `parent-analytics`, `parent-payment`, `parent-receipts`, `parent-child-summary`, `parent-comparison`) |
| **staff** | `staff/teachers`, `assignments`, `leave-requests`, `performance-reviews`, `bursars/onboard`, `parents/onboard` |
| **timetable** | `timetable/timetables`, `time-slots`, `lessons`, `unavailability` |
| **logbook** | `logbook/schemes` (+ `generate/`, `import/`, `mark_taught/`, `mark_planned/`, `coverage/`), `entries`, `modules`, `lessons` |
| **assessments** | `assessments/mark-windows`, `exams`, `results` |
| **reports** | `reports/report-cards`, `report-card-templates`, `performance`, `year-review`, `comparison`, `analytics/*` |
| **finance** | `finance/categories`, `structures`, `invoices`, `transactions`, `expense-categories`, `expenses`, `summary/`, `payments/quote`, `payments/record`, `receipts/verify/<receipt_number>/` |
| **attendance** | `attendance/sessions`, `records` |
| **notifications** | `notifications/announcements`, `messages`, `email-settings`, `notifications` |
| **documents** | `documents/files`, `categories`, `id-card-templates`, `id-cards` |
| **government** | `gov/dashboard`, `monitoring`, `export`, `recalculate` |
| **audit** | `audit/logs`, `export` |
| **public** | `/pub/v1/schools`, `schools/<slug>`, `enrollment`, `regions`, `teachers` |

---

## 8. Data Model (Domain Entities)

All entities carry a `tenant` FK unless noted. UUID primary keys everywhere.

### 8.1 Academic structure (`apps/academic/models.py`)
Cameroon-specific model:
- `AcademicYear` (e.g. 2026/2027, `is_active` singleton per tenant).
- `Term` — 3 per year (1st Sep–Nov, 2nd Dec–Mar, 3rd Apr–Jul). **Note: `Term` has no tenant FK — it hangs off `AcademicYear`**, so tenant lookups must go `academic_year__tenant_id`.
- `Sequence` — CA periods, numbered continuously across the whole year (Seq 1–2 in Term 1, 3–4 in Term 2, 5–6 in Term 3).
- `Cycle` — 1st Cycle (Forms 1–5 / 6ème–3ème), 2nd Cycle (Lower/Upper Sixth / Seconde–Terminale).
- `Section` — Anglophone/Francophone/etc. (a bilingual school = one tenant, multiple sections).
- `Series` — 2nd-cycle specializations (A, B, C, D, E, TI for Francophone; A1–A5, S1–S5 for Anglophone).
- `Class` — Form 1 / 6ème / Seconde..., `level_order` (1=Form1/6ème … 7=Upper Sixth/Terminale).
- `Subject` — with GCE board codes, default coefficient, compulsory/double-period flags.
- `SectionSubject` / `ClassSubject` — subject availability + **coefficient override** per section/class (and per series). `effective_coefficient()` resolves section override → subject default.

### 8.2 People
- `Teacher` (`apps/staff/models.py`) — profile linked to the global `User`, tenant-scoped; has marketplace fields (specializations, availability, hourly_rate, public profile) for the national teacher marketplace.
- `TeachingAssignment` — teacher↔subject↔class (+series for 2nd cycle) for an academic year. **This is what scopes what a teacher can see/do in logbook, planner, marks.**
- `Student` (`apps/students/models.py`) — global-but-tenant-scoped, admission number, class/stream/series, statuses registered→active→…→graduated/withdrawn.
- `ParentStudentRelationship` — parent user ↔ student (father/mother/guardian); the primitive for the parent portal, and it's what the parent global-path exception is scoped on.

### 8.3 Logbook / Lesson planner (`apps/logbook/models.py`) — recent feature
- `SchemeOfWork` — **one row = one week of one subject+class in one term+year**. Fields: `week_number`, `topic`, `objectives`, `expected_outcome`, `essential_knowledge`, `homework`, `status` (`planned`→`taught`), `taught_at`, `taught_by` (FK to Teacher, SET_NULL), `notes`. Unique on `(tenant, year, term, subject, class, week_number)` — this uniqueness is what makes Generate/CSV-import upserts safe.
- `CurriculumModule` / `CurriculumLesson` — unit/lesson breakdown.
- `LogbookEntry` — the classic daily record-of-work: `work_covered`, `lessons_covered` (M2M), `is_locked`, `signature_hash`, `signed_at`, `is_validated`/`validated_by`.

### 8.4 Assessments & grading (`apps/assessments/models.py`)
- `GradeScale` + `GradeBoundary` — dual systems: Francophone 0–20 numeric, Anglophone letter grades with points (O-Level max 3, A-Level max 5). Boundary rows map letter ↔ min/max ↔ points.
- `MarkEntryWindow` — per-sequence window with `start/end_date`, `is_open` (global toggle), `share_results` (parents see marks after close).
- `Exam` — one per term (exam_type: termly/BEPC/GCE O-L/A/Probatoire/Bac/TVEE), `weight` toward the year.
- `ExamResult` — score per (exam, student, subject, sequence); stores numeric score, letter grade, points. Term average = weighted combination of sequence scores.

### 8.5 Reports (`apps/reports/models.py`)
- `ReportCardTemplate` — per-tenant visual template (colors + full `style_config` JSON).
- `StudentReportCard` — generated PDF (ReportLab) with `data_snapshot` JSON (scores at generation time) so a card never changes after the fact. `unique (student, term, year)`.
- `SchoolPerformanceReport` — aggregated snapshots (academic/financial/attendance/compliance/comprehensive), `is_submitted_to_gov`.
- `backend/apps/reports/analytics_views.py` — exam/subject/class/teacher performance analytics with cached metadata.

### 8.6 Finance (`apps/finance/models.py`)
- `FeeCategory` (Tuition, Registration, …) → `FeeStructure` (amount per class per year per category) → `StudentInvoice` (line items, `total_amount`, `amount_paid`, `status` draft/unpaid/partial/paid/cancelled, `balance` property) → `PaymentTransaction` (amount, method cash/bank/momo/cheque, `recorded_by`, `amount_paid_after` snapshot for correct running balances on receipts).
- `InvoiceLineItem` — the individual fee lines on an invoice.
- `ExpenseCategory` / `Expense` — money out (school treasury).
- Generated human-readable IDs: `INV-XXXXXXXX`, `RCT-XXXXXXXX`.
- Public **receipt verification**: anyone with the receipt number can check authenticity via `finance/receipts/verify/<number>/` (QR-verified, tenant-exempt).

### 8.7 Attendance (`apps/attendance/models.py`)
`AttendanceSession` (class/date/taken-by) + `AttendanceRecord` (student, status present/absent/late).

### 8.8 Communications (`apps/notifications/models.py`)
`Announcement` (+read receipts), `DirectMessage`, `Notification`, `EmailSetting` (per-tenant SMTP). Custom email backend supports console (dev) / SMTP.

### 8.9 Documents & ID cards (`apps/documents/models.py`)
`Document` (upload, category, tags, access control), `IDCardTemplate` (layout JSON), `GeneratedIDCard`. Batch ID generation pulls student data + photo + branding (see `id_card_utils.py`).

### 8.10 Audit (`apps/audit/models.py`)
`AuditLog`: user, tenant, action (create/update/delete), module, object type/id, endpoint, method, status code, IP, description, timestamp.

### 8.11 Government (`apps/government/`)
National dashboard, monitoring, compliance recalculation, and ministry report export. **Read-only aggregated views over schools — never direct tenant tables.**

---

## 9. Core Module Designs & Flows

### 9.1 Registration → Fees (the money flow)
1. Admin registers a **student** (`students/students` or `BulkImportStudents`) → admission number auto-generated.
2. Admin sets up **fee structures** (`finance/fees`): category × class × academic year × amount.
3. Invoices are created per student per year with line items; invoice numbers `INV-…`.
4. Payments: bursar (or admin, per `finance_recording` policy) records a **transaction** against the invoice; `amount_paid` and `status` recomputed; receipt number `RCT-…` generated; `amount_paid_after` snapshotted so **installments print correct running balances** on receipts.
5. Parents pay/view via parent portal (`parent-fees`, `parent-payment`, `parent-receipts`, `parent-receipts/statement/<invoice_id>/`); receipts are verifiable publicly by number.
6. `payments/quote` validates an intended payment before `payments/record` commits it.
7. Treasury: expenses, categories, `summary`, arrears, ledger — gated by `IsSchoolAdminOrBursar` / `CanWriteFinance`.
8. **Finance-specific security:** `FinanceSessionMiddleware` rejects finance API calls whose token is older than `FINANCE_TOKEN_MAX_AGE` (30 min) → forces a fresh login for money operations.

### 9.2 Timetable engine (`apps/timetable/`)
- Inputs: classes, `ClassSubject.weekly_hours`, subjects (double-period flag), teacher availability (`TeacherUnavailability`), rooms.
- `solver.py` uses **Google OR-Tools CP-SAT** to assign lessons to slots satisfying teacher-conflict, room-capacity, and stream-separation constraints.
- Outputs feed the teacher timetable (`/teacher/timetable`) and class timetables.

### 9.3 Lesson planner & work coverage (recent feature)
- **Admin** fills a full-year plan per class+subject: **Generate Term Plan** (`schemes/generate/`) creates week rows, or **CSV import** (`schemes/import/`) upserts week rows by the `(year, term, subject, class, week_number)` unique key.
- **Teacher** opens Lesson Planner (`/teacher/planner`), sees their own assigned class+subject plan for the selected term, and clicks **Done** per taught week. That click is the signature of record — backend stores `status='taught'`, `taught_at`, `taught_by`. **Undo** (`mark_planned`) is allowed.
- Teachers may also **PATCH `notes` only** on their own rows (admin serializer allows full edit; teacher serializer exposes `notes` + read-only everything else).
- **Coverage** (`schemes/coverage/`) computes per class+subject: week count, taught count, coverage % — scoped to the requesting role (teachers see only their own assignments; admins see the whole school).
- Admin dashboard: **CurriculumCoverage** page → Work Coverage tab (KPIs + per-week drilldown) and Scheme Editor tab (inline week editing, add/delete week, Generate modal, CSV import modal).

### 9.4 Digital logbook
Teacher records daily `work_covered` optionally linked to a `SchemeOfWork` row and covered `CurriculumLesson`s; can be locked + signed (`signature_hash`, `signed_at`), and validated by a second party (`validated_by`). Compliant with the "record of work book" inspectors require.

### 9.5 Marks → Report cards
1. Admin opens a **mark window** per sequence (`assessments/mark-windows`, `is_open`).
2. Teacher enters marks per subject per student (`assessments/results`) — frontend auto-saves with a dedicated throttle.
3. Results store numeric score (+ letter grade/points via grade boundaries for Anglophone).
4. Admin generates **report cards** (`reports/report-cards`, `batch-generate`) with ReportLab PDFs per template; each card snapshots its data (`data_snapshot`).
5. Parents see results/analytics after `share_results` is on and the window is closed.

### 9.6 Attendance
Teacher opens an attendance session for a class/date; records statuses per student; dashboards aggregate (attendance %, late tracking).

### 9.7 Government
- Ministry officers log in (separate `/gov/login`), are scoped by `government_region` (blank = national).
- Read national dashboard, monitoring, compliance, alerts, inspections, policy pages.
- `export/` produces ministry reports; `recalculate/` recomputes compliance snapshots.
- **Invariant: government never writes school data.**

### 9.8 Public site & enrollment
- Public school listing + profile pages (`/pub/v1/schools`), enrollment inquiry submission (`public/enrollment`, throttled per school), teacher marketplace (`/pub/v1/teachers`).
- Public school pages are **cached** (Tenant signals invalidate on school/fee-structure change).

---

## 10. Frontend Architecture

### 10.1 Portals (role-based apps within one SPA)
| Portal | Route prefix | Pages (selection) |
|---|---|---|
| Public | `/`, `/schools`, `/find-teachers` | landing, features, school profiles, teacher marketplace |
| Admin | `/admin` | dashboard, academic mgmt, students (add/import), operations (faculty, bursars, parents, discipline), finance (treasury, fee-setup, invoices, ledger, arrears, expenses, record transaction), community, compliance/reports, attendance, timetables, exams/workflow, mark status, **curriculum (coverage + scheme editor)**, promotions, report cards, ID cards, analytics, year review, audit, settings |
| Teacher | `/teacher` | dashboard, timetable, **logbook**, coverage, **planner**, assessments, settings, profile |
| Parent | `/parent` | dashboard (multi-child), fees, receipts, reports, analytics, child detail, settings |
| Bursar | `/bursar` | dashboard, transactions, invoices, ledger, arrears, expenses, settings |
| Government | `/gov` | national dashboard, regions, monitoring, compliance, alerts, inspections, policy, support |

### 10.2 Routing & guards (`src/App.tsx`)
- `ProtectedRoute` checks token; forces `/force-password-change` when `user.must_change_password`; checks role list against the route's `allowedRoles`.
- `PortalRedirect` picks the primary portal by role priority: platform-admin → system, then teacher → bursar → admin → parent → government.
- All portal pages are **lazy-loaded** (code-split per portal chunk) for fast first paint; public + auth pages are eager.
- On app mount with a token, it calls `/auth/me/` to hydrate `user`, `roles`, `tenants` into `authStore`.

### 10.3 State & API client
- **Zustand stores** hold cross-page state: auth (token/refresh/user/roles/tenants/sessions), tenant (active tenant id/theme), teacher (active assignment for planner/assessments), parent, gov, section, toast.
- **`api.ts`**: axios instance with base URL from `VITE_API_URL` (default `http://localhost:8000/api/v1`); request interceptor injects `Authorization: Bearer`, `X-Tenant-ID`, `X-Session-ID`; response interceptor handles **401 → single-flight refresh** (a `failedQueue` coalesces concurrent 401s, retries the original request with the new token) and on refresh failure logs out and redirects to `/login`.
- Toasts: `toastStore.addToast(msg, 'success'|'error'|'info')`.
- Theme: `useTenantTheme` + `ThemeBridge` apply the tenant's `theme_config` at runtime (deep blue/green/gold default palette).

---

## 11. Security Model (Summary)

| Control | Implementation |
|---|---|
| Transport | HTTPS in production; HSTS; cookies Secure |
| Headers | `SecurityHeadersMiddleware` adds `Permissions-Policy`, `COOP/COEP`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`; Django prod settings add CSP-adjacent flags |
| AuthN | JWT (2h access / 7d rotating refresh), password-change invalidation, breach check, brute-force lockout, forced password change |
| AuthZ | Per-tenant `UserRoleMapping` + permission classes; finance write policy per school; government read-only |
| Tenant isolation | Middleware gate + tenant-scoped querysets + parent-scope exception |
| Finance hardening | 30-min token window on `/api/v1/finance/*` |
| Rate limiting | DRF throttles incl. login 10/min and mark_entry 6000/h |
| CSRF/CORS | Same-origin in prod (Django serves SPA); CORS locked to dev origins + `X-Tenant-ID`/`X-Session-ID` headers allowed |
| Audit trail | Every POST/PUT/PATCH/DELETE logged (best-effort, never breaks the request) |
| Uploads | 10 MB cap; stored in S3-compatible storage in prod |
| Data at rest | Production DB (Postgres) + S3 storage encryption on the provider |
| Secrets | `.env`, mandatory `DJANGO_SECRET_KEY`, never committed |

---

## 12. Caching & Performance

- **Tenant rows** cached 60s (invalidated by signals) — avoids a DB hit on every request.
- **Public school pages** cached; invalidated on school/fee-structure changes.
- **Analytics metadata** cached (report analytics endpoints).
- **DB connection reuse** in prod (`CONN_MAX_AGE=60`, `CONN_HEALTH_CHECKS`) — critical for mark-entry bursts.
- Mark auto-save gets its own throttle bucket so typing doesn't trigger 429s.
- Frontend: code-split chunks per portal; images/served assets via WhiteNoise.

---

## 13. Deployment & Environment

### 13.1 Config-by-env (`config/settings.py`)
| Env var | Effect |
|---|---|
| `DJANGO_SECRET_KEY` | **required** — app won't start without it |
| `DJANGO_DEBUG` | debug mode (+ Browsable API renderer) |
| `DJANGO_ALLOWED_HOSTS` | default `localhost,127.0.0.1` |
| `DATABASE_URL` | present → PostgreSQL, else SQLite |
| `CACHE_REDIS_URL` | present → Redis cache, else LocMem |
| `CORS_ALLOWED_ORIGINS` | dev origins default |
| `AWS_STORAGE_BUCKET_NAME` (+ keys/endpoint/region) | present → S3-compatible storage, else local filesystem |
| `DJANGO_EMAIL_BACKEND` / SMTP vars | console (dev) / SMTP (prod) |
| `FRONTEND_URL` | links in password-reset emails |

### 13.2 Running
- Backend: `python manage.py runserver` (dev) / Gunicorn via `Procfile` (prod). `python manage.py check`, migrations applied normally.
- Frontend: `npm install`, `npm run dev` (port 5173, proxied API), `npm run build` → outputs `frontend/dist`, which **Django serves** (static assets + SPA catch-all route → `index.html`).
- Seeds for demo data: `seed_data.py`, `seed_greenfield.py`, `seed_parent.py`.

### 13.3 Vision vs current (be honest with tech guys)
- **Vision docs** describe schema-per-tenant, microservices, Kafka/RabbitMQ event bus, Kubernetes/Istio, ELK/Prometheus. **None of that is implemented yet.**
- **Current reality:** shared-DB multi-tenancy, modular monolith, Django signals (not a broker), single-deploy Gunicorn + WhiteNoise, SQLite/Postgres, Redis-ready caching, S3-ready storage, request-ID + audit logs for observability.
- The domain apps are the seam for a future microservice split; the event flows in `microservices_architecture.md` are the target for a later phase.

---

## 14. Known Gaps & Roadmap (open questions to flag)

- Frontend **tests** are not yet established (`E2E_Test_Plan.md` exists as a plan).
- No background task queue yet (all work is synchronous in-request; signals are synchronous).
- No webhook/event bus yet (finance → document → notification chains are synchronous).
- No automated CI/CD pipeline file in the repo yet.
- Grade-boundary/Anglo letter-grade compute is modeled but full exam result workflows continue to be hardened.
- Some older seed scripts may lag newer schema (run migrations first).

---

## 15. Quick Answers — Questions Tech Guys Will Ask

**Q: What is the backend stack?**
Django 5.2 + Django REST Framework 3.15, SimpleJWT auth, PostgreSQL (prod) / SQLite (dev), Redis-ready caching, ReportLab for PDFs, OR-Tools for timetable solving, S3-compatible storage.

**Q: Is this microservices or monolith?**
Modular monolith today, organized into bounded-context Django apps that map 1:1 to the microservices roadmap. Splittable without a rewrite.

**Q: How is multi-tenancy done?**
Shared database with a `tenant_id` column on every domain table; `X-Tenant-ID` header resolved by `TenantMiddleware` (cached); every queryset is tenant-scoped; middleware double-checks the user has a role mapping in that tenant. Not schema-per-tenant.

**Q: How do you prevent cross-tenant data leaks?**
(1) Middleware rejects invalid/inactive tenant and non-members. (2) ViewSets filter by `request.tenant`. (3) Parent endpoints are the only cross-tenant exception and are scoped to the parent's own relationship rows. (4) Government reads only aggregates. (5) Every mutation is audit-logged with tenant + user.

**Q: How does auth work?**
Email + password → JWT (access 2h, rotating refresh 7d with blacklist). Roles are per-tenant (`UserRoleMapping`); permission classes re-query the DB so role changes are immediate. Password changes invalidate all outstanding tokens.

**Q: Why store roles in the DB if they're in the JWT?**
Immediate revocation and per-tenant accuracy; the token claim is a convenience only.

**Q: How is the teacher's "lesson planner / coverage" implemented?**
`SchemeOfWork` rows = one per week per (subject, class, term, year). Admin generates/imports/edits. Teacher flips `planned → taught` (stores `taught_at`, `taught_by`, notes). `coverage/` endpoint returns week counts + % per class+subject, scoped by role.

**Q: How do report cards stay immutable?**
Each `StudentReportCard` stores a `data_snapshot` JSON of the scores used at generation time; the PDF is regenerable but the record is frozen.

**Q: How are installments/receipts handled?**
Invoices track `total_amount`/`amount_paid`; each `PaymentTransaction` stores `amount_paid_after` so receipts always show the correct running balance. Receipts are verifiable by number publicly with a QR.

**Q: How are rate limits handled?**
DRF throttles: login 10/min, anon 100/h, user 1000/h, plus a dedicated `mark_entry` 6000/h bucket so mark auto-save never throttles teachers.

**Q: How do you debug/trace a request?**
Every request gets an `X-Request-ID`; every mutation is written to `audit/AuditLog` with user, tenant, endpoint, status, IP. Finance failures and login lockouts are logged to the app logger.

**Q: What's the deployment topology?**
Single Django process serving the API + the built React SPA (WhiteNoise), SQLite/Postgres, optional Redis + S3. Gunicorn via `Procfile`. No Kubernetes yet.

**Q: What is the government layer?**
Read-only national dashboards + monitoring + ministry exports over aggregated/compliance snapshots. Government users never modify school data and are region-scoped.

**Q: How does the frontend stay in sync with auth/tenant?**
Zustand `authStore`/`tenantStore`; axios request interceptor injects `Bearer` + `X-Tenant-ID` + `X-Session-ID`; a single-flight 401 interceptor refreshes the token (queue-coalesced) and replays the original request.

**Q: Where does the "10-second logbook" idea live in the code?**
`apps/logbook` — `LogbookEntry` for the daily record, `SchemeOfWork` status lifecycle for coverage, teacher portal pages under `frontend/src/pages/teacher/logbook` and `planner`.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| Tenant | A school. The unit of data isolation. |
| Section | Academic stream inside a school (Anglophone/Francophone). |
| Cycle | 1st (Forms 1–5 / 6ème–3ème) vs 2nd (Sixth Form / Seconde–Terminale). |
| Series | 2nd-cycle specialization (A, B, C, S1…). |
| Term / Sequence | 3 terms/year; sequences are the CA periods, numbered continuously across the year. |
| Coefficient | Weight applied to a subject mark in averages. |
| Scheme of Work | Week-by-week teaching plan per class+subject. |
| Coverage % | Taught weeks ÷ planned weeks for a class+subject. |
| Mark window | The date-gated, admin-controlled period when teachers may enter marks. |
| GradeScale/Boundary | Letter↔score↔points table per exam level/sub-system. |
| data_snapshot | JSON frozen at generation time (report cards, performance reports). |
| role_mappings | The per-tenant role table that drives all authorization. |
