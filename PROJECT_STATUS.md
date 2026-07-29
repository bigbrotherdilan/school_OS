# School OS - Project Status & Environment Log
Last Updated: July 25, 2026

This document tracks the current state of the School OS environment, including temporary patches, active credentials, and critical architecture notes.

## 1. Active Test Accounts

| Name | Email | Password | Primary Roles |
| :--- | :--- | :--- | :--- |
| **Dr. Hee-young Song** | `dr.song@saintjoseph.sos` | `teacher123456` | Teacher, School Admin |
| **Dr. Aris Thorne** | `dr.thorne@saintjoseph.sos` | 
`teacher123456` | Teacher |
| **Mme. Clarisse Biya** | `mme.biya@saintjoseph.sos` | `teacher123456` | Teacher |
| **Mr. Peter Jones** | `mr.jones@saintmary.sos` | `teacher123456` | Teacher (Anglophone School) |
| **School Admin** | `admin@saintjoseph.sos` | `admin123456` | School Administrator |
| **Platform Admin** | `platform@schoolos.sos` | `admin123456` | Superuser |
| **Test Parent** | `parent@example.com` | `password123` | Parent (links to John @ Saint Joseph) |
| **MINESEC Official** | `minesec@cameroon.gov` | `admin123456` | Government (National Delegate) |

## 2. Environment Patches (Critical)
> [!WARNING]
> The following patches were applied to bypass missing dependencies in the local offline environment. These **MUST** be reverted before moving to production or a connected dev environment.

### Backend (`/backend/config/settings.py`)
- **`django_filters`**: Temporarily disabled in `INSTALLED_APPS` and `REST_FRAMEWORK` settings due to missing package.
- **`Pillow`**: Field types in models changed from `ImageField` to `CharField` to avoid dependency errors.

### Backend Models
- **`authentication.User.profile_photo`**: Changed to `CharField`.
- **`tenants.Tenant.logo`**: Changed to `CharField`.

## 3. Latest Accomplishments
- [x] **Teacher Portal Backend Integration**: Timetable, Assessments, Planner, and Logbook fully connected to Django API.
- [x] **Dynamic Mapping**: Frontend mapping logic transforms flat DB time slots into the grid-based UI.
- [x] **Dual-Role Support**: Dr. Song can access both Admin and Teacher portals.
- [x] **Lint & Type Cleanup**: Zero red/yellow lint markers across all teacher portal files.
- [x] **API Endpoint Fix**: Corrected 3 mismatched URLs (`/assessments/results/`, `/logbook/entries/`, `/logbook/schemes/`).
- [x] **Timetable Seeding**: Created 16 time slots across Mon-Fri for the Form 1 timetable.
- [x] **Serializer Fix**: Added `class_details` to `TimeSlotSerializer` so the frontend can read class names.
- [x] **useCurrentClass Fix**: Corrected field names to match actual serializer output.
- [x] **Logbook perform_create**: Auto-fills tenant + teacher from auth context.
- [x] **Planner update_or_create**: Uses `update_or_create` to prevent UNIQUE constraint errors on auto-save.
- [x] **Program Coverage Engine**: Full curriculum tracker with interactive lesson toggling, Analytics tab, Add Module/Lesson, and auto-logbook linking.
- [x] **Coverage Seed Data**: 8 modules + 33 lessons across Mathematics and French Language via `seed_curriculum` command.
- [x] **Lesson-Logbook Integration**: Marking a lesson complete auto-creates/updates a LogbookEntry with the lesson linked.
- [x] **Global Parent Portal**: Implemented unified dashboard aggregating data across multiple student accounts and school tenants.
- [x] **Cameroonian System Alignment**: Academic modules tailored for **Sequences (1-6)** and **Averages (/20)**.
- [x] **Parent Portal Backend**: Secure `ParentDashboardAPIView` provides real-time student performance, financial alerts, and announcements.
- [x] **Language Support**: Integrated functional EN/FR toggle in the Parent Portal layout.
- [x] **MINESEC Government Portal**: Built high-security macro-dashboard for Ministry of Secondary Education officials with regional scoping.
- [x] **Unified Portal Gateway**: Implemented `/login` landing page with role-specific entry points (Teacher, Parent, Admin).
- [x] **Terminology Standardization**: Globally refactored "Faculty" to **"Teacher"** (Teacher's Portal, Teacher Management, etc.).
- [x] **Master Control (Django Admin) Overhaul**: Massive aesthetic upgrade of the Django Admin interface with a modern card-grid, hover states, and premium School OS branding.
- [x] **Comprehensive Documentation**: Created `Comprehensive_Project_Report.md` (Business/Functional/Technical) and `Security_Architecture_Report.md`.
- [x] **Gov Portal Style Fix**: Polished the Government login page to match the clean platform aesthetic, removing "AI-style" gradients.
- [x] **Academic Hierarchy (Term-Sequence)**: Implemented parent-child relationships for academic periods. Admin can nest Sequences under Terms.
- [x] **Dynamic Grading System**: Teacher Portal now automatically switches between **/20** (Francophone/Bilingual) and **/100** (Anglophone) scales based on the school's `education_type`.
- [x] **Hierarchical Period Selector**: Updated Teacher Assessments to show nested sequences (e.g., "↳ Sequence A") and auto-default to sequences for mark entry.
- [x] **Backend Code Cleanup**: Deleted redundant duplicate `authentication` app folder in `apps/documents` and standardized `request.tenant_id` usage.
- [x] **Teacher Marketplace Model**: Extended Teacher with 15 fields: department, specializations, certifications, availability, public_profile, hourly_rate, subjects_taught, languages_spoken, average_rating, total_reviews, years_of_experience, teaching_philosophy, achievements, date_of_joining, phone.
- [x] **Bulk CSV Import — Students**: `POST /students/students/bulk-import/` accepts CSV with auto-generated admission numbers, class matching by name, and validation.
- [x] **Bulk CSV Import — Teachers**: `POST /staff/teachers/bulk-import/` accepts CSV, creates User + UserRoleMapping + Teacher with temp passwords.
- [x] **Public Teacher Marketplace**: `GET /public/teachers/` — no auth, search by name/subject/region/availability/rating. Returns teacher profiles with school info.
- [x] **Teacher Profile Edit Page**: `/teacher/profile` — teachers can edit bio, qualifications, specializations, languages, availability, marketplace visibility, hourly rate, and more.
- [x] **Enhanced Student Registration**: 5-step wizard: Personal Info → Medical & Emergency → Parent/Guardian → Academic Placement → Verification.
- [x] **Enhanced TeacherDirectory**: Stats strip, filter tabs (All/Active/Marketplace), department/search, marketplace badges, rating display, bulk import button.
- [x] **Reusable BulkCsvUpload Component**: Drag-and-drop CSV with preview, template download, progress, results display.

## 4. Pending Tasks
- [x] **Parent Portal Implementation**: Create layout, dashboard, academics, and finance views for parents. Handle cross-tenant Ward Selection.
- [x] **Portal Security Branding**: Finalized the aesthetic and security of the Government and Super Admin entry points.
- [ ] **Re-enable Filters**: Re-install `django-filter` and revert `settings.py` once network is available.
- [ ] **Image Handling**: Revert `CharField` to `ImageField` and install `Pillow` for profile photo support.
- [ ] **Assignment Validation**: Prevent duplicate/conflicting assignments in the admin modal.
- [ ] **Auto-save Hook**: Extract debounced auto-save logic from Assessments/Planner into a shared hook.
- [ ] **Teacher Rating System**: Add endpoint for schools/admins to rate teachers (PerformanceReview → average_rating sync).
- [ ] **Teacher Photo Upload**: Allow teachers to upload profile photos from the profile edit page.
- [ ] **Marketplace Contact Flow**: Implement "Request to Hire" or "Contact Teacher" flow from the marketplace page.
- [ ] **Bulk Import Dry-Run**: Add a preview-only mode to bulk import before committing.

## 5. Verified Teacher Portal Status (All PASS)

| Page | Route | Status | Notes |
|:---|:---|:---|:---|
| Dashboard | `/teacher` | ✅ PASS | Shows live class card with real DB data |
| Timetable | `/teacher/timetable` | ✅ PASS | 16 real slots populated in grid |
| Assessments | `/teacher/assessments` | ✅ PASS | Student list from DB, dynamic /20 or /100 scale, hierarchical sequence selection |
| Logbook | `/teacher/logbook` | ✅ PASS | "Confirm Lesson" creates entry (201) |
| Planner | `/teacher/planner` | ✅ PASS | Auto-save works, update_or_create handles repeats |
| Coverage | `/teacher/coverage` | ✅ PASS | Interactive curriculum tracker with 8 modules, toggle + logbook auto-link |
| Parent Dashboard | `/parent` | ✅ PASS | Hydrates 'John' from Saint Joseph; Sequence/Average terms correct |
| Parent Fees | `/parent/fees` | ✅ PASS | Shows XAF installments and transaction history |
| Parent Reports | `/parent/reports` | ✅ PASS | Displays Seq 1/Seq 2 and PDF archive downloads |
| Parent Analytics | `/parent/analytics` | ✅ PASS | High-performance attendance heatmap and comparative subject charts |
| MINESEC Dashboard | `/gov` | ✅ PASS | National aggregation, regional scoping, secure API endpoint |
| Anglophone Support| `/teacher/assessments` | ✅ PASS | Verified /100 scale and 50% pass mark for mr.jones@saintmary.sos |
