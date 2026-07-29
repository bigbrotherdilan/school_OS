SOURCE OF TRUTH & EXECUTION CONSTRAINTS

Engineering Control Document — Version 1.0

This document becomes the single authoritative reference for Antigravity.
No component may contradict this file.

1. SYSTEM IDENTITY

System Name: School OS (SOS)
System Type: National Multi-Tenant Education Operating System
Architecture: Multi-Tenant SaaS (Schema-per-Tenant)
Primary Goal: Run a school completely paperless while enabling ministry-level visibility.

2. CORE DEFINITIONS (NON-NEGOTIABLE)
School (Tenant)

A legally recognized educational institution registered in SOS.

One school = one tenant
Has independent data schema
Has branding, calendar, policies
Section

Academic system inside a school.

A bilingual school is:

ONE SCHOOL → MULTIPLE SECTIONS

Possible Sections:

Anglophone
Francophone
Bilingual

Sections share:

Finance
Administration
Infrastructure

Sections differ in:

Classes
Programs
Evaluation rules
Academic Systems
Anglophone Structure
Form 1
Form 2
Form 3
Form 4
Form 5
Lower Sixth
Upper Sixth
Francophone Structure
6ème
5ème
4ème
3ème
2nde
Première
Terminale
Academic Year

A bounded operational period.

Rules:

Immutable once started
All records tied to academic year
No cross-year edits allowed
Student Identity

Student identity is global but tenant-scoped.

Properties:

Unique Global Student ID
Linked to multiple schools allowed
Parent linkage permanent

Student record NEVER deleted — only archived.

Parent Identity

Parent identity is platform-wide.

One parent:

May belong to multiple schools
May manage multiple children
Uses identity namespacing internally
Teacher Identity

Teacher may:

Belong to multiple schools
Teach multiple sections
Have role permissions per tenant
Government Actor

Oversight role.

Cannot modify school data.
Can only:

Monitor
Audit
Analyze
3. ACTOR PERMISSION MATRIX
Action	Admin	Teacher	Parent	Government
Create School	✓	✗	✗	✓
Register Student	✓	✗	✗	✗
Assign Teacher	✓	✗	✗	✗
Enter Logbook	✗	✓	✗	✗
Enter Marks	✗	✓	✗	✗
Generate Report	✓	✓	✗	✗
View Child Data	✗	✗	✓	✗
View National Analytics	✗	✗	✗	✓
Modify Records	✓	Limited	✗	✗
4. DOMAIN RULES
4.1 Bilingual School Rule
Single tenant
Shared administration
Separate academic configurations
Separate grading logic
4.2 Logbook Rules
Must be filled after lesson
Auto-suggested lesson
Teacher confirms only
Entry becomes immutable after validation

Logbook Status:

PLANNED
TAUGHT
VALIDATED
INSPECTED
4.3 Marks & Report Card Rules

Marks lifecycle:

Draft
Submitted
Approved
Published

After publishing → locked.

Report cards generated automatically.

4.4 Promotion Rules

Promotion decided by:

Average
Subject coefficient
Discipline status
Administrative approval

Student Status:

ACTIVE
PROMOTED
REPEATING
TRANSFERRED
GRADUATED
ARCHIVED
4.5 Financial Rules

Fees linked to:

Student
Academic year
Class

Payment Events:

InvoiceCreated
PaymentReceived
BalanceUpdated
5. SYSTEM STATES
Student States

REGISTERED → ACTIVE → PROMOTED → GRADUATED → ARCHIVED

Lesson States

PLANNED → TAUGHT → VALIDATED → INSPECTED

Report States

GENERATED → VERIFIED → PUBLISHED

6. EVENT SYSTEM (CORE MICROSERVICE TRIGGERS)

Mandatory system events:

SchoolCreated
AcademicYearStarted
StudentRegistered
TeacherAssigned
LessonCompleted
LogbookValidated
MarksSubmitted
ReportPublished
PaymentCompleted
InspectionInitiated

All services communicate via events.

7. DATA LIFECYCLE POLICY
Data	Editable	Versioned	Permanent
Student Identity	✗	✓	✓
Logbook Entry	✗	✓	✓
Marks	Limited	✓	✓
Reports	✗	✓	✓
Financial Records	✗	✓	✓

Deletion NOT allowed.
Only archival permitted.

8. UX NAVIGATION STRUCTURE
Admin

Login → Dashboard → School Setup → Users → Classes → Finance → Reports → Analytics

Teacher

Login → Today's Lessons → Logbook → Marks → Coverage → Reports

Parent

Login → Children → Academic Progress → Fees → Reports → Notifications

Government

Login → National Dashboard → Region → School → Analytics → Inspection

9. DESIGN SYSTEM CONSTRAINTS

Primary Principle:
Professional + Government Grade

Clean interfaces
Minimal clicks
High readability
Low training requirement

Design Tokens:

Primary: Deep Blue
Secondary: Academic Green
Accent: Gold
Font: Sans-serif institutional
Mobile-first layout
10. SAMPLE DATA REQUIREMENT (FOR AI)

Antigravity must receive:

Example timetable
Example class list
Example report card
Example logbook entry
Example school fee structure

AI builds fastest from real samples.

11. ENGINEERING DEFINITION OF DONE

School OS is considered operational when:

A school runs paperless
Teacher logs lesson in <10 seconds
Report cards auto-generate
Parent monitors all children
Ministry sees live analytics
Multi-school deployment works without data collision
12. NON-NEGOTIABLE ARCHITECTURAL PRINCIPLES
Multi-tenant first
Event-driven communication
Immutable academic records
Government visibility layer
Offline-tolerant mobile usage
API-first architecture
No redesign after service creation