Application Flow per Actor

Operational User Journey Blueprint

This document defines exact interaction flows for each actor inside School OS.
Antigravity uses this to build navigation, permissions, APIs, and UI behavior without guessing.

GLOBAL SYSTEM FLOW (ALL USERS)

Every actor follows the same root logic:

User Opens App
→ Tenant Identified
→ Authentication
→ Role Detection
→ Load Role Dashboard
→ Execute Role Actions

Core determinants:

Tenant (School)
Stream (Anglophone / Francophone)
Role
Academic Year
1. SUPER ADMIN FLOW (PLATFORM OWNER)
Purpose

Manages the entire SOS ecosystem, not schools.

Entry Flow
Login
→ Platform Control Center
Dashboard Modules
Tenant Management
Create School
Activate/Deactivate School
Assign subscription
View onboarding status

Flow:

Create Tenant
→ System provisions schema
→ Apply branding
→ Initialize academic config
Platform Monitoring
Active schools
Users online
System health
Storage usage
Global Configuration
Academic templates
Default grading systems
Language packs
Feature flags
Government Authorization
Register Ministry
→ Assign Region Access
→ Enable Analytics View
2. SCHOOL ADMIN FLOW
Purpose

Runs the entire institution digitally.

Entry Flow
Login
→ School Dashboard

Dashboard represents the digital school office.

A. Academic Setup Flow
First-Time Setup
Select Education System
→ Anglophone
→ Francophone
→ Bilingual

If Bilingual:

Create Streams:
   Anglo Section
   Franco Section

One school. Two academic universes.

Academic Configuration

Admin configures:

Academic year
Terms/Sequences
Classes
Subjects
Departments
B. Teacher Management
Add Teacher
→ Assign Subject
→ Assign Classes
→ Generate Account

System auto-creates timetable eligibility.

C. Student Admission Flow
Register Student
→ Upload Photo
→ Assign Stream
→ Assign Class
→ Link Parent

Outputs:

Student ID
Parent Access
Academic Record
D. Timetable Creation
Open Timetable Engine
→ Allocate Teachers
→ Allocate Rooms
→ Validate Conflicts
→ Publish Timetable

Unlocks teacher workflows.

E. Financial Management

Admin:

defines fee structure
tracks payments
views debts

Flow:

Create Fee Structure
→ Generate Bills
→ Monitor Payments
F. Reporting Control

Admin can:

publish results
lock marks
generate report cards
export ministry reports
G. School Analytics

Dashboard Widgets:

program coverage
performance ranking
fee compliance
attendance
3. TEACHER FLOW
Purpose

Academic execution.

Entry Flow
Login
→ Teacher Dashboard

Dashboard automatically shows:

Today's classes
Pending lessons
Recent alerts
A. Daily Teaching Flow
Lesson Time Arrives
→ System detects timetable slot
→ Suggested lesson appears

Teacher selects class.

B. 10-Second Logbook Flow
Open Lesson
→ Pre-filled Module
→ Pre-filled Topic
→ Confirm Achievement
→ Add Homework (optional)
→ Digital Signature
→ Save

Logbook completed.

Permanent record stored.

C. Mark Entry Flow
select section ( francophone or anglophone in bilingual school)
Select Class
→ Select 
 select sequence
→ Select subject
→ Enter Marks
→ Auto Average Calculated
→ Submit

System validates grading rules automatically.

D. Program Coverage Tracking

Teacher sees:

lessons completed
lessons remaining
curriculum progress %
E. Communication Flow

Teacher may:

notify parents
record absence
send remarks
4. PARENT FLOW
Purpose

Unified visibility across children and schools.

Entry Flow
Login
→ Parent Super Dashboard

System aggregates children automatically.

Parent Dashboard

Displays per child:

school
class
attendance
performance
financial status
A. Academic Monitoring
Select Child
→ View Report Card
→ View Continuous Assessment
→ View Teacher Remarks
B. Financial Tracking
View Fees
→ Outstanding Balance
→ Payment History
C. Multi-School Flow

Parent identity spans tenants:

Child A → Anglo School
Child B → Franco School

Single dashboard.

D. Notifications

Parent receives:

absence alerts
results published
payment reminders
5. GOVERNMENT / MINISTRY FLOW
Purpose

Educational governance and national intelligence.

Government does not manage schools individually.

Entry Flow
Government Login
→ National Education Dashboard
A. Analytics Overview

Displays:

total schools
enrollment by region
teacher distribution
performance trends
B. Program Coverage Monitoring

Government can see:

Region
→ School
→ Subject Coverage %

Identifies lagging institutions.

C. Policy Intelligence

Ministry analyzes:

success rates
exam readiness
resource gaps

No raw student editing allowed.

Read-only governance layer.

D. Inspection Flow

Inspector opens:

Select School
→ Select Teacher
→ View Digital Logbook

Instant compliance verification.

6. SYSTEM AUTOMATED FLOWS (NO USER ACTION)
Identity Linking

Parent linked automatically when:

Student registered + Parent phone/email exists
Lesson Automation

Timetable triggers lesson suggestions automatically.

Report Generation

When marks finalized:

System auto-generates report cards
Government Aggregation

Nightly sync pushes anonymized analytics.

7. CROSS-ACTOR INTERACTION MAP
Actor	Interacts With
Admin	Teachers, Students, Parents
Teacher	Students, Parents
Parent	Teachers
Government	Schools (Analytics only)
Super Admin	Entire Platform
8. MASTER FLOW SUMMARY
Super Admin → Creates School
School Admin → Builds Institution
Teacher → Delivers Education
Parent → Monitors Progress
Government → Governs System
