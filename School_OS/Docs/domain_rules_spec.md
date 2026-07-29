DOMAIN RULES SPECIFICATION

Engineering Control Document — Version 1.0

This file removes AI ambiguity by defining all the operational rules and logic for academic, financial, and administrative workflows.
It is the source of truth for Antigravity and cannot be overridden.

1. ACADEMIC RULES
1.1 Class Structures
Anglophone
Form 1 → Form 2 → Form 3 → Form 4 → Form 5 → Lower Sixth → Upper Sixth
Each class has:
Subjects
Timetable slots
Assigned teachers
Maximum student capacity
Francophone
6ème → 5ème → 4ème → 3ème → 2nde → Première → Terminale
Same constraints as Anglophone
1.2 Sections in a School
A school may contain multiple sections (Anglophone / Francophone / Bilingual)
Each section:
Owns class hierarchy
Owns grading logic
Owns schedule and evaluation calendar
Shared:
Administration
Finance
Infrastructure
Constraint: No cross-section grades or timetables
1.3 Student Lifecycle
State	Description
REGISTERED	Student added to system
ACTIVE	Attending lessons, eligible for marks entry
PROMOTED	Completed academic requirements, next class assigned
REPEATING	Failed promotion, repeats same class next year
TRANSFERRED	Moved to another school (tenant)
GRADUATED	Completed terminal class, alumni status
ARCHIVED	No longer active, preserved for historical records
Rule: Only admins may change status from REGISTERED → ACTIVE or PROMOTED.
Rule: Logbook entries and marks must exist to process PROMOTION.
1.4 Teacher Assignments
Teachers can belong to multiple sections and schools
Can teach multiple subjects
Permissions per tenant: must be explicitly granted
Cannot modify other teachers’ records
Must fill logbooks within 10 seconds per lesson
1.5 Logbook Rules (CBA/RLS)
Must record:
Module
Lesson title
Categories of actions
Expected outcomes
Essential knowledge / exercises / homework
Immutable after validation
Statuses:
PLANNED
TAUGHT
VALIDATED
INSPECTED
Auto-linked to timetable
Auto-suggest lesson based on class and schedule
1.6 Marks & Report Cards
Marks lifecycle:
Draft
Submitted
Approved
Published (locked)
Report cards generated per:
Sequence
Term
Annual
Bilingual schools: separate templates per section, combined for parents
1.7 Promotion Logic
Promotion Criteria:
Subject averages
Coefficients
Attendance
Discipline

Algorithm:

if average >= pass_mark AND attendance >= required_days AND no major infractions:
    PROMOTED
else if repeated_failure:
    REPEATING
else:
    ADMIN_REVIEW
Locked report cards are required before promotion
2. FINANCIAL RULES
2.1 Fee Structures
School pays: 3,000 XAF per student/year
Parent pays: 2,000 XAF per child/year
Fees tied to academic year and class
Payment statuses:
INVOICE_CREATED
PAYMENT_PENDING
PAYMENT_RECEIVED
BALANCE_UPDATED
Multiple children → aggregated parent invoices
System generates receipts automatically
2.2 Transaction Rules
Transactions immutable after payment validation
Refunds require admin approval
School and parent records separated logically per tenant
2.3 Financial Reporting
Dashboard shows:
Paid vs unpaid per class
Delayed payments
Annual revenue forecast
Reports exportable as:
PDF
CSV
XLSX
3. GOVERNMENT RULES
3.1 Access & Visibility
Cannot modify school data
Can:
View national/regional dashboards
Inspect logbooks
Audit financial records
Real-time analytics for:
Enrollment
Attendance
Academic performance
Financial health
3.2 Inspection Rules
Statuses:
PENDING
IN_PROGRESS
COMPLETED
Inspection reports immutable after submission
Alerts sent to admin for inspection actions
4. PARENT RULES
Parent may manage multiple children
Parent view must aggregate data across schools/sections
Can view:
Report cards
Attendance
Fee status
Cannot modify any academic or financial data
5. NOTIFICATION RULES
Event-driven notifications:
Fee due reminders
Report card published
Lesson or timetable changes
Channels:
SMS
Email
Push notification
Priority levels:
High: Payment issues, missing logbook
Medium: Lesson changes, school announcements
Low: Optional newsletters
6. SYSTEM CONSTRAINTS
Multi-tenant schema per school
Immutable academic and financial data
Event-driven microservices
All actions logged for audit (timestamp, user, tenant, action)
System must scale to all national schools with zero downtime
Offline caching supported for rural areas
7. INTEROPERABILITY
Metadata standardized using ISO/IEC 11179
Data exchange via:
XML / XML Schema
XMI for models
Cross-section integration prohibited (except for parent view)
8. EXECUTION REQUIREMENTS
No AI redesign cycles allowed
All workflows defined above are hard constraints
Antigravity must implement all rules before deployment
Versioning mandatory for all logbooks, marks, financials, and reports




or 

DOMAIN RULES SPECIFICATION

Engineering Control Document — Version 1.0

This file removes AI ambiguity by defining all the operational rules and logic for academic, financial, and administrative workflows.
It is the source of truth for Antigravity and cannot be overridden.

1. ACADEMIC RULES
1.1 Class Structures
Anglophone
Form 1 → Form 2 → Form 3 → Form 4 → Form 5 → Lower Sixth → Upper Sixth
Each class has:
Subjects
Timetable slots
Assigned teachers
Maximum student capacity
Francophone
6ème → 5ème → 4ème → 3ème → 2nde → Première → Terminale
Same constraints as Anglophone
1.2 Sections in a School
A school may contain multiple sections (Anglophone / Francophone / Bilingual)
Each section:
Owns class hierarchy
Owns grading logic
Owns schedule and evaluation calendar
Shared:
Administration
Finance
Infrastructure
Constraint: No cross-section grades or timetables
1.3 Student Lifecycle
State	Description
REGISTERED	Student added to system
ACTIVE	Attending lessons, eligible for marks entry
PROMOTED	Completed academic requirements, next class assigned
REPEATING	Failed promotion, repeats same class next year
TRANSFERRED	Moved to another school (tenant)
GRADUATED	Completed terminal class, alumni status
ARCHIVED	No longer active, preserved for historical records
Rule: Only admins may change status from REGISTERED → ACTIVE or PROMOTED.
Rule: Logbook entries and marks must exist to process PROMOTION.
1.4 Teacher Assignments
Teachers can belong to multiple sections and schools
Can teach multiple subjects
Permissions per tenant: must be explicitly granted
Cannot modify other teachers’ records
Must fill logbooks within 10 seconds per lesson
1.5 Logbook Rules (CBA/RLS)
Must record:
Module
Lesson title
Categories of actions
Expected outcomes
Essential knowledge / exercises / homework
Immutable after validation
Statuses:
PLANNED
TAUGHT
VALIDATED
INSPECTED
Auto-linked to timetable
Auto-suggest lesson based on class and schedule
1.6 Marks & Report Cards
Marks lifecycle:
Draft
Submitted
Approved
Published (locked)
Report cards generated per:
Sequence
Term
Annual
Bilingual schools: separate templates per section, combined for parents
1.7 Promotion Logic
Promotion Criteria:
Subject averages
Coefficients
Attendance
Discipline

Algorithm:

if average >= pass_mark AND attendance >= required_days AND no major infractions:
    PROMOTED
else if repeated_failure:
    REPEATING
else:
    ADMIN_REVIEW
Locked report cards are required before promotion
2. FINANCIAL RULES
2.1 Fee Structures
School pays: 3,000 XAF per student/year
Parent pays: 2,000 XAF per child/year
Fees tied to academic year and class
Payment statuses:
INVOICE_CREATED
PAYMENT_PENDING
PAYMENT_RECEIVED
BALANCE_UPDATED
Multiple children → aggregated parent invoices
System generates receipts automatically
2.2 Transaction Rules
Transactions immutable after payment validation
Refunds require admin approval
School and parent records separated logically per tenant
2.3 Financial Reporting
Dashboard shows:
Paid vs unpaid per class
Delayed payments
Annual revenue forecast
Reports exportable as:
PDF
CSV
XLSX
3. GOVERNMENT RULES
3.1 Access & Visibility
Cannot modify school data
Can:
View national/regional dashboards
Inspect logbooks
Audit financial records
Real-time analytics for:
Enrollment
Attendance
Academic performance
Financial health
3.2 Inspection Rules
Statuses:
PENDING
IN_PROGRESS
COMPLETED
Inspection reports immutable after submission
Alerts sent to admin for inspection actions
4. PARENT RULES
Parent may manage multiple children
Parent view must aggregate data across schools/sections
Can view:
Report cards
Attendance
Fee status
Cannot modify any academic or financial data
5. NOTIFICATION RULES
Event-driven notifications:
Fee due reminders
Report card published
Lesson or timetable changes
Channels:
SMS
Email
Push notification
Priority levels:
High: Payment issues, missing logbook
Medium: Lesson changes, school announcements
Low: Optional newsletters
6. SYSTEM CONSTRAINTS
Multi-tenant schema per school
Immutable academic and financial data
Event-driven microservices
All actions logged for audit (timestamp, user, tenant, action)
System must scale to all national schools with zero downtime
Offline caching supported for rural areas
7. INTEROPERABILITY
Metadata standardized using ISO/IEC 11179
Data exchange via:
XML / XML Schema
XMI for models
Cross-section integration prohibited (except for parent view)
8. EXECUTION REQUIREMENTS
No AI redesign cycles allowed
All workflows defined above are hard constraints
Antigravity must implement all rules before deployment
Versioning mandatory for all logbooks, marks, financials, and reports
