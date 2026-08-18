================================================================================
================================================================================

#  **SCHOOL OS  SYSTEM ARCHITECTURE
                           Complete Technical Design Document**

  "An all-in-one school management platform built for African schools."
  Multi-tenant  ·  Multi-portal  ·  Bilingual (EN/FR)  ·  Offline-ready PWA

  Tech Stack:  Django 5 + DRF  ·  PostgreSQL  ·  React 18 + TypeScript
               Zustand  ·  Vite  ·  Tailwind CSS  ·  OR-Tools CP-SAT
               Docker  ·  AWS S3  ·  Gunicorn  ·  WhiteNoise

  Last Updated: August 2026

================================================================================

1. HIGH-LEVEL SYSTEM TOPOLOGY
   ================================================================================

   ┌─────────────────────────────────┐
   │         AWS CLOUD (EC2)          │
   │                                  │
   ┌──────────┐          │  ┌────────────────────────────┐  │
   │  Browser │  HTTPS   │  │   Nginx / Gunicorn          │  │
   │  (PWA)   │◄────────►│  │   ┌──────────────────────┐  │  │
   └──────────┘          │  │   │  Django + DRF API     │  │  │
   │                │  │   │  17 Apps · 68 Models  │  │  │
   │                │  │   └──────────┬───────────┘  │  │
   │                │  │              │              │  │
   │                │  │   ┌──────────▼───────────┐  │  │
   │                │  │   │  PostgreSQL 16       │  │  │
   │                │  │   │  Multi-tenant Data   │  │  │
   │                │  │   └──────────────────────┘  │  │
   │                │  └────────────────────────────┘  │
   │                │                                  │
   │  static files  │  ┌────────────────────────────┐  │
   ├───────────────►│  │  AWS S3 (Media Storage)     │  │
   │                │  │  Logos · Photos · PDFs      │  │
   │                │  └────────────────────────────┘  │
   │                │                                  │
   │  email/SMS     │  ┌────────────────────────────┐  │
   ├───────────────►│  │  SMTP Server (Email)        │  │
   │                │  └────────────────────────────┘  │
   │                └─────────────────────────────────┘
   │
   │  ┌───────────────────────────────────┐
   │  │  Mobile Money (MTN MoMo / Orange) │
   └──│  Bank Transfer                     │
   └───────────────────────────────────┘

================================================================================
  2. MULTI-TENANT ARCHITECTURE
==============================

  Every school is a "Tenant." All data is isolated at the database level
  via foreign key relationships to the Tenant model.

  ┌─────────────────────────────────────────────────────────────────┐
  │                     TENANT (School)                             │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │  Tenant                                                   │  │
  │  │  ├─ id (UUID)            ├─ school_name                   │  │
  │  │  ├─ slug (unique)        ├─ education_type (ANGLO/FRANCO) │  │
  │  │  ├─ school_type          ├─ session_type                  │  │
  │  │  ├─ region / division    ├─ country                       │  │
  │  │  ├─ logo_url             ├─ motto                         │  │
  │  │  ├─ theme_config (JSON)  ├─ status (active/suspended)     │  │
  │  │  └─ subscription_plan    └─ max_students                  │  │
  │  └───────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌────────────────────────┐  ┌────────────────────────────┐    │
  │  │  TenantConfig          │  │  EmailSetting               │    │
  │  │  ├─ currency (XAF)     │  │  ├─ host / port / TLS      │    │
  │  │  ├─ grading_scale_max  │  │  ├─ username / password     │    │
  │  │  ├─ grade thresholds   │  │  └─ from_email              │    │
  │  │  ├─ payment_methods    │  └────────────────────────────┘    │
  │  │  └─ finance_recording  │                                    │
  │  └────────────────────────┘                                    │
  └─────────────────────────────────────────────────────────────────┘

  Data Isolation: Every model (Student, Invoice, Timetable, etc.)
  has a `tenant` ForeignKey. The TenantMiddleware extracts the
  X-Tenant-ID header and enforces that the authenticated user has
  a UserRoleMapping for that tenant.

================================================================================
  3. IDENTITY & ACCESS MODEL
============================

  ┌─────────────────────────────────────────────────────────────────┐
  │                         USER (Global)                           │
  │  ├─ id (UUID)              ├─ email (username)                  │
  │  ├─ first_name / last_name ├─ phone                             │
  │  ├─ profile_photo          ├─ default_language                  │
  │  ├─ is_platform_admin      ├─ is_government_official            │
  │  ├─ failed_login_attempts  ├─ locked_until                      │
  │  └─ must_change_password   └─ password_changed_at               │
  └──────────────────────────┬──────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     UserRoleMapping          │
              │  ├─ user (FK → User)         │
              │  ├─ tenant (FK → Tenant)     │
              │  ├─ role (enum)              │
              │  └─ is_active                │
              └──────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
        ▼                    ▼                     ▼
  ┌──────────┐       ┌──────────┐          ┌──────────┐
  │  ADMIN   │       │ TEACHER  │          │  PARENT  │
  │ super_adm│       │          │          │          │
  │ admin    │       │          │          │          │
  └──────────┘       └──────────┘          └──────────┘
        │                    │                     │
        ▼                    ▼                     ▼
  ┌──────────┐       ┌──────────┐          ┌──────────┐
  │  BURSAR  │       │ STUDENT  │          │   GOV    │
  │          │       │          │          │ (MINESEC)│
  └──────────┘       └──────────┘          └──────────┘

  7 Roles: super_admin · admin · bursar · teacher · parent · student · government

  Key Pattern: A single User can have roles in MULTIPLE tenants.
  Example: User "John" can be admin at School A and teacher at School B.

  Authentication: JWT (SimpleJWT) with 2-hour access / 7-day refresh tokens.
  Passwords checked against Have I Been Pwned breach database.
  Finance endpoints have a separate 30-minute token lifetime.

================================================================================
  4. DJANGO APPS — 17 APPS, 68 MODELS
======================================

  ┌─────────────────────────────────────────────────────────────────┐
  │  App                  │ Models │ Purpose                        │
  ├───────────────────────┼────────┼────────────────────────────────┤
  │  tenants              │    2   │ Multi-tenant core               │
  │  authentication       │    4   │ Users, roles, sessions, invites│
  │  academic             │   10   │ Years, terms, classes, subjects│
  │  students             │    5   │ Student records, promotions     │
  │  staff                │    4   │ Teachers, assignments, reviews  │
  │  timetable            │    7   │ Scheduling with OR-Tools CP-SAT │
  │  assessments          │    5   │ Exams, grading, mark entry      │
  │  finance              │    7   │ Fees, invoices, payments        │
  │  attendance           │    2   │ Class attendance tracking       │
  │  notifications        │    5   │ Announcements, messages, email  │
  │  documents            │    4   │ File management, ID cards       │
  │  logbook              │    4   │ Scheme of work, teaching log    │
  │  government           │    5   │ MINESEC inspections/compliance  │
  │  reports              │    3   │ Report cards, performance       │
  │  audit                │    1   │ Full audit trail                │
  │  core                 │    0   │ Middleware, health check         │
  │  public               │    0   │ Public school directory API     │
  ├───────────────────────┼────────┼────────────────────────────────┤
  │  TOTAL                │   68   │                                │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
  5. ACADEMIC STRUCTURE — HOW CLASSES WORK
===========================================

  The academic hierarchy follows the Cameroon education system:

  Tenant
    └─ AcademicYear (2025-2026)
         └─ Term (Term 1, Term 2, Term 3)
              └─ Sequence (Control 1, Control 2, etc.)

    └─ Cycle (1st Cycle / 2nd Cycle)
         └─ Section (Grammar / Technical / Commercial)
              └─ Series (Science A, Arts B, etc.)  [2nd Cycle only]
                   └─ Class (Form 1, Form 2, etc.)
                        └─ ClassSubject → Subject + Teacher + StudentGroup

  ┌─────────────────────────────────────────────────────────────────┐
  │                     ACADEMIC HIERARCHY                          │
  │                                                                 │
  │  ┌──────────┐                                                   │
  │  │  Cycle   │── 1st Cycle (Form 1-4 / 6eme-3eme)               │
  │  │          │── 2nd Cycle (Form 5 / Terminale)                  │
  │  └────┬─────┘                                                   │
  │       │                                                         │
  │  ┌────▼─────┐                                                   │
  │  │ Section  │── Grammar ──┬── Series A (Science)                │
  │  │          │             ├── Series B (Arts)                    │
  │  │          │             └── Series C (Commercial)              │
  │  │          │── Technical ──┬── Series D (Industrial)            │
  │  │          │              └── Series E (Electrical)             │
  │  └────┬─────┘                                                   │
  │       │                                                         │
  │  ┌────▼─────┐                                                   │
  │  │  Class   │── Form 1  (level_order: 1)                        │
  │  │          │── Form 2  (level_order: 2)                        │
  │  │          │── Form 3  (level_order: 3)                        │
  │  │          │── Form 4  (level_order: 4)                        │
  │  │          │── Form 5  (level_order: 5)                        │
  │  └────┬─────┘                                                   │
  │       │                                                         │
  │  ┌────▼───────────────┐                                         │
  │  │    ClassSubject     │── Links Class ↔ Subject                 │
  │  │    ├─ coefficient   │── weekly_hours, is_double               │
  │  │    ├─ subject       │── FK → Subject                         │
  │  │    └─ student_group │── FK → StudentGroup (nullable)         │
  │  └────────────────────┘                                         │
  └─────────────────────────────────────────────────────────────────┘

  Subject attributes for timetable optimization:
    ├─ cognitive_demand (high/medium/low)
    ├─ time_preference (morning/afternoon/either)
    ├─ is_double_preferred (needs 2-period blocks)
    ├─ late_day_penalty (penalty if scheduled late)
    └─ default_coefficient

================================================================================
  6. TIMETABLE ENGINE — OR-Tools CP-SAT Solver
===============================================

  The timetable generator uses Google OR-Tools Constraint Programming
  to solve a complex scheduling problem with hard + soft constraints.

  ┌─────────────────────────────────────────────────────────────────┐
  │                    TIMETABLE PIPELINE                            │
  │                                                                 │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
  │  │ Configure │───►│ Generate │───►│ Review   │───►│ Approve  │  │
  │  │ Timetable │    │ (CP-SAT) │    │ & Edit   │    │ & Lock   │  │
  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
  │                                                                 │
  │  Models involved:                                               │
  │  ├─ Timetable         (config, status, generation metadata)     │
  │  ├─ Lesson            (subject + teacher + group + periods)     │
  │  ├─ TimeSlot          (day + time + room + assignments)         │
  │  ├─ StudentGroup      (class subsets for parallel sessions)     │
  │  ├─ Room              (capacity, type, availability)            │
  │  ├─ TeacherUnavailability  (teacher schedule constraints)       │
  │  └─ TeacherAllocation      (teacher ↔ lesson mapping)          │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  HARD CONSTRAINTS (must satisfy)                                │
  │  ────────────────────────────────────────────────────────────── │
  │  │ Student group non-overlap    │ No student in 2 places at once│
  │  │ Teacher non-double-booking   │ No teacher in 2 places at once│
  │  │ Weekly volume                │ Each lesson gets its hours     │
  │  │ Teacher unavailability       │ Respect blocked times          │
  │  │ Blocked slots                │ Admin-configured blocks        │
  │  │ Cross-section committed      │ Reserved teacher occupancy     │
  │  │ Locked slots                 │ Manual overrides preserved     │
  │  │ Double periods               │ Paired periods stay together   │
  │  │ Half-day boundaries          │ No lesson spanning AM/PM       │
  │  │ Allocation integrity         │ Teacher-subject-class match    │
  ├─────────────────────────────────────────────────────────────────┤
  │  SOFT CONSTRAINTS (maximize score)                              │
  │  ────────────────────────────────────────────────────────────── │
  │  │ No subject 3+/day            │ Distribute subjects evenly     │
  │  │ Balanced weeks               │ Similar load Mon-Fri           │
  │  │ Compact days                 │ Minimize idle gaps             │
  │  │ Teacher compactness          │ Cluster teacher periods        │
  │  │ Teacher working days         │ Minimize teacher 1-day visits  │
  │  │ Core subjects not late       │ Math/English in mornings       │
  │  │ Cognitive load               │ Heavy subjects when fresh      │
  │  │ Double session reward        │ Bonus for efficient doubles    │
  └─────────────────────────────────────────────────────────────────┘

  Output: A solved timetable with generation_score (0-100),
  generation_status (pending/solving/solved/failed/approved),
  and detailed TimeSlot entries for every period.

================================================================================
  7. FINANCE SYSTEM
===================

  ┌─────────────────────────────────────────────────────────────────┐
  │                      FINANCE FLOW                               │
  │                                                                 │
  │  FeeStructure ──────► StudentInvoice ──────► PaymentTransaction │
  │  (per class/         (per student/          (individual         │
  │   year/term)          year)                  payments)          │
  │       │                    │                       │            │
  │       ▼                    ▼                       ▼            │
  │  FeeCategory         InvoiceLineItem          Receipt Number    │
  │  (tuition,           (one per fee)            (auto-generated)  │
  │   exams, etc.)                                                  │
  │                                                                 │
  │  Payment Methods:                                               │
  │  ├─ MTN Mobile Money (MoMo)                                     │
  │  ├─ Orange Money                                                │
  │  ├─ Bank Transfer                                               │
  │  └─ Cash                                                        │
  │                                                                 │
  │  Expense Tracking:                                              │
  │  ExpenseCategory ──► Expense                                    │
  │  (supplies,          (amount, date, method, recorded_by)        │
  │   salaries, etc.)                                               │
  └─────────────────────────────────────────────────────────────────┘

  Finance Session Middleware: /api/v1/finance/* endpoints require a
  fresh token issued within 30 minutes (independent of the 2-hour
  general JWT lifetime).

================================================================================
  8. REPORTING & ANALYTICS
==========================

  ┌─────────────────────────────────────────────────────────────────┐
  │  REPORT TYPES                                                  │
  │                                                                 │
  │  ┌──────────────────┐  ┌──────────────────┐                    │
  │  │  Report Card     │  │  Performance     │                    │
  │  │  (per student)   │  │  Report          │                    │
  │  │  ├─ PDF export   │  │  (per class/term)│                    │
  │  │  ├─ Branded      │  │  ├─ Summary      │                    │
  │  │  ├─ Batch gen    │  │  ├─ Data snapshot│                    │
  │  │  └─ Templates    │  │  └─ Gov submit   │                    │
  │  └──────────────────┘  └──────────────────┘                    │
  │                                                                 │
  │  ┌──────────────────┐  ┌──────────────────┐                    │
  │  │  Year Review     │  │  Analytics       │                    │
  │  │  (annual)        │  │  (real-time)     │                    │
  │  │  ├─ Enrollment   │  │  ├─ Exam perf    │                    │
  │  │  ├─ Attendance   │  │  ├─ Subject perf │                    │
  │  │  ├─ Fees         │  │  ├─ Class perf   │                    │
  │  │  └─ Highlights   │  │  └─ Teacher sum  │                    │
  │  └──────────────────┘  └──────────────────┘                    │
  │                                                                 │
  │  Grading System:                                                │
  │  ├─ Configurable scale (max 20, typical Cameroon)               │
  │  ├─ Grade boundaries (A/B/C/D/F with thresholds)               │
  │  └─ Promotion cutoff (default 9.5/20)                           │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
  9. NOTIFICATIONS & COMMUNICATION
==================================

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  ┌──────────────────┐     ┌──────────────────┐                 │
  │  │  Announcement    │     │  DirectMessage    │                 │
  │  │  (broadcast)     │     │  (1:1)            │                 │
  │  │  ├─ audience     │     │  ├─ sender        │                 │
  │  │  │  (all/parents │     │  ├─ recipient     │                 │
  │  │  │  /teachers)   │     │  └─ read status   │                 │
  │  │  ├─ urgent flag  │     └──────────────────┘                 │
  │  │  └─ read tracking│                                           │
  │  └──────────────────┘     ┌──────────────────┐                 │
  │                           │  Notification     │                 │
  │  ┌──────────────────┐     │  (system push)    │                 │
  │  │  EmailSetting    │     │  ├─ category      │                 │
  │  │  (per-tenant)    │     │  ├─ link          │                 │
  │  │  └─ SMTP config  │     │  └─ read status   │                 │
  │  └──────────────────┘     └──────────────────┘                 │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 10. GOVERNMENT COMPLIANCE (MINESEC)
====================================

  ┌─────────────────────────────────────────────────────────────────┐
  │  CAMEROON MINISTRY OF EDUCATION INSPECTION WORKFLOW            │
  │                                                                 │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
  │  │ Schedule │───►│ Conduct  │───►│ Findings │───►│ Correct  │  │
  │  │          │    │Inspection│    │ & Score  │    │  Action  │  │
  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
  │                                                                 │
  │  Models:                                                        │
  │  ├─ Inspection           (type, status, score, schedule)        │
  │  ├─ InspectionFinding    (category, severity, evidence)         │
  │  ├─ CorrectiveAction     (action, status, review)               │
  │  ├─ InspectionDocument   (uploaded evidence)                    │
  │  └─ InspectionSchedule   (per-tenant frequency tracking)        │
  │                                                                 │
  │  Inspector Dashboard: National overview by region/division      │
  │  School Dashboard: Compliance status, findings, actions         │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 11. FRONTEND PORTALS — 6 USER INTERFACES
==========================================

  ┌─────────────────────────────────────────────────────────────────┐
  │  PORTAL            │ ROUTES     │ KEY PAGES                     │
  ├────────────────────┼────────────┼───────────────────────────────┤
  │                    │            │ Dashboard (KPIs, actions)     │
  │  ADMIN             │ /admin/*   │ Academic · Operations         │
  │  (admin,           │ 45+ pages  │ Finance · Compliance          │
  │   super_admin)     │            │ Community · Settings          │
  ├────────────────────┼────────────┼───────────────────────────────┤
  │                    │            │ Dashboard (my classes)        │
  │  TEACHER           │ /teacher/* │ Timetable · Logbook           │
  │  (teacher)         │ 8 pages    │ Coverage · Assessments        │
  ├────────────────────┼────────────┼───────────────────────────────┤
  │                    │            │ Dashboard (child overview)    │
  │  PARENT            │ /parent/*  │ Fees · Receipts · Reports     │
  │  (parent)          │ 7 pages    │ Analytics · Child Detail      │
  ├────────────────────┼────────────┼───────────────────────────────┤
  │                    │            │ Dashboard (treasury)          │
  │  BURSAR            │ /bursar/*  │ Invoices · Ledger · Arrears   │
  │  (bursar)          │ 6 pages    │ Expenses · Transactions       │
  ├────────────────────┼────────────┼───────────────────────────────┤
  │                    │            │ Dashboard (national)          │
  │  GOVERNMENT        │ /gov/*     │ Regions · Monitoring          │
  │  (government)      │ 8 pages    │ Compliance · Inspections      │
  ├────────────────────┼────────────┼───────────────────────────────┤
  │                    │            │ Landing · Features · About    │
  │  PUBLIC            │ /          │ School Directory              │
  │  (no auth)         │ 10 pages   │ Teacher Marketplace           │
  └────────────────────┴────────────┴───────────────────────────────┘

  Total frontend routes: 84+
  Total React pages: 70+
  State management: 8 Zustand stores (2 persisted, 6 ephemeral)

================================================================================
 12. API ARCHITECTURE — 18 RESOURCE GROUPS
===========================================

  Base URL:  /api/v1/        (authenticated, tenant-scoped)
             /pub/v1/        (public, no auth)

  ┌─────────────────────────────────────────────────────────────────┐
  │  GROUP             │ BASE PATH           │ ENDPOINTS            │
  ├────────────────────┼─────────────────────┼──────────────────────┤
  │  Health Check      │ /health/            │  1                   │
  │  Authentication    │ /auth/              │ 15                   │
  │  Users             │ /users/             │  1 (ViewSet)         │
  │  Tenants           │ /tenants/           │  6 (CRUD + actions)  │
  │  Academic          │ /academic/          │ 10 (ViewSets)        │
  │  Students          │ /students/          │ 13 (CRUD + parent)   │
  │  Staff             │ /staff/             │  5 (CRUD + onboard)  │
  │  Timetable         │ /timetable/         │  7 (ViewSets)        │
  │  Logbook           │ /logbook/           │  4 (ViewSets)        │
  │  Assessments       │ /assessments/       │  3 (ViewSets)        │
  │  Reports           │ /reports/           │ 11 (CRUD + analytics)│
  │  Finance           │ /finance/           │ 10 (CRUD + payments) │
  │  Attendance        │ /attendance/        │  2 (ViewSets)        │
  │  Notifications     │ /notifications/     │  4 (ViewSets)        │
  │  Documents         │ /documents/         │  4 (ViewSets)        │
  │  Government        │ /gov/               │ 10 (CRUD + dashboard)│
  │  Audit             │ /audit/             │  2 (ViewSet + export)│
  │  Public            │ /pub/v1/            │  5 (read-only)       │
  ├────────────────────┼─────────────────────┼──────────────────────┤
  │  TOTAL             │                     │ ~113 endpoints       │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 13. MIDDLEWARE PIPELINE — REQUEST LIFECYCLE
=============================================

  Incoming HTTP Request
        │
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  1. SecurityMiddleware          (HTTPS redirect, HSTS)       │
  │  2. SecurityHeadersMiddleware   (CSP, X-Frame, COOP/COEP)   │
  │  3. RequestIDMiddleware         (X-Request-ID tracing)       │
  │  4. WhiteNoiseMiddleware        (static file serving)        │
  │  5. SessionMiddleware           (Django sessions)            │
  │  6. CorsMiddleware              (CORS origin validation)     │
  │  7. CommonMiddleware            (URL normalization)          │
  │  8. CsrfViewMiddleware          (CSRF protection)            │
  │  9. AuthenticationMiddleware    (user resolution)            │
  │ 10. MessageMiddleware           (flash messages)             │
  │ 11. XFrameOptionsMiddleware     (clickjacking)               │
  │ 12. TenantMiddleware            (X-Tenant-ID, isolation)     │◄─ KEY
  │ 13. FinanceSessionMiddleware    (30-min finance token)       │
  │ 14. AuditMiddleware             (auto audit logging)         │
  └─────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
                          DRF View + Serializer
                                │
                                ▼
                          PostgreSQL Query (tenant-filtered)
                                │
                                ▼
                          JSON Response + Audit Log Entry

================================================================================
 14. FILE STORAGE — S3 INTEGRATION
===================================

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  LOCAL DEV                          PRODUCTION (AWS)            │
  │  ─────────                          ────────────────            │
  │  FileSystemStorage                  S3Boto3Storage              │
  │  backend/media/                     s3://your-bucket/           │
  │                                                                 │
  │  File types stored:                                             │
  │  ├─ School logos        → /logos/                                │
  │  ├─ Student photos      → /student-photos/                      │
  │  ├─ Profile photos      → /profile-photos/                      │
  │  ├─ Report card PDFs    → /report-cards/                        │
  │  ├─ ID card PDFs        → /id-cards/                            │
  │  ├─ Documents           → /documents/                           │
  │  └─ Inspection files    → /inspections/                         │
  │                                                                 │
  │  Config: AWS_STORAGE_BUCKET_NAME env var triggers S3 mode       │
  │  Supports: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO    │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 15. DEPLOYMENT ARCHITECTURE
============================

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
  │  │   Docker      │    │  PostgreSQL   │    │  AWS S3      │      │
  │  │   Container   │    │  Database     │    │  (Media)     │      │
  │  │              │    │              │    │              │      │
  │  │  ┌────────┐  │    │  ┌────────┐  │    │  ┌────────┐  │      │
  │  │  │Gunicorn│  │    │  │  Data  │  │    │  │ Bucket │  │      │
  │  │  │Workers │  │◄──►│  │Volume │  │    │  │        │  │      │
  │  │  └────────┘  │    │  └────────┘  │    │  └────────┘  │      │
  │  │  ┌────────┐  │    └──────────────┘    └──────────────┘      │
  │  │  │Nginx   │  │                                              │
  │  │  │(proxy) │  │    ┌──────────────┐                          │
  │  │  └────────┘  │    │  Redis       │                          │
  │  └──────────────┘    │  (Cache)     │                          │
  │                      └──────────────┘                          │
  │                                                                 │
  │  Docker Compose services:                                       │
  │  ├─ backend    (Python 3.12 + Gunicorn)                         │
  │  ├─ db         (PostgreSQL 16)                                  │
  │  └─ redis      (Redis 7)                                        │
  │                                                                 │
  │  Procfile:                                                      │
  │  ├─ release: python manage.py migrate --noinput                 │
  │  └─ web: gunicorn config.wsgi:application (3 workers)           │
  │                                                                 │
  │  Health Check: GET /api/v1/health/ (DB + Redis probe)           │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 16. SECURITY LAYERS
====================

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  LAYER 1 — TRANSPORT                                           │
  │  ├─ SECURE_SSL_REDIRECT = True                                  │
  │  ├─ SECURE_HSTS_SECONDS = 31536000 (1 year)                    │
  │  └─ SECURE_PROXY_SSL_HEADER = (X-Forwarded-Proto, https)       │
  │                                                                 │
  │  LAYER 2 — COOKIES & SESSIONS                                   │
  │  ├─ SESSION_COOKIE_SECURE = True                                │
  │  ├─ CSRF_COOKIE_SECURE = True                                   │
  │  ├─ CSRF_COOKIE_HTTPONLY = True                                 │
  │  ├─ SESSION_COOKIE_SAMESITE = Lax                               │
  │  └─ CSRF_COOKIE_SAMESITE = Lax                                 │
  │                                                                 │
  │  LAYER 3 — HEADERS                                              │
  │  ├─ Content-Security-Policy (script/style/img/connect)         │
  │  ├─ X-Frame-Options: DENY                                       │
  │  ├─ X-Content-Type-Options: nosniff                             │
  │  ├─ Referrer-Policy: strict-origin-when-cross-origin            │
  │  ├─ Cross-Origin-Opener-Policy: same-origin                     │
  │  ├─ Cross-Origin-Embedder-Policy: require-corp                  │
  │  └─ Permissions-Policy: camera=(), microphone=(), geolocation=()│
  │                                                                 │
  │  LAYER 4 — AUTHENTICATION                                       │
  │  ├─ JWT with token blacklisting                                 │
  │  ├─ Have I Been Pwned password breach check                     │
  │  ├─ Failed login lockout (5 attempts → 30 min lock)            │
  │  ├─ Session management (max 2 active sessions)                  │
  │  ├─ Finance endpoint 30-minute token lifetime                   │
  │  └─ SOSJWTAuthentication (rejects tokens before password change)│
  │                                                                 │
  │  LAYER 5 — AUTHORIZATION                                        │
  │  ├─ TenantMiddleware (X-Tenant-ID validation)                   │
  │  ├─ IsPlatformAdmin / IsSchoolAdmin role checks                 │
  │  ├─ UserRoleMapping per-tenant isolation                        │
  │  └─ AuditMiddleware (auto-logs all mutations)                   │
  │                                                                 │
  │  LAYER 6 — DATA                                                │
  │  ├─ All models tenant-scoped via ForeignKey                     │
  │  ├─ UUID primary keys (no sequential guessing)                  │
  │  ├─ S3 ACL: private (no public read)                            │
  │  ├─ 10MB upload limit                                           │
  │  └─ Image validation (PIL verify on upload)                     │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 17. PWA & OFFLINE SUPPORT
==========================

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  Service Worker Strategy:                                       │
  │  ├─ POST / non-GET      → Network passthrough (never cache)     │
  │  ├─ Cross-origin        → Network passthrough                   │
  │  ├─ /api/* or /pub/*    → Network only (never cached)           │
  │  ├─ Navigation          → Network-first, fallback to cache      │
  │  ├─ Hashed assets       → Cache-first, then network + update    │
  │  └─ Everything else     → Network-first, fallback to cache      │
  │                                                                 │
  │  App Shell (pre-cached on install):                              │
  │  / · /index.html · /manifest.json                               │
  │  /favicon.svg · /icons/icon-192.png · /icons/icon-512.png       │
  │                                                                 │
  │  Manifest:                                                      │
  │  ├─ name: "School OS"                                           │
  │  ├─ display: standalone                                         │
  │  ├─ theme_color: #00236f                                        │
  │  └─ icons: SVG + PNG (192, 512) + maskable                      │
  │                                                                 │
  │  Dev mode: Service worker is UNREGISTERED to prevent stale cache│
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 18. EXTERNAL INTEGRATIONS
==========================

  ┌─────────────────────────────────────────────────────────────────┐
  │  SERVICE              │ STATUS   │ DETAILS                      │
  ├───────────────────────┼──────────┼──────────────────────────────┤
  │  AWS S3 / R2          │ Active   │ Media storage (logos, PDFs)  │
  │  SMTP Email           │ Active   │ Password reset, invitations  │
  │  MTN Mobile Money     │ Active   │ Fee payments (via API)       │
  │  Orange Money         │ Active   │ Fee payments (via API)       │
  │  Have I Been Pwned    │ Active   │ Password breach checking     │
  │  MINESEC (Gov API)    │ Active   │ Inspection compliance        │
  │  SMS Gateway          │ Ready    │ Field exists, no provider    │
  │  PWA / Service Worker │ Active   │ Offline-first caching        │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 19. KEY ARCHITECTURAL DECISIONS
================================

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  1. GLOBAL IDENTITY, PER-TENANT ROLES                           │
  │     User model is global. UserRoleMapping assigns roles within   │
  │     specific tenants. One user → multiple schools, each with    │
  │     different roles.                                            │
  │                                                                 │
  │  2. DUAL EDUCATION SYSTEM SUPPORT                               │
  │     The same schema supports both Anglophone (Form 1-5, GCE)    │
  │     and Francophone (6eme-Terminale, Baccalauréat) systems.     │
  │     Controlled by Tenant.education_type.                        │
  │                                                                 │
  │  3. PARENT GLOBAL ACCESS                                        │
  │     Parents can view data across multiple schools without       │
  │     per-tenant role mappings. Enforced via TenantMiddleware      │
  │     PARENT_GLOBAL_PATHS exemption list.                         │
  │                                                                 │
  │  4. NO BACKGROUND TASKS                                         │
  │     All operations are synchronous. Report card PDFs and        │
  │     timetable generation run inline. No Celery, no queues.      │
  │     Simple, predictable, easy to debug.                         │
  │                                                                 │
  │  5. UUID PRIMARY KEYS                                           │
  │     All non-auto-increment models use UUIDs for security and    │
  │     distributed ID generation. No sequential ID guessing.       │
  │                                                                 │
  │  6. S3-FIRST FILE STORAGE                                       │
  │     Local dev uses filesystem. Production auto-switches to S3   │
  │     via environment variable. No code changes needed.           │
  │                                                                 │
  │  7. BILINGUAL BY DESIGN                                         │
  │     Subject names, UI labels, and report cards support both     │
  │     English and French. Default language per tenant.            │
  │                                                                 │
  │  8. COMPOSABLE PORTALS                                          │
  │     Each portal (Admin, Teacher, Parent, Bursar, Gov) is a      │
  │     separate route tree with its own layout, sidebar, and       │
  │     state management. Shared components via /components/ui/.    │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
 20. MODEL RELATIONSHIP MAP
===========================

  ┌─────────────────────────────────────────────────────────────────┐
  │                     TENANT (Hub)                                 │
  │                         │                                       │
  │    ┌────────────────────┼────────────────────┐                  │
  │    │                    │                     │                  │
  │    ▼                    ▼                     ▼                  │
  │  AcademicYear      Student              Teacher                  │
  │    │                  │                    │                     │
  │    ├── Term           ├── ParentStudent    ├── TeachingAssignment│
  │    │   └── Sequence   │   Relationship    │   ├── Subject       │
  │    │                  │                   │   ├── Class         │
  │    ├── Class          ├── DisciplineRecord│   └── StudentGroup  │
  │    │   └── ClassSubject                   │                     │
  │    │       ├── Subject                    ├── LeaveRequest      │
  │    │       └── StudentGroup               └── PerformanceReview │
  │    │                                                            │
  │    └── Subject                                                    │
  │        └── SectionSubject                                         │
  │                                                                    │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
  │  │  Timetable   │  │  FeeStructure │  │  Attendance  │            │
  │  │  ├── TimeSlot│  │  ├── Category │  │  Session     │            │
  │  │  ├── Lesson  │  │  └── Invoice  │  │  └── Record  │            │
  │  │  │   └── Alloc│  │      └── Line │  └──────────────┘            │
  │  │  ├── Room    │  │  └── Payment  │                                │
  │  │  └── Groups  │  │      Transaction│                              │
  │  └──────────────┘  └──────────────┘                                │
  │                                                                    │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
  │  │  Exam        │  │  Document    │  │  Inspection  │            │
  │  │  └── Result  │  │  └── ID Card │  │  ├── Finding │            │
  │  └──────────────┘  └──────────────┘  │  │   └── Action│            │
  │                                      │  └── Schedule  │            │
  │  ┌──────────────┐  ┌──────────────┐  └──────────────┘            │
  │  │  SchemeOfWork│  │  Announcement│                                │
  │  │  └── Logbook │  │  └── Read    │  ┌──────────────┐            │
  │  └──────────────┘  └──────────────┘  │  AuditLog    │            │
  │                                      │  (global)    │            │
  │  ┌──────────────┐                    └──────────────┘            │
  │  │  ReportCard  │                                                │
  │  │  Template    │                                                │
  │  └──────────────┘                                                │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
  FILE STATISTICS
=================

  Backend:
    ├─ 17 Django apps
    ├─ 68 database models
    ├─ ~113 API endpoints
    ├─ 14 middleware layers
    └─ 5 service layers (auth, tenant, finance, audit, core)

  Frontend:
    ├─ 70+ React pages
    ├─ 84+ routes
    ├─ 8 Zustand stores
    ├─ 5 API service layers
    ├─ 8 custom hooks
    └─ 20+ shared UI components

  Infrastructure:
    ├─ Dockerfile (multi-stage)
    ├─ docker-compose.yml (3 services)
    ├─ Procfile (release + web)
    ├─ render.yaml / railway.json (legacy)
    └─ .env.example (production template)

================================================================================
                          END OF SYSTEM ARCHITECTURE
                          School OS v1.0 · August 2026
=======================================================
