# CRITICAL TIMETABLE ENGINE FIX
## DOUBLE PERIODS ARE CONSECUTIVE SAME-DAY BLOCKS — NOT TWO RANDOM WEEKLY PERIODS

The current timetable generation has a serious scheduling-logic problem with double periods.

Inspect the current timetable solver, validation logic, lesson model, and frontend rendering before making changes.

Do NOT assume this is only a frontend display problem.

The screenshot demonstrates that the current engine can distribute periods that are supposed to form a double across different days. That is incorrect for a Cameroonian school timetable.

---

# 1. FUNDAMENTAL DEFINITION

A **double period is NOT simply two periods of the same subject during the week.**

A double period is:

> Two consecutive timetable periods belonging to the same subject, same class/student group, same day, and same teaching allocation/session.

Example:

```text
MONDAY

08:20–09:10    Mathematics
09:10–10:00    Mathematics
```

This is ONE double-period session.

These are NOT a double:

```text
MONDAY
08:20–09:10    Mathematics

TUESDAY
08:20–09:10    Mathematics
```

They are two single periods on different days.

---

# 2. THE CURRENT BUG

The current algorithm appears to be satisfying the required number of subject periods without sufficiently enforcing the required grouping of those periods into consecutive blocks.

For example, if Mathematics requires:

```text
4 periods/week
2 double periods/week
```

the solver must produce something like:

```text
MONDAY
08:20–09:10    Mathematics
09:10–10:00    Mathematics

THURSDAY
10:00–10:50    Mathematics
10:50–11:40    Mathematics
```

This represents:

```text
Double #1 = Monday
Double #2 = Thursday
Total = 4 periods
```

It must NOT produce:

```text
MONDAY
08:20–09:10    Mathematics

TUESDAY
08:20–09:10    Mathematics

WEDNESDAY
10:00–10:50    Mathematics

FRIDAY
10:00–10:50    Mathematics
```

That is four single periods, NOT two doubles.

---

# 3. DOUBLE PERIOD MUST BE A FIRST-CLASS SCHEDULING CONCEPT

Do not implement doubles merely as a soft preference.

The solver must understand the structure:

```text
Subject requirement
        ↓
Weekly period volume
        ↓
Single sessions + Double sessions
        ↓
Concrete timetable slots
```

For example:

```text
Mathematics
Total = 6 periods
Doubles = 2
Singles = 2
```

means:

```text
Double 1 = 2 consecutive periods
Double 2 = 2 consecutive periods
Single 1 = 1 period
Single 2 = 1 period

Total = 6 periods
```

---

# 4. EXPLICIT DOUBLE SESSION MODEL

Internally, think of a double as a scheduling block.

Conceptually:

```text
DoubleSession
    subject
    class
    student_group
    teacher allocation
    day
    start_period
    end_period
```

For a normal two-period double:

```text
day = Monday
start_period = 3
end_period = 5
```

meaning:

```text
period 3 + period 4
```

Do not necessarily create a new database model if the existing architecture can represent this correctly.

However, the solver must have this concept explicitly even if it is represented through existing Lesson/TimeSlot structures.

---

# 5. CP-SAT CONSTRAINT

The OR-Tools CP-SAT solver must explicitly enforce adjacency.

For every possible double start position:

```text
x[subject, class, group, day, period]
AND
x[subject, class, group, day, period + 1]
```

must both be selected.

A double can only exist when:

```text
same day
same class
same student group
same subject
consecutive periods
```

Therefore:

```text
x[d,p] = 1
x[d,p+1] = 1
```

constitutes a double block.

But:

```text
x[Monday,p] = 1
x[Tuesday,p] = 1
```

can NEVER constitute a double.

---

# 6. DO NOT COUNT TWO PERIODS AS A DOUBLE JUST BECAUSE THEY HAVE THE SAME SUBJECT

This is the critical correction.

Wrong logic:

```text
if subject has two periods:
    count as double
```

Correct logic:

```text
if subject occupies
the same class/group
on the same day
in consecutive periods:
    count as one double block
```

The double count must therefore be calculated from **adjacent same-day occupancy**, not total weekly subject volume.

---

# 7. EXACT DOUBLE REQUIREMENT

If the academic configuration says:

```text
Mathematics
6 periods/week
2 doubles
```

the solver should enforce:

```text
exactly 2 double blocks
```

and:

```text
exactly 6 total occupied periods
```

This naturally means:

```text
2 doubles × 2 periods = 4
remaining = 2 singles
```

unless the school's configuration defines a different interpretation.

Do not silently reinterpret the requirement.

---

# 8. IF THE CONFIGURATION SAYS "DOUBLE PERIODS"

Determine exactly how the existing academic data represents:

- required weekly periods
- double periods
- single periods
- consecutive periods
- lesson volume

Do not create a second competing definition.

Find the existing field/model/configuration responsible for double periods and make the solver correctly interpret it.

If the current system does not distinguish:

```text
weekly periods
```

from:

```text
number of double sessions
```

then fix the data representation as part of this implementation.

---

# 9. EXAMPLES THE SOLVER MUST PASS

## Example A — One Double

Requirement:

```text
Chemistry
3 periods/week
1 double
```

Valid:

```text
MONDAY
09:10–10:00    Chemistry
10:00–10:50    Chemistry

THURSDAY
13:00–13:50    Chemistry
```

Invalid:

```text
MONDAY
09:10–10:00    Chemistry

TUESDAY
09:10–10:00    Chemistry

THURSDAY
13:00–13:50    Chemistry
```

because there is no consecutive pair.

---

# 10. EXAMPLE B — TWO DOUBLES

Requirement:

```text
Physics
4 periods/week
2 doubles
```

Valid:

```text
TUESDAY
08:20–09:10    Physics
09:10–10:00    Physics

THURSDAY
13:00–13:50    Physics
13:50–14:40    Physics
```

Invalid:

```text
MONDAY
Physics

TUESDAY
Physics

WEDNESDAY
Physics

THURSDAY
Physics
```

---

# 11. EXAMPLE C — DOUBLE + SINGLES

Requirement:

```text
History
4 periods/week
1 double
```

Valid:

```text
MONDAY
10:00–10:50    History
10:50–11:40    History

WEDNESDAY
08:20–09:10    History

FRIDAY
13:00–13:50    History
```

The solver must understand:

```text
1 double = 2 periods
2 singles = 2 periods

Total = 4
```

---

# 12. DOUBLES MUST NOT CROSS BREAKS

This is extremely important for the Cameroonian timetable.

Suppose:

```text
10:00–10:50
10:50–11:40
BREAK
12:10–13:00
```

A double may be:

```text
10:00–10:50
10:50–11:40
```

but it must NOT be:

```text
10:50–11:40
BREAK
12:10–13:00
```

That is not a consecutive double.

The solver must use the actual period adjacency defined by the school's timetable grid.

A break separates scheduling periods.

---

# 13. DOUBLES MUST RESPECT HALF-DAYS

If Wednesday is a half-day:

```text
Wednesday:
07:30–08:20
08:20–09:10
09:10–10:00
10:00–10:50
```

then a double can only occur within the available Wednesday period sequence.

The solver must never create:

```text
Wednesday period 4
+
Wednesday period 5
```

if period 5 does not exist.

---

# 14. DOUBLES MUST RESPECT BLOCKED PERIODS

If:

```text
10:00–10:50 = BREAK
```

then:

```text
09:10–10:00
10:00–10:50
```

cannot form a double.

The blocked period breaks adjacency.

This must be enforced in the solver, not merely detected during validation.

---

# 15. DOUBLES MUST RESPECT TEACHER AVAILABILITY

A double requires the same teaching allocation to remain possible for both periods.

Example:

```text
Teacher A

Monday 09:10 → available
Monday 10:00 → unavailable
```

The solver must NOT schedule:

```text
09:10–10:00 Mathematics Teacher A
10:00–10:50 Mathematics Teacher A
```

as a double.

The entire block must be feasible.

---

# 16. DOUBLES MUST RESPECT CROSS-SECTION TEACHER OCCUPANCY

This must work with the section-based architecture already implemented.

Example:

```text
COMMERCIAL

Monday
09:10–10:00
10:00–10:50
Teacher A
Mathematics
```

This consumes Teacher A for the entire double.

When generating Grammar:

```text
GRAMMAR

Teacher A
Monday
09:10–10:00
```

must already be considered occupied.

And:

```text
Monday
10:00–10:50
```

must also be considered occupied.

The solver cannot use either half of the double for another section.

---

# 17. DOUBLES AND STUDENT GROUPS

The existing parallel-stream logic must remain intact.

For example:

```text
FORM 4

Arts
    History

Science
    Chemistry
```

can occur simultaneously if:

```text
Arts students → History
Science students → Chemistry
```

and the teachers are different and available.

A double must therefore be associated with the relevant:

```text
class
+
student group
+
subject
```

not merely the academic class.

---

# 18. FULL-COHORT DOUBLE

If a lesson is full-cohort:

```text
Form 4
Mathematics
Full cohort
```

then:

```text
Monday 09:10–10:00
Monday 10:00–10:50
```

must occupy all student groups for those periods.

The solver must not allow another stream subject to overlap with that full-cohort double.

---

# 19. DOUBLE BLOCKS MUST NOT OVERLAP THEMSELVES

A subject should not accidentally produce:

```text
Monday
08:20–09:10 Mathematics
09:10–10:00 Mathematics
10:00–10:50 Mathematics
```

and count this as:

```text
2 doubles
```

unless the school's configuration explicitly allows a triple-period block.

Normally:

```text
2 consecutive periods = 1 double
```

A three-period run should be handled according to the school's configured lesson structure rather than accidentally generating overlapping doubles:

```text
period 1 + period 2
period 2 + period 3
```

which would falsely count as two doubles.

---

# 20. PREVENT OVERLAPPING DOUBLE DETECTION

This is a critical implementation detail.

If:

```text
A A A
```

appears across three consecutive periods, the naive algorithm may detect:

```text
A A → double #1
A A → double #2
```

This is wrong if the school expects two-period blocks.

Instead, the solver should identify **non-overlapping sessions**.

For example:

```text
A A A
```

could be interpreted as:

```text
Double + Single
```

or:

```text
Single + Double
```

depending on the configured rules.

But it must NOT automatically become:

```text
2 doubles
```

because the two detected pairs overlap.

---

# 21. DOUBLES SHOULD BE SCHEDULED AS BLOCKS DURING GENERATION

Do not generate all individual subject periods first and then try to "join" some of them afterward.

That approach is what causes the current problem.

Prefer:

```text
Step 1
Determine required sessions.

Step 2
Create double blocks.

Step 3
Place double blocks into valid consecutive slots.

Step 4
Place remaining single periods.

Step 5
Validate the complete timetable.
```

Or represent equivalent logic directly inside CP-SAT.

The important point is:

> The solver must reason about doubles during scheduling, not repair them after scheduling.

---

# 22. DOUBLE PLACEMENT SHOULD BE OPTIMIZED

When multiple valid double locations exist, prefer placements that produce a good timetable.

Consider:

- teacher availability
- teacher workload
- existing section commitments
- student group conflicts
- room availability
- half-days
- blocked periods
- daily subject distribution
- maximum lessons per day
- avoiding unnecessary subject repetition
- spreading doubles across different days
- avoiding too many consecutive periods for the same class
- existing locked/approved lessons

Do not sacrifice hard constraints merely to create a double.

---

# 23. PREFER SEPARATE DAYS FOR SEPARATE DOUBLES

If a subject requires:

```text
2 doubles/week
```

prefer:

```text
Monday double
Thursday double
```

rather than:

```text
Monday double
Monday double
```

unless the school's configuration explicitly permits multiple double sessions of the same subject on one day.

The goal is a realistic school timetable, not merely mathematical feasibility.

---

# 24. DO NOT USE "CONT." AS A SUBSTITUTE FOR LOGIC

The frontend may display:

```text
↳ cont.
```

for the second half of a double.

That is fine visually.

But the backend must already know:

```text
these two periods belong to the same double session.
```

The UI should not be responsible for determining whether something is a double.

Backend data should provide enough information for the frontend to render:

```text
Double session
Part 1
Part 2
```

or equivalent.

---

# 25. VALIDATION MUST REPORT DOUBLE ERRORS EXPLICITLY

Add a dedicated validation category:

```text
double_integrity
```

Examples:

```text
DOUBLE_SPLIT_ACROSS_DAYS
DOUBLE_NOT_CONSECUTIVE
DOUBLE_CROSSES_BREAK
DOUBLE_CROSSES_BLOCKED_PERIOD
DOUBLE_CROSSES_HALF_DAY_BOUNDARY
DOUBLE_TEACHER_UNAVAILABLE
DOUBLE_TEACHER_CONFLICT
DOUBLE_STUDENT_GROUP_CONFLICT
DOUBLE_ROOM_CONFLICT
DOUBLE_COUNT_MISMATCH
OVERLAPPING_DOUBLE_BLOCKS
```

Do not hide these inside a generic volume mismatch.

---

# 26. VALIDATION EXAMPLE

If the requirement is:

```text
Mathematics
6 periods
2 doubles
```

and the timetable is:

```text
Monday      Mathematics
Tuesday     Mathematics
Wednesday   Mathematics
Thursday    Mathematics
Friday      Mathematics
Friday      Mathematics
```

the validator should say:

```text
INVALID

Required:
6 periods
2 double sessions

Found:
6 periods
1 double session

Problem:
4 periods are not organized into the required number of
non-overlapping consecutive double blocks.
```

---

# 27. FRONTEND MUST VISUALLY CONFIRM REAL DOUBLES

The timetable UI should render:

```text
Monday

08:20–09:10
Mathematics

09:10–10:00
↳ Mathematics
```

or visually merge the cells:

```text
┌──────────────────────┐
│ Mathematics           │
│ DOUBLE • 2 PERIODS    │
│ 08:20–10:00           │
└──────────────────────┘
```

But do not change the underlying grid representation merely to make it look merged.

The individual periods must remain available for:

- validation
- teacher occupancy
- drag/drop
- manual editing
- cross-section conflict detection
- attendance/timetable references

---

# 28. MANUAL EDITING OF DOUBLES

If an administrator drags one half of a double away:

```text
Monday
09:10 Mathematics
10:00 Mathematics
```

and moves the second half to:

```text
Tuesday
09:10 Mathematics
```

the system must immediately detect:

```text
YELLOW / RED depending on configuration

Double integrity broken.
The Mathematics double has been split.
```

The UI should make the consequence obvious.

Ideally the system should ask:

```text
Move entire double?
```

with options:

```text
Move entire double
Move only this period
Cancel
```

---

# 29. MANUAL EDITING MUST NEVER SILENTLY DESTROY DOUBLE INTEGRITY

Dragging individual cells must not cause the application to believe the timetable is still valid.

After every manual move:

```text
recalculate:
    teacher conflicts
    student conflicts
    room conflicts
    availability
    volume
    double integrity
    blocked periods
    half-day boundaries
    section-wide conflicts
```

The same validation engine should be used by:

```text
solver
+
manual editor
+
approval workflow
```

---

# 30. TEST THE ACTUAL BUG FIRST

Create a regression test specifically for the current failure.

Example:

```text
Subject:
Mathematics

Required:
4 periods/week

Required doubles:
2
```

Run the solver.

Assert:

```text
total periods == 4
double_blocks == 2
```

Then inspect every double:

```text
same day == true
period_2 == period_1 + 1
same class == true
same student group == true
same subject == true
```

---

# 31. ADD THESE REGRESSION TESTS

The timetable engine must have automated tests for:

```text
test_double_is_same_day

test_double_is_consecutive

test_double_cannot_cross_break

test_double_cannot_cross_blocked_period

test_double_cannot_cross_half_day_boundary

test_two_doubles_create_four_periods

test_double_count_is_not_weekly_occurrence_count

test_overlapping_pairs_are_not_two_doubles

test_double_respects_teacher_availability

test_double_respects_teacher_cross_section_occupancy

test_double_respects_student_group_constraints

test_full_cohort_double_blocks_all_groups

test_parallel_group_doubles_can_coexist

test_double_respects_room_occupancy

test_manual_move_breaks_double_integrity

test_manual_move_of_entire_double

test_double_validation_reports_exact_error

test_unassigned_teacher_double_can_be_generated

test_assigned_teacher_double_is_checked_schoolwide
```

---

# 32. DO NOT BREAK THE EXISTING SECTION ARCHITECTURE

The following functionality already exists and must remain intact:

- Section-based timetable generation
- School-wide teacher occupancy
- Incremental section generation
- Approved section resource locking
- Student groups/streams
- Parallel subjects
- Full-cohort lessons
- Half-day configurations
- Blocked periods
- Teacher availability
- Room validation
- Repair mode
- Manual timetable editing
- Red hard-conflict indicators
- Yellow availability warnings

Double-period logic must integrate with all of these.

Do not solve the double-period problem by creating a separate scheduler.

---

# 33. DO NOT PATCH ONLY THE FRONTEND

The screenshot makes the problem visible, but the correct fix must begin in the scheduling engine.

Inspect:

```text
apps/timetable/solver.py
apps/timetable/models.py
apps/timetable/section_tools.py
apps/timetable/serializers.py
apps/timetable/views.py
```

and the relevant frontend timetable components.

Find exactly where the existing double logic is implemented.

Determine whether the current implementation:

1. only counts weekly subject periods,
2. treats double requirements as a soft preference,
3. creates periods independently and attempts to pair them later,
4. incorrectly detects adjacent periods,
5. allows pairs across breaks,
6. allows pairs across different days,
7. counts overlapping pairs,
8. or has another structural issue.

Then fix the underlying model.

---

# 34. IMPORTANT: DO NOT HIDE INFEASIBILITY

If the school asks for:

```text
Mathematics
8 periods/week
4 doubles
```

but there are not enough valid consecutive slots because of:

- teacher availability
- section conflicts
- half-days
- breaks
- blocked periods
- other locked timetables

the solver must report infeasibility clearly.

Do NOT silently convert doubles into singles just to make the timetable generate.

For example:

```text
REQUESTED:
8 periods
4 doubles

GENERATED:
8 periods
2 doubles
4 singles
```

must NOT be reported as success.

It should say:

```text
INFEASIBLE UNDER CURRENT CONSTRAINTS

Required:
4 double sessions

Possible:
2 double sessions

Reason:
Teacher availability / occupied cross-section slots / etc.
```

The relaxation diagnostic should identify the actual bottleneck.

---

# 35. IMPORTANT DISTINCTION

The engine must distinguish:

```text
PERIOD
```

from:

```text
SESSION
```

A period is one grid slot:

```text
09:10–10:00
```

A session may occupy:

```text
one period
```

or:

```text
two consecutive periods
```

Therefore:

```text
1 single session = 1 period
1 double session = 2 periods
```

This distinction should drive the implementation.

---

# 36. FINAL SCHEDULING MODEL

The scheduler should conceptually operate like:

```text
SUBJECT REQUIREMENT

Example:
Mathematics
6 periods/week
2 doubles

        ↓

SESSION REQUIREMENT

Double Session 1 → 2 periods
Double Session 2 → 2 periods
Single Session 1 → 1 period
Single Session 2 → 1 period

        ↓

SCHEDULING

Find:
Day + consecutive period pair
for each double

        ↓

CHECK

Teacher
Student Group
Room
Section
Availability
Breaks
Half-days
Blocked periods
Existing approved sections

        ↓

PLACE

Double blocks first

        ↓

PLACE

Remaining singles

        ↓

VALIDATE

Total volume
+
Double integrity
+
All hard constraints
```

---

# 37. SUCCESS CRITERIA

This fix is complete only when the following is true:

### If a subject requires a double:

Its two periods are:

```text
same day
+
consecutive
+
same class/group
+
same subject
+
compatible teacher
+
compatible room
```

### If a subject requires two doubles:

There are:

```text
2 non-overlapping consecutive blocks
```

not merely four weekly occurrences.

### If a double cannot be placed:

The solver reports infeasibility instead of silently splitting it.

### If an administrator breaks a double manually:

The UI immediately detects and displays the violation.

### If a double teacher is shared with another section:

Both periods are reserved school-wide.

### If the teacher is unassigned:

The timetable can still be generated with:

```text
TBD / Teacher X
```

without creating a false teacher conflict.

---

# FINAL RULE

Treat this as a **constraint-model correction**, not a cosmetic fix.

The key rule is:

> **A double period is a single scheduling session occupying two consecutive periods on the same day.**

Two periods on different days are never a double.

Two non-consecutive periods are never a double.

Two periods separated by a break are never a double.

Two overlapping detected pairs are not automatically two doubles.

The solver must schedule double sessions as blocks and validate them as blocks.

Do not mark this task complete until the regression tests demonstrate that the generated timetable cannot split a required double across different days.