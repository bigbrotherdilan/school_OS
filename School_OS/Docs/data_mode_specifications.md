Data Model Specification

Authoritative Database Architecture

This document defines all core entities, relationships, and data ownership rules required for Antigravity to build School OS without redesign cycles or schema refactoring.

1. ARCHITECTURAL FOUNDATION

School OS uses:

Multi-Tenant SaaS
Schema-Per-Tenant Model
Central Identity Service
Government Analytics Layer
Database Strategy
Global Database (Shared)

Contains platform-level data.

global_db
Tenant Database Schemas

Each school receives isolated schema.

school_alpha.*
school_beta.*
school_gamma.*
2. GLOBAL CORE ENTITIES (PLATFORM LEVEL)

These exist once across the system.

2.1 Tenant (School)

Represents an institution.

Field	Type	Description
tenant_id	UUID	Primary identifier
school_name	String	Official name
education_type	Enum	Anglo / Franco / Bilingual
region	String	Administrative region
country	String	Nation
logo_url	String	Branding asset
theme_config	JSON	UI theme
schema_name	String	Database schema
status	Enum	Active / Suspended
created_at	Timestamp	Creation date
Relationship
Tenant → owns → all school data
2.2 User Identity (Global Authentication)

Centralized identity across schools.

Field	Type
user_id	UUID
email	String
phone	String
password_hash	String
identity_namespace	String
default_language	String
created_at	Timestamp

Example namespace:

parent@schoolA.sos
parent@schoolB.sos
2.3 User Role Mapping

Allows one identity across multiple schools.

Field	Type
id	UUID
user_id	FK
tenant_id	FK
role	Enum
status	Active/Inactive

Roles:

SuperAdmin
Admin
Teacher
Parent
Government
2.4 Government Authority
Field	Type
authority_id	UUID
ministry_name	String
country	String
access_scope	JSON
3. TENANT (SCHOOL) DATA MODEL

Everything below lives inside:

tenant_schema.*
3.1 Academic Structure
AcademicYear
Field	Type
academic_year_id	UUID
name	String
start_date	Date
end_date	Date
active	Boolean
Term / Sequence

Supports both systems.

Field	Type
period_id	UUID
academic_year_id	FK
name	String
type	Term/Sequence
order_number	Integer
Stream (Critical for Bilingual Schools)

Defines internal separation.

Field	Type
stream_id	UUID
name	Anglo / Franco
curriculum_type	Enum
language	EN/FR

One school → multiple streams.

Class
Field	Type
class_id	UUID
stream_id	FK
name	Form 1 / 6eme
level_order	Integer
classroom	String
3.2 Human Entities
Teacher
Field	Type
teacher_id	UUID
user_id	FK
staff_number	String
qualification	String
department	String
status	Active
Parent
Field	Type
parent_id	UUID
user_id	FK
occupation	String
Student
Field	Type
student_id	UUID
admission_number	String
first_name	String
last_name	String
gender	Enum
date_of_birth	Date
photo_url	String
class_id	FK
stream_id	FK
status	Active
Parent-Student Relationship

(Many-to-many)

Field	Type
link_id	UUID
parent_id	FK
student_id	FK
relationship	Father/Mother/Guardian
3.3 Academic Planning Model
Subject
Field	Type
subject_id	UUID
name	String
code	String
stream_id	FK
Teaching Assignment

Teacher allocation.

Field	Type
assignment_id	UUID
teacher_id	FK
subject_id	FK
class_id	FK
Scheme Of Work (Progression Sheet)

Uploaded once per term.

Field	Type
scheme_id	UUID
subject_id	FK
academic_year_id	FK
uploaded_by	FK
file_url	String
Module
Field	Type
module_id	UUID
scheme_id	FK
title	String
order_number	Integer
Lesson Plan

Predefined lessons.

Field	Type
lesson_id	UUID
module_id	FK
title	String
expected_outcome	Text
essential_knowledge	Text
3.4 Timetable Engine
Room
Field	Type
room_id	UUID
name	String
capacity	Integer
Timetable Slot
Field	Type
slot_id	UUID
class_id	FK
subject_id	FK
teacher_id	FK
room_id	FK
day_of_week	Enum
start_time	Time
end_time	Time
3.5 Digital Logbook (CORE SOS FEATURE)
Logbook Entry
Field	Type
logbook_id	UUID
timetable_slot_id	FK
lesson_id	FK
teacher_id	FK
date	Date
achievement_status	Achieved/Not
homework	Text
remarks	Text
digital_signature	Boolean
timestamp	Timestamp

Permanent official record.

3.6 Assessment & Report System
Assessment
Field	Type
assessment_id	UUID
subject_id	FK
class_id	FK
period_id	FK
type	CA/Exam
max_score	Integer
Student Mark
Field	Type
mark_id	UUID
student_id	FK
assessment_id	FK
score	Decimal
Report Card
Field	Type
report_id	UUID
student_id	FK
period_id	FK
average	Decimal
position	Integer
generated_at	Timestamp
3.7 Attendance System
Attendance Record
Field	Type
attendance_id	UUID
student_id	FK
date	Date
status	Present/Absent/Late
recorded_by	FK
3.8 Financial System
Fee Structure
Field	Type
fee_id	UUID
class_id	FK
description	String
amount	Decimal
Invoice
Field	Type
invoice_id	UUID
student_id	FK
total_amount	Decimal
status	Paid/Pending
Payment
Field	Type
payment_id	UUID
invoice_id	FK
amount	Decimal
payment_method	String
payment_date	Timestamp
3.9 Communication System
Notification
Field	Type
notification_id	UUID
user_id	FK
title	String
message	Text
read_status	Boolean
4. GOVERNMENT ANALYTICS MODEL

Government NEVER reads tenant tables directly.

Instead:

ETL Service
→ Aggregate
→ Anonymize
→ Push to analytics_db
Education Analytics Snapshot
Field	Type
snapshot_id	UUID
tenant_id	FK
total_students	Integer
total_teachers	Integer
coverage_percent	Decimal
pass_rate	Decimal
5. RELATIONSHIP OVERVIEW
Tenant
 ├── Streams
 │    └── Classes
 │         ├── Students
 │         ├── Timetable
 │         └── Assessments
 │
 ├── Teachers
 │     └── Logbooks
 │
 ├── Parents
 │     └── Student Links
 │
 └── Financial Records
6. CRITICAL DESIGN RULES (NON-NEGOTIABLE)
Rule 1 — Tenant Isolation

No cross-schema joins allowed.

Rule 2 — Identity Centralization

Authentication ALWAYS global.

Rule 3 — Academic Versioning

Never overwrite:

schemes
marks
logbooks

Only version.

Rule 4 — Government Read-Only

Analytics only.

Rule 5 — Bilingual Integrity

Streams must behave like two schools inside one tenant.

7. WHAT THIS ENABLES

This schema allows SOS to support:

Millions of students
National deployments
Ministry oversight
AI automation
Zero redesign scaling