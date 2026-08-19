# School OS Analytics Overhaul — Implementation Plan

## Executive Summary

The admin currently has **fragments**: mock data on the dashboard, partial analytics on one page, no visibility into teacher module compliance, no real attendance tracking UI, and no charts. This plan turns the platform into a **single pane of glass** — when a principal logs in, they see everything that matters, and they never have to hunt for information.

---

## Current State (What Exists Today)

| Domain | Status |
|--------|--------|
| **Dashboard** | Mock KPIs, no real data |
| **Academic Analytics** | 4-tab page with exam/subject/class performance — functional but no charts |
| **Curriculum Coverage** | School-wide table showing modules/lessons per class+subject, drill-down exists |
| **Mark Fill Status** | Tracks which teachers have/haven't submitted marks |
| **Attendance** | Stats endpoint exists, but `sessions_by_class` not returned; no teacher attendance UI; no per-student view |
| **Teacher Dashboard** | Real data, but curriculum/coverage only visible to the teacher |
| **Parent Portal** | Works for marks/attendance, but limited analytics |

---

## What We're Building (6 Phases)

### Phase 1: Admin Dashboard — Replace Mock Data with Real Analytics
**Goal:** When the admin opens `/admin/dashboard`, every number is real.

**Backend — New endpoint: `GET /reports/analytics/dashboard-overview/`**
```
Returns:
├── Students: total, new this month, by gender, by cycle
├── Teachers: total, active assignments, avg teaching load
├── Academics: current term, overall average, pass rate, best subject, worst subject
├── Attendance: rate this term, vs last term, at-risk count
├── Curriculum: overall coverage %, teachers with 0% coverage (the non-compliant ones)
├── Marks: fill rate for current sequence, who hasn't submitted
├── Fees: collection rate, outstanding amount
└── Alerts: [list of urgent items needing attention]
```

**Frontend — `DashboardHome.tsx` rewrite:**
- Real KPI cards pulling from the new endpoint
- "Attention Needed" alert panel (teachers who haven't submitted marks, teachers with 0% curriculum coverage, classes with no timetable)
- Mini sparkline charts for attendance trend (last 30 days)
- Quick-action cards linking to deep pages
- Real audit log from `audit` app

---

### Phase 2: Rich Analytics with Charts
**Goal:** Add Recharts library. Every analytics page gets proper visualizations.

**Install:** `recharts` (React charting library, 14KB gzipped)

#### 2A. Academic Analytics Enhancement (`AcademicAnalytics.tsx`)

| Visualization | Data Source | Type |
|---------------|-------------|------|
| **Grade distribution** | `exam_performance_overview` → `grade_distribution` | Bar chart (horizontal) |
| **Subject averages comparison** | `subject_performance_detail` → `subject_breakdown` | Grouped bar chart |
| **Class performance heatmap** | `class_performance_detail` → `class_subject_matrix` | Color-coded table |
| **Term-over-term trend** | New query across multiple terms | Line chart |
| **Pass rate by subject** | `exam_performance_overview` → `subject_breakdown` | Donut chart per subject |
| **Top 10 students leaderboard** | `subject_performance_detail` → `top_students` | Ranked table with sparklines |
| **Bottom 10 (at-risk)** | `subject_performance_detail` → `bottom_students` | Highlighted table with intervention flags |

#### 2B. New: `AttendanceAnalytics.tsx` page at `/admin/attendance/analytics`

| Visualization | Data Source | Type |
|---------------|-------------|------|
| **Daily attendance trend** | New: `GET /attendance/analytics/trend/?term=&days=30` | Line chart |
| **Attendance by class** | Fix existing: `sessions_by_class` | Horizontal bar chart |
| **Attendance by subject** | New aggregation | Grouped bar chart |
| **Chronic absenteeism list** | New: `GET /attendance/analytics/at-risk/` | Ranked table with absence % |
| **Teacher compliance** | New: `GET /attendance/analytics/teacher-compliance/` | Table: teacher → sessions logged, avg fill rate |
| **Late vs. absent breakdown** | `AttendanceRecord.status` | Stacked bar |

#### 2C. New: `CurriculumAnalytics.tsx` — Teacher Module Compliance Dashboard

**Backend — New endpoint: `GET /logbook/modules/teacher-compliance/`**
```
Returns per teacher:
├── teacher_id, teacher_name
├── assigned_classes (list)
├── assigned_subjects (list)
├── modules_created: count
├── total_modules_expected: count
├── lessons_completed: count
├── total_lessons: count
├── coverage_pct: float
├── last_activity_date: when they last touched curriculum
├── status: "compliant" | "needs_attention" | "non_compliant"
└── scheme_of_work_weeks_taught / total_weeks
```

**Frontend — Admin sidebar addition under Academic:**

The page has three views:

1. **Compliance Matrix** (main view)
   - Table: Teacher | Assigned Classes | Subjects | Modules Created | Coverage % | Last Active | Status
   - Color-coded: green (≥70%), amber (30-69%), red (<30% or 0 modules)
   - Filter: by class, by subject, by status
   - Sort: by coverage (ascending to find worst first)

2. **School Coverage Map**
   - Same as existing `CurriculumCoverage` but enhanced with:
   - Teacher name attached to each row
   - "N/A — No teacher assigned" flag
   - Sparkline showing coverage trend over time

3. **Non-Compliance Action Panel**
   - List of teachers with 0 modules or <20% coverage
   - "Send Reminder" button per teacher (calls `POST /notifications/send/` with a template)
   - "Send Reminder to All" bulk button
   - Timestamp of last reminder sent

---

### Phase 3: Teacher Compliance Tracking & Reminders
**Goal:** Admin knows exactly who's doing their job and who isn't.

#### 3A. Backend Model Changes

**`CurriculumModule` — add `created_by` field:**
```python
created_by = ForeignKey(Teacher, null=True, on_delete=SET_NULL)
```
Migration: `000X_add_created_by_to_curriculummodule.py`

**`CurriculumLesson` — add `completed_by` field:**
```python
completed_by = ForeignKey(User, null=True, on_delete=SET_NULL)
completed_at = DateTimeField(null=True)
```
Migration: `000X_add_completed_by_to_curriculumlesson.py`

**Update views:** Set `created_by` on module creation, set `completed_by`/`completed_at` on lesson toggle.

#### 3B. New Endpoint: `GET /reports/analytics/teacher-compliance-report/`

Aggregates across apps:
```
Per teacher:
├── Curriculum: modules created, lessons completed, coverage %
├── Logbook: entries signed this term, last sign date
├── Marks: fill rate per sequence, last submission date
├── Attendance: sessions created this term, avg records per session
├── Scheme of Work: weeks taught / total weeks
└── Overall compliance score: weighted composite (0-100)
```

#### 3C. Reminder System

**Backend — New endpoint: `POST /notifications/broadcast/`**
- Accepts: `recipient_ids`, `title`, `message`, `type` (mark_reminder, curriculum_reminder, general)
- Creates `Notification` records for each recipient
- Optional: email/SMS integration point (stub for now)

**Backend — New endpoint: `POST /reports/analytics/send-compliance-reminders/`**
- Takes a list of teacher IDs and a reminder type
- Auto-generates context-aware messages:
  - Marks: "You have not submitted marks for Sequence X. The deadline is [date]."
  - Curriculum: "Your curriculum coverage for [Subject] in [Class] is at X%. Please update your modules."
  - Logbook: "You haven't logged a lesson in [X] days."

**Frontend — Reminder UI on Compliance page:**
- "Send Reminder" button per teacher row
- "Remind All Non-Compliant" bulk button
- Confirmation modal with preview of message
- Toast on success

---

### Phase 4: Student Analytics Deep Dive
**Goal:** Admin can drill into any student, any class, any subject.

#### 4A. New: `StudentAnalytics.tsx` at `/admin/academic/students`

**Backend — New endpoints:**
- `GET /reports/analytics/student-detail/?student_id=` — Full student profile:
  ```
  ├── Personal info, class, section
  ├── Term-by-term averages (line chart data)
  ├── Per-subject performance (bar chart data)
  ├── Attendance summary (present/absent/late/excused counts)
  ├── Rank history across terms
  ├── Grade distribution of their scores
  └── At-risk flags (declining trend, low attendance, near-fail)
  ```
- `GET /reports/analytics/at-risk-students/` — Students matching risk criteria:
  ```
  ├── Average < pass mark + 10%
  ├── Attendance < 75%
  ├── Declining trend across 2+ sequences
  └── 0 marks submitted for any subject
  ```

**Frontend:**
- Searchable student directory
- Click any student → full analytics profile
- Class overview: all students ranked with sparklines
- At-risk dashboard with intervention suggestions
- Export to PDF/CSV

#### 4B. Enhance Existing: `AcademicAnalytics.tsx`

Add a new **"Students" tab:**
- Top performers school-wide (not just per subject)
- Most improved students (biggest gain between sequences)
- At-risk students (auto-flagged)
- Gender-based performance comparison (if gender data exists)

---

### Phase 5: Subject & Lesson Analytics
**Goal:** Admin sees daily subject-level insights.

#### 5A. New: `SubjectAnalytics.tsx` at `/admin/academic/subject-analytics`

**Backend — New endpoint: `GET /reports/analytics/subject-deep/?subject_id=&term=`**

```
Returns:
├── Subject info (name, coefficient, teachers assigned)
├── Performance across classes (bar chart)
├── Daily/weekly score trend (line chart)
├── Top 5 students school-wide for this subject
├── Bottom 5 students
├── Grade distribution (histogram)
├── Comparison with other subjects (relative difficulty)
├── Teacher effectiveness comparison (same subject, different teachers → different averages)
├── Attendance correlation (do students who attend more score higher?)
└── Curriculum coverage for this subject (which classes are behind)
```

#### 5B. Enhance: Teacher Performance View

**Backend — Enhance `GET /reports/analytics/teacher-summary/`:**
```
Add:
├── Student outcomes by teacher (avg score in their classes vs school avg)
├── Curriculum compliance score
├── Logbook activity (entries per week)
├── Attendance logging compliance
└── Mark submission timeliness
```

**Frontend — Teacher Performance comparison table:**
- Side-by-side comparison of teachers teaching the same subject
- Normalized by student intake (controls for easy/hard classes)

---

### Phase 6: Real-Time Alerts & Notifications
**Goal:** Admin doesn't have to check — the system tells them.

#### 6A. Alert Rules Engine

**Backend — New model: `AlertRule`**
```python
class AlertRule(Model):
    tenant = FK(Tenant)
    name = CharField()
    metric = CharField()          # "mark_fill_rate", "curriculum_coverage", "attendance_rate"
    threshold = FloatField()      # e.g., 50.0
    operator = CharField()        # "lt", "gt", "eq"
    notify_roles = JSONField()    # ["admin", "principal"]
    is_active = BooleanField()
    last_triggered = DateTimeField(null=True)
```

**Backend — New management command: `check_alerts`** (runs via cron/Celery beat):
- Evaluates each active rule against current data
- If threshold breached → creates `Notification` + optionally sends email
- Rate-limits: max 1 alert per rule per day

#### 6B. Dashboard Alert Panel

On the admin dashboard, a persistent "Alerts" section:
- Mark submission deadline approaching (2 days left, 3 teachers haven't submitted)
- Curriculum coverage below threshold for X classes
- Attendance drop detected (today vs 7-day average)
- New students not assigned to classes
- Timetable not yet published for next term

---

## Backend Model Changes Summary

| Model | Change | Migration |
|-------|--------|-----------|
| `CurriculumModule` | Add `created_by` FK → Teacher | `00XX` |
| `CurriculumLesson` | Add `completed_by` FK → User, `completed_at` DateTimeField | `00XX` |
| `AlertRule` | New model | `00XX` |
| `AttendanceSession` | Add `end_time` TimeField (nullable) | `00XX` |

---

## New API Endpoints Summary

| Endpoint | Method | Phase | Purpose |
|----------|--------|-------|---------|
| `/reports/analytics/dashboard-overview/` | GET | 1 | Admin dashboard real data |
| `/logbook/modules/teacher-compliance/` | GET | 2 | Per-teacher module compliance |
| `/attendance/analytics/trend/` | GET | 2 | Attendance trend data |
| `/attendance/analytics/at-risk/` | GET | 2 | Chronically absent students |
| `/attendance/analytics/teacher-compliance/` | GET | 2 | Teacher attendance logging compliance |
| `/reports/analytics/teacher-compliance-report/` | GET | 3 | Cross-app teacher compliance |
| `/notifications/broadcast/` | POST | 3 | Send reminders to teachers |
| `/reports/analytics/send-compliance-reminders/` | POST | 3 | Auto-generate & send reminders |
| `/reports/analytics/student-detail/` | GET | 4 | Deep student analytics |
| `/reports/analytics/at-risk-students/` | GET | 4 | At-risk student identification |
| `/reports/analytics/subject-deep/` | GET | 5 | Deep subject analytics |
| `/attendance/sessions/dashboard-stats/` | PATCH | Fix | Return `sessions_by_class` |
| `/reports/analytics/school-overview-trend/` | GET | 2 | Multi-term trend data |

---

## New Frontend Pages Summary

| Page | Route | Phase |
|------|-------|-------|
| Rewrite `DashboardHome.tsx` | `/admin/dashboard` | 1 |
| `CurriculumAnalytics.tsx` | `/admin/academic/teacher-compliance` | 2 |
| `AttendanceAnalytics.tsx` | `/admin/attendance/analytics` | 2 |
| Enhance `AcademicAnalytics.tsx` | `/admin/academic/analytics` | 2, 4 |
| `StudentAnalytics.tsx` | `/admin/academic/students` | 4 |
| `SubjectAnalytics.tsx` | `/admin/academic/subject-analytics` | 5 |

---

## Implementation Order & Effort Estimate

| Phase | Scope | Effort | Dependencies |
|-------|-------|--------|-------------|
| **Phase 3A** | Model changes (`created_by`, `completed_by`) | Small | None |
| **Phase 1** | Dashboard real data | Medium | None |
| **Phase 2A** | Recharts + Academic charts | Medium | Recharts install |
| **Phase 2B** | Attendance analytics | Medium | Fix `sessions_by_class` |
| **Phase 2C/3B** | Curriculum compliance + teacher compliance report | Large | 3A |
| **Phase 3C** | Reminder system | Medium | 3B + notifications app |
| **Phase 4A** | Student analytics deep dive | Large | None |
| **Phase 4B** | Student tab on academic analytics | Medium | 4A |
| **Phase 5** | Subject/lesson deep analytics | Large | None |
| **Phase 6** | Alerts engine | Large | 3B (compliance data) |

**Recommended build order:** 3A → 1 → 2A → 2B → 2C/3B → 3C → 4A → 4B → 5 → 6

This front-loads the model change (small) so everything downstream can reference `created_by`/`completed_by`, then the dashboard (high visibility), then charts, then compliance, then deep analytics, then alerts.

---

## What the Admin Sees When It's Done

**Opening the dashboard:**
- Real KPIs: student count, teacher count, attendance rate, academic average, fee collection
- "Needs Attention" panel: 3 teachers haven't submitted marks, 2 classes at 0% curriculum coverage, attendance dropped below 80% yesterday
- Mini charts: attendance trend, academic performance trend

**Going to Academic → Analytics:**
- Charts everywhere: grade distribution bars, subject comparison, class heatmap
- Term-over-term trend lines
- Click any subject → deep dive with teacher effectiveness comparison
- Click any class → student rankings with sparklines
- At-risk students flagged with intervention suggestions

**Going to Academic → Teacher Compliance:**
- Matrix of every teacher: modules created, coverage %, last active, status
- Red/amber/green color coding
- "Remind All" button sends personalized reminders
- Filter: "Show me all teachers below 50% coverage"

**Going to Attendance → Analytics:**
- Daily trend line chart
- Attendance by class bar chart
- At-risk students list with absence percentages
- Teacher compliance: who logs attendance, who doesn't

**Going to Academic → Students:**
- Search any student → full profile with charts
- Class overview with rankings
- At-risk dashboard

The admin never has to ask "what's going on?" — the system tells them.
