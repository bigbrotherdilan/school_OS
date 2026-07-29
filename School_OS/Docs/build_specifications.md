ANTIGRAVITY MASTER BUILD SPECIFICATION
School OS (SOS)

National Education Operating System

1. SYSTEM IDENTITY

System Name: School OS (SOS)
Category: National Multi-Tenant Education Operating System
Deployment Model: Cloud-Native Multi-Tenant SaaS
Primary Objective:
Digitize, automate, standardize, and unify school administration, academic delivery, parental engagement, and government oversight within a single national platform.

Core Philosophy

One platform for all schools
One identity for every learner
One dashboard for education governance
Zero administrative friction for teachers
Real-time national education intelligence
2. CORE VISION

School OS is not school software.

It is an Education Infrastructure Layer connecting:

Schools
Teachers
Parents
Students
Government authorities

The platform must become indispensable — schools cannot operate efficiently without it.

3. SYSTEM ARCHITECTURE
Architecture Type
Multi-Tenant SaaS
Modular Service Architecture
API-First Platform
Tenant-Aware Runtime System
High-Level Layers
1. Presentation Layer
Web Application
Mobile-First UI
Offline-tolerant interface
2. Application Layer

Core services:

Academic Management
Administration
Finance
Analytics
Identity Management
3. Platform Services
Authentication Service
Tenant Management
Notification Service
Reporting Engine
File Storage Service


4. Data Layer
Logical Tenant Isolation
Shared infrastructure
Schema-per-tenant strategy


5. Government Aggregation Layer
National analytics engine
Cross-school reporting
Policy intelligence dashboards


4. MULTI-TENANT MODEL

Each school = Tenant.

Each tenant contains:

Branding
Academic structures
Students
Teachers
Financial data

Isolation Rules:

No cross-tenant data exposure
Shared codebase
Tenant-aware queries
Tenant ID required in every request

Identity format example:

user@school.sos


5. BILINGUAL SCHOOL STRUCTURE (CRITICAL)

A bilingual institution is treated as:

One School
but internally divided into:

Anglophone Stream
Form 1 → Upper Sixth
Francophone Stream
6ème → Terminale

Both share:

Administration
Finance
Government reporting
Infrastructure

But maintain:

Independent curricula
Timetables
Evaluations
Academic progression


6. USER ACTORS
1. School Administrator

Operational commander of a school.

Capabilities:

Student admissions
Class configuration
Teacher assignment
Timetable generation
Fee management
ID generation
Report card approval
School analytics
2. Teacher

Academic execution agent.

Capabilities:

View timetable
Record lesson completion
Digital Record of Work
Mark entry
Attendance tracking
Homework assignment
Report generation

Goal:
All teaching administration under 10 seconds per lesson.

3. Parent

Observer and supporter.

Capabilities:

Monitor multiple children
View results
Track payments
Attendance monitoring
Notifications
Academic progress insights

4. Government Authority

Education intelligence operator.

Capabilities:

Regional analytics
Program coverage monitoring
Financial transparency
School performance comparison
Inspector dashboards
Policy decision support


7. CORE MODULES
A. Identity & Access Management
Multi-school parent accounts
Role-based permissions
JWT authentication
Tenant-aware authorization
B. Student Information System (SIS)

Central academic registry.

Functions:

Admissions
Enrollment
Student lifecycle tracking
Photo management
Class assignment
C. Academic Management
Program Coverage Management
Upload progression sheets
Divide subjects → chapters → lessons
Map lessons to timetable
Track curriculum completion %
Digital Record of Work Book

Official permanent academic record.

Workflow:

Lesson auto-suggested
Teacher validates achievement
Add homework/notes
Digital signature stored
D. Timetable Engine
Automated scheduling
Teacher load balancing
Classroom allocation
Stream separation
E. Mark Entry & Assessment System (MVP CRITICAL)
Continuous assessment
Exam recording
Auto calculations
Grading configuration per tenant
F. Report Card Generation

Automated.

Features:

Batch generation
Teacher comments
Ranking computation
PDF export
Government-ready formats
G. ID Card Automation

Auto-generated from SIS data.

Supports:

Batch printing
School branding
Photo integration
Staff & student IDs
H. Financial Management
Billing engine
Fee structures
Payment tracking
Debt analytics
Treasury reports
Accounting journals
I. Parent Engagement System
Notifications
Performance tracking
Fee alerts
Multi-child dashboard
J. Government Analytics Dashboard

National visibility layer.

Metrics:

Curriculum completion
Teacher workload
Enrollment trends
Payment compliance
Dropout risk
Regional performance


8. DOMAIN MODEL (CORE ENTITIES)

Entities include:

Tenant
Campus
AcademicYear
Stream
Class
Subject
Teacher
Student
Parent
Enrollment
Timetable
Lesson
RecordOfWork
Assessment
Mark
ReportCard
Invoice
Payment
GovernmentReport

Each entity must maintain:

Unique ID
Audit history
Tenant ownership


9. ROLE PERMISSION MODEL

Strict RBAC enforcement.

Principles:

Least privilege access
Teacher owns academic data
Admin owns operational data
Government owns aggregated data only


10. DATA STANDARDS

Platform follows metadata governance inspired by ISO/IEC 11179.

Naming conventions:

StudentName
PaymentAmount
EnrollmentDate
TeacherID

Classword standards:

Name
ID
Date
Code
Amount


11. WORKFLOW AUTOMATION

Mandatory workflows:

Admission workflow
Timetable workflow
Lesson validation workflow
Mark entry workflow
Report card workflow
Fee collection workflow
Government reporting workflow


12. UI/UX PRINCIPLES

Design Rules:

Mobile-first
Low bandwidth optimized
Minimal clicks
Teacher-first design
Dashboard-driven navigation
White-label tenant branding


13. ANALYTICS ENGINE
School Analytics
Work coverage %
Academic performance
Financial health
Attendance trends
Government Analytics
National education health index
Regional comparison
Curriculum completion
Resource distribution insight


14. NON-FUNCTIONAL REQUIREMENTS

System must support:

National-scale deployment
Millions of users
Offline usage fallback
High security standards
Continuous audit logging
Data export & interoperability
API integrations


15. SECURITY MODEL
JWT authentication
Tenant isolation enforcement
Audit trails
Encrypted storage
Role verification per request


16. API DESIGN PRINCIPLE

API-First Development.

Example endpoints:

POST /students
GET /timetable/{teacher}
POST /record-of-work
POST /marks
GET /report-cards
GET /government/analytics
17. TENANT CONFIGURATION SYSTEM

Each school uploads:

Logo
Colors
Academic structure
Grading policy
Fee configuration
Academic calendar

Stored as runtime configuration files.

18. MVP SCOPE (CURRENT BUILD)

Included:

SIS
Timetable
Record of Work
Mark Entry
Report Cards
ID Cards
Parent Dashboard
Government Dashboard


19. FUTURE ROADMAP (NOT MVP)

Reserved:

AI academic assistant
Predictive dropout analytics
National student ID federation
Learning management integration
Offline mobile synchronization


20. SUCCESS CRITERIA

School OS succeeds when:

Teachers finish logbooks in seconds.
Administrators stop manual reporting.
Parents depend on daily insights.
Government monitors education live.
Schools feel operationally incomplete without SOS.
