# School OS - Session Backup Summary
**Date:** July 25, 2026
**State:** Admin Dashboard v2 — Teacher Marketplace & Bulk Import

## 1. Key Changes in this Session
- **Teacher Marketplace Model**: Extended Teacher model with 15 new fields: `department`, `phone`, `date_of_joining`, `years_of_experience`, `specializations`, `certifications`, `teaching_philosophy`, `achievements`, `availability`, `public_profile`, `hourly_rate`, `subjects_taught`, `languages_spoken`, `average_rating`, `total_reviews`.
- **Bulk CSV Import — Students**: New `POST /students/students/bulk-import/` endpoint accepts CSV with first_name, last_name, gender, date_of_birth + optional class, blood_group, emergency_contact. Auto-generates admission numbers.
- **Bulk CSV Import — Teachers**: New `POST /staff/teachers/bulk-import/` endpoint accepts CSV with first_name, last_name, email + optional employee_id, qualification, department. Creates User + Teacher + role automatically with temp passwords.
- **Public Teacher Marketplace**: New `GET /public/teachers/` endpoint — no auth required. Search by name, subject, region, availability, min_rating. Returns teacher profiles with school info.
- **Teacher Profile Edit**: New `/teacher/profile` page allowing teachers to edit their bio, qualifications, specializations, marketplace visibility, and more.
- **Enhanced Student Registration**: AddStudentPage now has 5 steps: Personal Info → Medical & Emergency → Parent/Guardian → Academic Placement → Verification.
- **Enhanced TeacherDirectory**: Stats strip, filter tabs (All/Active/Marketplace), department/search filtering, marketplace profile badges, rating display, and Bulk Import button.
- **Reusable BulkCsvUpload Component**: Drag-and-drop CSV upload with preview table, template download, progress indicator, and results display.

## 2. Active Development Servers
- **Backend:** `http://localhost:8000/api/v1` (Port 8000)
- **Frontend:** `http://localhost:5173` (Port 5173)

## 3. Test Credentials
- **Francophone:** `dr.song@saintjoseph.sos` / `teacher123456`
- **Anglophone:** `mr.jones@saintmary.sos` / `teacher123456`
- **School Admin:** `admin@saintjoseph.sos` / `admin123456`
- **Parent:** `parent@example.com` / `password123`

## 4. New Routes
| Route | Page | Access |
|---|---|---|
| `/find-teachers` | Public Teacher Marketplace | Public |
| `/admin/academic/students/import` | Bulk Import Students | Admin |
| `/admin/operations/faculty/import` | Bulk Import Teachers | Admin |
| `/teacher/profile` | Teacher Profile Edit | Teacher |

## 5. New Files Created
- `components/admin/BulkCsvUpload.tsx` — Reusable CSV upload component
- `pages/admin/operations/BulkImportStudents.tsx` — Student bulk import page
- `pages/admin/operations/BulkImportTeachers.tsx` — Teacher bulk import page
- `pages/public/TeacherMarketplace.tsx` — Public teacher discovery page
- `pages/teacher/settings/TeacherProfileEdit.tsx` — Teacher profile editor

## 6. All Systems Stable
- TypeScript compiles clean (`tsc --noEmit` passes)
- Migrations applied successfully (`staff.0002_teacher_achievements...`)
- Backend and frontend running on local SQLite
