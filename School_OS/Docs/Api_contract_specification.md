API Contract Specification

Authoritative Service Interface Definition

This document defines all backend APIs that Antigravity must implement before coding services, ensuring:

zero redesign cycles
predictable integrations
scalable national deployment
frontend + backend parallel development
1. API ARCHITECTURE PRINCIPLES
Architecture Style
RESTful APIs
JSON communication
Stateless services
Multi-Tenant aware
Role-based authorization
Base URL
https://api.schoolos.sos/v1/
Mandatory Headers
Authorization: Bearer <JWT>
X-Tenant-ID: <tenant_uuid>
Content-Type: application/json
Core Rules
Every request must include Tenant Context
Authentication handled globally
Authorization handled per role
APIs must be versioned
No endpoint accesses another tenant
2. AUTHENTICATION SERVICE

Central Identity System.

POST /auth/login

Authenticate user.

Request

{
  "email": "",
  "password": ""
}

Response

{
  "access_token": "",
  "refresh_token": "",
  "roles": [],
  "tenants": []
}
POST /auth/refresh

Refresh token.

POST /auth/logout

Invalidate session.

GET /auth/me

Returns logged-in user profile.

3. TENANT MANAGEMENT SERVICE

(Platform Super Admin Only)

POST /tenants

Create school.

{
  "school_name": "",
  "education_type": "Bilingual",
  "country": "",
  "region": ""
}

Creates:

schema
default streams
base configuration
GET /tenants

List institutions.

PATCH /tenants/{id}

Update branding/config.

POST /tenants/{id}/theme

Upload:

logo
colors
UI theme JSON
4. USER MANAGEMENT SERVICE
POST /users

Create user.

{
  "name": "",
  "email": "",
  "role": "Teacher"
}
GET /users

Filter:

role
class
department
PATCH /users/{id}

Update profile.

POST /users/{id}/assign-role

Assign role within tenant.

5. ACADEMIC STRUCTURE SERVICE
STREAMS
GET /streams

Returns Anglo / Franco streams.

POST /streams

Create stream.

CLASSES
POST /classes
{
  "name": "Form 3",
  "stream_id": ""
}
GET /classes
SUBJECTS
POST /subjects

Create subject.

GET /subjects
6. STUDENT INFORMATION SYSTEM (SIS)
POST /students

Register student.

{
  "first_name": "",
  "last_name": "",
  "class_id": ""
}
GET /students

Filters:

class
stream
status
GET /students/{id}

Student profile.

POST /students/bulk-import

Upload CSV.

POST /students/{id}/photo

Upload photo.

7. PARENT MANAGEMENT
POST /parents

Create parent.

POST /parents/link-student
{
  "parent_id": "",
  "student_id": ""
}
GET /parents/{id}/children

Unified dashboard data.

8. TIMETABLE SERVICE
POST /timetable

Create lesson slot.

{
  "class_id": "",
  "teacher_id": "",
  "subject_id": "",
  "day": "Monday",
  "start_time": ""
}
GET /timetable/class/{id}
GET /timetable/teacher/{id}
9. PROGRAM COVERAGE SERVICE
POST /schemes

Upload progression sheet.

POST /modules

Create module.

POST /lessons

Create lesson definition.

GET /coverage/teacher/{id}

Returns:

lessons taught
expected lessons
coverage %
10. DIGITAL LOGBOOK SERVICE (CORE SOS)
GET /logbook/today

Auto-suggest lesson based on timetable.

POST /logbook/confirm

10-Second Entry

{
  "lesson_id": "",
  "status": "Achieved",
  "homework": "Ex 3 page 12"
}
GET /logbook/history

Teacher logbook.

GET /logbook/admin-view

Inspector view.

11. MARK ENTRY SERVICE
POST /assessments

Create exam or CA.

POST /marks/bulk-entry
{
  "assessment_id": "",
  "marks": []
}
GET /marks/student/{id}
PATCH /marks/{id}

Versioned updates only.

12. REPORT CARD SERVICE
POST /reports/generate

Generate class reports.

GET /reports/student/{id}
POST /reports/publish

Release to parents.

GET /reports/pdf/{id}

Download official bulletin.

13. ATTENDANCE SERVICE
POST /attendance

Record attendance.

GET /attendance/class/{id}
GET /attendance/student/{id}
14. FINANCIAL MANAGEMENT SERVICE
POST /fees

Create fee structure.

POST /invoices/generate

Auto-create invoices.

POST /payments

Record payment.

GET /finance/dashboard

Returns:

revenue
debts
delayed payments
15. ID CARD AUTOMATION SERVICE
POST /idcards/generate

Generate batch cards.

GET /idcards/download/{class}

Download printable cards.

16. NOTIFICATION SERVICE
POST /notifications/send

Send to:

class
parent
teacher
entire school
GET /notifications

User inbox.

17. GOVERNMENT ANALYTICS API

(Read-Only Authority Access)

GET /gov/schools

List registered schools.

GET /gov/analytics

Returns aggregated:

enrollment
pass rate
coverage
attendance
GET /gov/school/{id}

High-level analytics only.

18. FILE STORAGE SERVICE
POST /files/upload

Used for:

logos
schemes
reports
photos
GET /files/{id}

Retrieve asset.

19. AUDIT & COMPLIANCE SERVICE
GET /audit/logs

Tracks:

mark edits
logbook entries
financial changes
POST /audit/export

Inspection export.

20. SYSTEM HEALTH SERVICE
GET /health

Service status.

GET /metrics

Performance metrics.

21. PERMISSIONS MATRIX (SUMMARY)
Role	Access
Super Admin	All tenants
School Admin	School only
Teacher	Assigned classes
Parent	Children only
Government	Analytics only
22. CRITICAL IMPLEMENTATION RULES
Rule 1 — API First Development

No backend logic before API approval.

Rule 2 — Version Everything
/v1/
/v2/
Rule 3 — No Breaking Changes

Only additive updates.

Rule 4 — Tenant Guard Middleware Required

Every endpoint validates:

tenant_id + role + permission
Rule 5 — Async Heavy Operations

Background jobs required for:

report generation
ID cards
analytics aggregation
23. RESULT OF THIS CONTRACT

Antigravity can now build:

backend services independently
frontend prototypes immediately
government integration safely
national-scale education infrastructure