Technical Execution Blueprint

Engineering Build Order — Zero Redesign Strategy

This blueprint defines exactly how School OS must be built, in the correct order, so Antigravity (or any AI engineering system) can construct the platform once, without architectural rewrites.

1. EXECUTION PRINCIPLES
Rule 1 — Infrastructure Before Features

Never build UI or modules before:

identity
tenancy
data model

Most failed systems reverse this.

Rule 2 — Platform First, Application Second

SOS is not an app.

It is a platform where apps run.

Build sequence:

Platform → Core Services → Modules → Dashboards → Intelligence
Rule 3 — Everything Must Be Tenant-Aware

Every component must automatically know:

Who is the user?
Which school?
Which stream?
Which role?

No exception.

2. PHASED BUILD ORDER
PHASE 0 — FOUNDATIONS (DO NOT SKIP)
0.1 Repository Architecture

Monorepo structure:

school-os/
 ├── apps/
 │   ├── web
 │   ├── admin
 │   ├── government
 │   └── parent
 ├── services/
 │   ├── auth-service
 │   ├── tenant-service
 │   ├── academic-service
 │   ├── finance-service
 │   ├── analytics-service
 │   └── notification-service
 ├── packages/
 │   ├── ui-kit
 │   ├── api-client
 │   ├── types
 │   └── utils
 └── infrastructure/
0.2 Technology Baseline

Frontend:

React (tenant dynamic rendering)
TypeScript
Tailwind UI system

Backend:

Django / FastAPI service layer
REST + Event architecture

Database:

PostgreSQL

Infrastructure:

Docker
Cloud object storage
API Gateway
PHASE 1 — MULTI-TENANT CORE (MOST CRITICAL)
Build First.

Nothing else exists without this.

1.1 Tenant Management Service

Creates schools.

Responsibilities:

create tenant
provision schema
assign tenant ID
store branding
academic configuration

Schema example:

public.tenants

Fields:

tenant_id
school_name
logo
colors
language_system
stream_structure
1.2 Schema-Per-Tenant Provisioning

When school registers:

Automatically create:

tenant_A.students
tenant_A.teachers
tenant_A.classes

Isolation enforced at DB level.

1.3 Runtime Configuration Loader

Frontend startup flow:

User opens app
→ identify tenant domain
→ fetch tenant config
→ apply theme dynamically

No redeploy required.

PHASE 2 — IDENTITY & ACCESS PLATFORM
2.1 Authentication Service

Implement:

login
session validation
password reset
role assignment

Identity format:

user@tenant.sos
2.2 JWT Token Design

Token must include:

user_id
tenant_id
role
stream
permissions

Every API request validated against token.

2.3 Role-Based Access Control

Roles:

Super Admin
School Admin
Teacher
Parent
Government Officer

Permission middleware required globally.

PHASE 3 — CORE DOMAIN MODEL

Create shared domain package:

packages/types

Entities (build in this order):

Tenant
AcademicYear
Stream (Anglo / Franco)
Class
Subject
Teacher
Student
Parent
Enrollment

No UI yet.

PHASE 4 — STUDENT INFORMATION SYSTEM (SIS)

First real module.

Features:

admission workflow
photo upload
class assignment
parent linking
enrollment history

Outcome:
School becomes operational.

PHASE 5 — TIMETABLE ENGINE

Must precede academic modules.

Build:

teacher availability
subject allocation
classroom assignment
stream separation

Outputs:

Teacher Timetable
Class Timetable
Room Schedule
PHASE 6 — PROGRAM COVERAGE ENGINE

Upload progression sheets.

System must:

Parse curriculum
Split into:
modules
chapters
lessons
Map lessons → timetable slots

Creates foundation for logbook automation.

PHASE 7 — DIGITAL RECORD OF WORK (10-SECOND SYSTEM)

Teacher workflow:

Open dashboard
→ system auto-detects lesson
→ lesson prefilled
→ teacher validates
→ sign

Stored as permanent academic record.

Inspector-ready.

PHASE 8 — MARK ENTRY ENGINE (MVP CRITICAL)

Build before report cards.

Features:

assessment types
grading scales
automatic averages
coefficients
ranking engine

Tenant-configurable grading logic.

PHASE 9 — REPORT CARD ENGINE

Fully automated generation.

Inputs:

marks
attendance
teacher comments
grading rules

Outputs:

PDF bulletins
bilingual formats
batch generation
PHASE 10 — ID CARD AUTOMATION

Pull data from SIS.

Pipeline:

Student Data
+ Photo
+ Tenant Branding
→ Template Renderer
→ ID Cards

Batch processing mandatory.

PHASE 11 — FINANCIAL SYSTEM

Modules:

fee structures
billing engine
payment tracking
debt analytics
accounting journals

Automatically linked to students.

PHASE 12 — PARENT SUPER DASHBOARD

Capabilities:

multi-child aggregation
multi-school visibility
results
payments
attendance

Parent identity spans tenants.

PHASE 13 — GOVERNMENT INTELLIGENCE PLATFORM

Highest strategic layer.

Government sees:

aggregated data only
no raw tenant data

Dashboards:

enrollment analytics
teacher workload
curriculum completion
regional comparisons

This transforms SOS into national infrastructure.

PHASE 14 — NOTIFICATION SYSTEM

Event-driven.

Triggers:

mark published
absence recorded
payment overdue
report released

Channels:

app notification
SMS-ready integration
email
PHASE 15 — ANALYTICS ENGINE

Create data warehouse layer.

Compute:

coverage %
performance trends
financial health
dropout risk indicators
PHASE 16 — DESIGN SYSTEM

Build reusable UI kit.

Components:

dashboards
tables
forms
widgets
report viewers

All tenant-themed dynamically.

PHASE 17 — API STANDARDIZATION

All services expose:

/v1/{tenant}/resource

Mandatory:

pagination
audit logging
validation schemas
PHASE 18 — SECURITY HARDENING

Implement:

audit trails
encrypted storage
permission validation
request tracing
anomaly logging
PHASE 19 — PERFORMANCE & SCALE

Required capabilities:

millions of students
thousands of schools
horizontal scaling
async processing queues
PHASE 20 — DEPLOYMENT STRATEGY

Environments:

dev
staging
production
government

CI/CD must:

auto test
auto migrate schemas
auto deploy services
PHASE 21 — MVP RELEASE CHECKPOINT

System is MVP-ready when:

✔ Admissions work
✔ Timetable exists
✔ Teachers fill logbooks in seconds
✔ Marks entered
✔ Report cards generated
✔ Parents connected
✔ Government dashboard operational

22. POST-MVP (LOCKED FOR LATER)

Do NOT build yet:

AI grading assistant
Predictive analytics
National student ID federation
LMS integration
FINAL ENGINEERING OBJECTIVE

School OS must evolve into:

Education Operating System → National Digital Infrastructure

When completed correctly:

Teachers cannot operate without it.
Schools depend on it daily.
Government governs education through it.