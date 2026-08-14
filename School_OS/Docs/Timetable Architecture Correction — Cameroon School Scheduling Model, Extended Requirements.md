# CRITICAL TIMETABLE ARCHITECTURE CORRECTION

The current timetable implementation needs to be reconsidered at the **algorithm/data-model level**, not merely at the UI level.

There are several fundamental requirements of a realistic Cameroonian school timetable that the current model does not appear to capture:

1. The timetable is fundamentally based on **periods required per subject per week**, not on "lessons" as the primary unit.
2. **Double periods** must be supported natively.
3. **Teacher availability** must be a hard scheduling constraint.
4. **School start/closing times and breaks** must define the available scheduling space.
5. **Half-school-day configurations** must be supported.
6. A class can be **split into subject streams/groups**, meaning multiple subjects can legitimately occur at the same time for different groups of students.
7. Therefore, **same-class simultaneous subjects are NOT automatically clashes**.
8. The algorithm must distinguish between a genuine conflict and an intentional parallel/streamed arrangement.
9. The scheduling algorithm needs to be designed as a serious constraint-satisfaction/optimization system, not as a simple lesson-placement algorithm.

Before implementing further UI work, determine whether the current problem is in the **data model, scheduling algorithm, validation logic, rendering layer, or a combination of these**.

---

# 1. THE CORE CONCEPT

This should NOT be treated primarily as a:

> "Lesson Booking System."

It should be treated as a:

> **School Period Allocation and Timetable Optimization System.**

The fundamental question is:

> **How do we distribute the required weekly periods of every subject across the available school periods while satisfying teachers, student groups, school hours, breaks, double-period rules, availability, and other constraints?**

The primary scheduling inputs are therefore:

- Classes/forms
- Student groups/streams
- Subjects
- Required periods per subject per week
- Subject teacher assignments
- Teacher availability
- Student-group availability
- School working days
- School start time
- School closing time
- Period duration
- Breaks
- Half-day configurations
- Double-period requirements/preferences
- Room availability
- Practical/laboratory requirements
- Parallel/stream arrangements
- Teacher workload
- Institutional constraints

"Lesson" should NOT be the abstraction around which the entire scheduling engine is built.

---

# 2. WEEKLY SUBJECT PERIODS ARE THE FOUNDATION

For example, a class might require:

```text
Mathematics            5 periods/week
English Language       4 periods/week
French Language        4 periods/week
Biology                3 periods/week
Geography              2 periods/week
Computer Science       2 periods/week
Commerce               2 periods/week
Citizenship Education  1 period/week
```

The scheduler's job is to distribute these required periods throughout the available timetable.

It should not simply create a list of "lessons" and attempt to place those lessons.

The fundamental requirement is:

```text
Subject
    ↓
Required periods per week
    ↓
Scheduling constraints
    ↓
Timetable periods
```

---

# 3. THE SCHOOL DAY DEFINES THE AVAILABLE PERIOD GRID

The school should configure its operating structure.

For example:

```text
School start:       07:30
School closing:     15:40
Period duration:    50 minutes
Working days:       Monday–Friday
```

The system should derive the timetable periods from these settings.

For example:

```text
07:30–08:20
08:20–09:10
09:10–10:00
10:00–10:50
10:50–11:40
...
```

The number and location of periods should NOT be hard-coded.

They are generated from:

```text
School hours
+
Period duration
+
Breaks
+
Special blocked periods
```

---

# 4. HALF-SCHOOL-DAY SUPPORT IS REQUIRED

The system must support schools/classes that do not operate a full school day.

A timetable configuration should be able to define different operating schedules.

For example:

```text
Full Day

07:30–15:40
```

or:

```text
Half Day

07:30–12:30
```

or potentially:

```text
Morning Session

07:30–11:40
```

The scheduler must understand that these are **different availability windows**, not simply a smaller number of lessons.

Half-day operation may apply to:

- The entire school
- Specific days
- Specific classes
- Specific forms
- Specific student groups

For example:

```text
Monday     Full Day
Tuesday    Full Day
Wednesday  Half Day
Thursday   Full Day
Friday     Half Day
```

The algorithm must be able to generate valid periods for each day independently.

---

# 5. BREAKS MUST BE FIRST-CLASS SCHEDULING CONSTRAINTS

Breaks should not simply appear as empty spaces in the UI.

They should exist in the scheduling model.

Example:

```text
07:30–08:20   Available
08:20–09:10   Available
09:10–10:00   Available
10:00–10:20   BREAK
10:20–11:10   Available
11:10–12:00   Available
12:00–13:00   LUNCH
13:00–13:50   Available
```

The algorithm must know that no subject can occupy a break or lunch period.

The same applies to:

- Assembly
- Chapel/religious activities where applicable
- School-wide activities
- Exams
- Staff meetings
- Other blocked periods

---

# 6. DOUBLE PERIODS MUST BE NATIVE TO THE ALGORITHM

Double periods are not two unrelated lessons.

They are two consecutive timetable periods assigned to the same subject/group.

For example:

```text
Monday

07:30–08:20   Mathematics
08:20–09:10   Mathematics
```

This represents:

```text
Mathematics
2 consecutive periods
```

The subject configuration should be able to express rules such as:

```text
Mathematics
5 periods/week
Preferred pattern: 2 + 2 + 1
```

or:

```text
Computer Science
2 periods/week
Preferred pattern: 2
```

or:

```text
English
4 periods/week
Preferred pattern: 1 + 1 + 1 + 1
```

The algorithm should decide how to distribute those periods while respecting school constraints.

---

# 7. CRITICAL: SAME CLASS DOES NOT ALWAYS MEAN SAME STUDENT GROUP

This is one of the most important requirements.

A traditional timetable algorithm may incorrectly assume:

> One class = one group of students.

That is not always true.

For example, in Form 4, students may be divided into subject groups/streams.

A Form 4 cohort could contain:

```text
Form 4
├── Arts Group
└── Science Group
```

Therefore, at the same time:

```text
Form 4 Arts       → History
Form 4 Science    → Chemistry
```

This is **NOT a clash**.

The students are different.

The subjects are different.

The teachers may be different.

The scheduling is intentional.

---

# 8. PARALLEL SUBJECTS MUST BE SUPPORTED

For example:

```text
Monday
09:10–10:00

Form 4 Arts       → History
Form 4 Science    → Chemistry
```

This should be completely valid if:

```text
History Teacher
    ≠
Chemistry Teacher
```

and:

```text
History Teacher → Available
Chemistry Teacher → Available
```

and the respective student groups are available.

The system should therefore not use:

```text
Class + Period
```

as the only uniqueness constraint.

It needs to use something closer to:

```text
Student Group + Period
```

for student conflict detection.

---

# 9. THE REAL CLASH RULE

The algorithm must distinguish between a **true clash** and a **valid parallel arrangement**.

A clash occurs when the same resource is required simultaneously.

For example:

```text
Form 4 Science
09:10–10:00
Chemistry

Form 4 Science
09:10–10:00
Biology
```

If the same students are required for both, this is a clash.

Likewise:

```text
Teacher A
09:10–10:00

Form 4 → Chemistry
Form 5 → Physics
```

is a clash if Teacher A is assigned to both.

But:

```text
Form 4 Arts → History → Teacher A
Form 4 Science → Chemistry → Teacher B
```

is NOT a clash.

This distinction is essential.

---

# 10. STUDENT GROUPS SHOULD BE EXPLICIT ENTITIES

The data model should support something like:

```text
Form 4
    ├── Full Cohort
    ├── Arts
    ├── Science
    ├── Commercial
    └── Other groups
```

The exact names should be configurable rather than hard-coded.

A subject allocation should therefore be associated with a **student group**, not necessarily just a Form.

Conceptually:

```text
Subject Allocation

Class/Form:
    Form 4

Student Group:
    Science

Subject:
    Chemistry

Teacher:
    Teacher B

Required periods:
    4/week
```

Another allocation:

```text
Class/Form:
    Form 4

Student Group:
    Arts

Subject:
    History

Teacher:
    Teacher A

Required periods:
    3/week
```

The scheduler can then place both simultaneously when appropriate.

---

# 11. FULL-COHORT SUBJECTS ARE DIFFERENT

Some subjects may apply to the entire class.

For example:

```text
Form 4
    ↓
English Language
```

All students attend.

Therefore, if English occupies:

```text
Monday 08:20–09:10
```

the entire Form 4 cohort is unavailable for another subject during that period.

But:

```text
Form 4 Arts → History
Form 4 Science → Chemistry
```

only consumes the respective groups.

The conflict engine therefore needs to understand **student-group coverage**.

---

# 12. STUDENT-GROUP CONFLICT MODEL

Do NOT simply implement:

```text
if classId + period already exists:
    CLASH
```

That would incorrectly reject valid parallel subjects.

Instead, the conflict engine needs to understand student membership.

Conceptually:

```text
Subject A
    ↓
Student Group A
    ↓
Period X

Subject B
    ↓
Student Group B
    ↓
Period X
```

If:

```text
Student Group A ∩ Student Group B = ∅
```

then there is no student conflict.

If:

```text
Student Group A ∩ Student Group B ≠ ∅
```

then there may be a conflict and the system must evaluate the overlap.

This is a much more powerful and correct model.

---

# 13. TEACHER CONFLICTS ARE DIFFERENT

Teacher availability must be evaluated independently.

Example:

```text
09:10–10:00

Form 4 Arts
History
Teacher A

Form 4 Science
Chemistry
Teacher B
```

Valid.

But:

```text
09:10–10:00

Form 4 Arts
History
Teacher A

Form 5
Geography
Teacher A
```

Invalid.

Therefore, conflict detection needs separate resource constraints:

```text
Student Group Conflict
Teacher Conflict
Room Conflict
Equipment Conflict
School Availability Conflict
```

---

# 14. ROOMS AND RESOURCES MUST ALSO BE MODELED

For practical subjects, the same principle applies to rooms/resources.

For example:

```text
Chemistry Laboratory
09:10–10:00
```

cannot simultaneously serve:

```text
Form 4 Science
Chemistry

Form 5 Science
Chemistry
```

if there is only one chemistry laboratory.

But if the school has:

```text
Chemistry Lab 1
Chemistry Lab 2
```

then both may be possible.

Therefore, resources should also be part of the constraint system.

---

# 15. THE ALGORITHM SHOULD NOT SIMPLY MINIMIZE "CLASHES"

This is important.

A high-quality scheduler should not define success as:

```text
clashes = 0
```

because that could produce a technically clash-free but terrible timetable.

For example:

```text
Mathematics
Mathematics
Mathematics
Mathematics
Mathematics
```

on one day might have zero clashes but be educationally poor.

The algorithm needs **hard constraints and soft constraints**.

---

# 16. HARD CONSTRAINTS

These should NEVER be violated.

Examples:

```text
1. A student group cannot attend two incompatible subjects simultaneously.

2. A teacher cannot teach two allocations simultaneously.

3. A teacher cannot be scheduled outside availability.

4. A student group cannot be scheduled outside its availability.

5. A subject must receive its required weekly period count.

6. A break cannot contain a subject.

7. A school-closed period cannot contain a subject.

8. A required double period must occupy consecutive valid periods.

9. A room/resource cannot be double-booked.

10. A half-day class cannot be scheduled beyond its closing time.

11. A full-cohort subject conflicts with any subject requiring the same students.

12. Parallel streamed subjects are permitted when their student groups do not overlap and all resources are available.
```

---

# 17. SOFT CONSTRAINTS

These should be optimized rather than treated as absolute rules.

Examples:

```text
1. Distribute subjects across the week.

2. Avoid excessive repetition of the same subject on one day.

3. Prefer configured double-period patterns.

4. Avoid excessive teacher idle gaps.

5. Avoid excessive student free periods.

6. Spread difficult subjects throughout the week.

7. Avoid placing every demanding subject early or late.

8. Respect teacher preferences where possible.

9. Keep practical subjects together where appropriate.

10. Avoid unnecessary gaps between double periods.

11. Balance the daily workload.

12. Avoid undesirable subject sequences.

13. Prefer stable schedules that require fewer last-minute adjustments.
```

---

# 18. THE ALGORITHM SHOULD SUPPORT DIFFERENT SCHOOL POLICIES

Do not hard-code assumptions about one school.

Schools should be able to configure rules such as:

```text
Period duration:
    40 / 45 / 50 / 60 minutes

Working days:
    Monday–Friday

Half-day:
    Enabled

Double periods:
    Allowed / Required / Preferred

Maximum consecutive periods:
    2 / 3 / configurable

Lunch:
    Configurable

Breaks:
    Configurable

Subject weekly periods:
    Configurable

Teacher availability:
    Configurable

Parallel streams:
    Enabled

Room requirements:
    Configurable
```

---

# 19. THE CORRECT MENTAL MODEL

The scheduling engine should conceptually work like this:

```text
                    SCHOOL CONFIGURATION
                            │
          ┌─────────────────┼──────────────────┐
          ↓                 ↓                  ↓
     Working Days      School Hours        Breaks
          │                 │                  │
          └─────────────────┼──────────────────┘
                            ↓
                    AVAILABLE PERIODS
                            │
                            ↓
                  CLASS / STUDENT GROUPS
                            │
                            ↓
                  SUBJECT REQUIREMENTS
                            │
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
         Weekly Periods   Teachers      Resources
              │          Availability   / Rooms
              │             │             │
              └─────────────┼─────────────┘
                            ↓
                    DOUBLE-PERIOD RULES
                            │
                            ↓
                    PARALLEL STREAMS
                            │
                            ↓
                 CONSTRAINT SATISFACTION
                            │
                            ↓
                    OPTIMIZATION ENGINE
                            │
                            ↓
                  CONFLICT VALIDATION
                            │
                            ↓
                    VALID TIMETABLE
                            │
                            ↓
                    VISUAL RENDERING
```

---

# 20. THE CURRENT UI PROBLEM MUST BE INVESTIGATED

The screenshot showing:

```text
07:30–08:20

Additional Mathematics
Citizenship Education
Commerce
English Language
Food and Nutrition
Human Biology
Mathematics
Religious Studies
```

inside one cell is not acceptable as a final timetable representation.

However, do NOT assume immediately that the scheduler is wrong.

Determine whether:

### Case A — Backend/algorithm problem

The scheduler actually assigned multiple incompatible subjects to the same student group and period.

If so, the algorithm is wrong.

### Case B — Data-model problem

The scheduler correctly understands parallel groups internally, but the model collapses them under the same `Form 1` identifier.

If so, the student-group model needs to be corrected.

### Case C — Rendering problem

The scheduler correctly generated separate group assignments, but the UI is aggregating them into one cell.

If so, the renderer needs to distinguish:

```text
Form 4 Arts
Form 4 Science
Form 4 Commercial
```

rather than simply rendering:

```text
Form 4
```

### Case D — Generation/status problem

The entries are actually unscheduled requirements being displayed inside the timetable grid.

If so, the UI must clearly distinguish:

```text
Scheduled
```

from:

```text
Unscheduled / Pending
```

Do not hide these entries to make the timetable look correct.

---

# 21. DO NOT BUILD THE ALGORITHM AROUND THE CURRENT UI

The timetable grid is a **view of the scheduling result**.

It should not dictate the scheduling architecture.

First create a correct scheduling model.

Then generate a valid schedule.

Then render it.

The order should be:

```text
DATA MODEL
    ↓
CONSTRAINT MODEL
    ↓
SCHEDULING ENGINE
    ↓
VALIDATION
    ↓
OPTIMIZATION
    ↓
TIMETABLE DATA
    ↓
UI RENDERER
```

Not:

```text
UI GRID
    ↓
Put subjects into cells
    ↓
Hope there are no clashes
```

---

# 22. THE ALGORITHM NEEDS TO BE "TOP NOTCH"

This is not a simple CRUD feature.

The timetable generator is one of the most algorithmically important components of the entire system.

A weak implementation will produce schedules that are technically valid but practically unusable.

The implementation should therefore be designed as a genuine **constraint satisfaction and optimization problem**.

The architecture should allow for:

```text
Hard constraints
+
Soft constraints
+
Weighted preferences
+
Parallel student groups
+
Teacher availability
+
Room/resource constraints
+
Double periods
+
Half days
+
Variable school schedules
+
Weekly subject requirements
```

The system should also be able to explain **why** a requested schedule cannot be generated.

For example:

> "Chemistry could not be placed for Form 4 Science because the only available Chemistry teacher is unavailable during the remaining four periods."

rather than simply:

> "Timetable generation failed."

---

# 23. FUTURE IMPLEMENTATION PLAN

Before writing the implementation plan, the architecture must first acknowledge these requirements.

The eventual implementation plan should cover, at minimum:

```text
Phase 1
Domain/Data Model

Phase 2
School Calendar & Period Engine

Phase 3
Subject Weekly Requirements

Phase 4
Teacher Availability

Phase 5
Student Groups / Streams

Phase 6
Double Period Engine

Phase 7
Parallel Subject Scheduling

Phase 8
Hard Constraint Engine

Phase 9
Soft Constraint / Optimization Engine

Phase 10
Timetable Generation

Phase 11
Validation & Conflict Explanation

Phase 12
Timetable Rendering

Phase 13
Regeneration / Manual Adjustment

Phase 14
Testing With Realistic Cameroonian School Scenarios
```

**Do not begin this implementation plan by coding the UI.**

First establish the scheduling domain model and constraint architecture.

---

# FINAL ARCHITECTURAL PRINCIPLE

The system must be built around this idea:

> **A school timetable is not a collection of lessons. It is an optimized allocation of finite school periods to subjects, student groups, teachers, rooms, and other resources under a set of hard and soft constraints.**

And critically:

> **Two subjects appearing at the same time under the same Form are not automatically a clash.**

If:

```text
Form 4 Arts → History → Teacher A
Form 4 Science → Chemistry → Teacher B
```

then they can legitimately run simultaneously because the student groups are different and the teachers are different and available.

The algorithm must understand the **actual students affected by each subject**, not merely the name of their Form.

That distinction is essential for producing a timetable that behaves like a real Cameroonian school timetable rather than a generic calendar or lesson-booking application.