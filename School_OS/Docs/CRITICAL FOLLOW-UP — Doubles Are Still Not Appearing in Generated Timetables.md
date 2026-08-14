# CRITICAL FOLLOW-UP: DOUBLE ENGINE IS "FIXED" BUT GENERATED TIMETABLES STILL SHOW NO DOUBLES

The previous implementation report says the double-period engine is now a hard constraint and that 23/23 tests pass.

However, after generating an actual timetable in the application, I still see **no real double periods on the timetable grid**.

This means we should NOT consider the task complete.

The previous work appears to have fixed the **validation/model semantics**, but there is likely still a disconnect between:

```text
Subject weekly-period requirement
        ↓
Lesson/session generation
        ↓
Double-session metadata
        ↓
CP-SAT solver
        ↓
Materialised TimeSlots
        ↓
API serializer
        ↓
Frontend timetable grid
```

We need to debug the ENTIRE pipeline.

Do not simply add another validation rule.

Do not say "the solver supports doubles."

We need to prove that the application actually GENERATES and DISPLAYS them.

---

# 1. THE ACTUAL PROBLEM

The generated timetable still looks like:

```text
Monday
Mathematics
Tuesday
Mathematics
Wednesday
Mathematics
Thursday
Mathematics
```

or other isolated single periods.

I am not seeing:

```text
Monday

08:20–09:10    Mathematics
09:10–10:00    Mathematics
```

or an equivalent visual representation of a true double.

Therefore the problem may now be upstream or downstream of the CP-SAT constraint.

---

# 2. DO NOT ASSUME THE SOLVER IS RECEIVING DOUBLE LESSONS

The previous implementation says:

> "`_build_model` strict mode: an `is_double` lesson of n periods is decomposed into exactly n//2 double sessions."

This creates an important question:

## Where exactly does `is_double=True` come from?

Trace this from the original academic configuration.

For every subject/class combination, inspect:

```text
weekly periods
double-period requirement
single-period requirement
ClassSubject
Lesson
suggest_lessons_for()
materialisation
```

Determine whether the generated Lesson objects actually contain:

```text
is_double = True
```

when they are supposed to.

---

# 3. INSPECT THE DATABASE AFTER GENERATING A REAL TIMETABLE

Do not rely only on unit tests.

Generate a real timetable using the actual application's UI/data.

Then inspect the actual Lesson records and TimeSlot records.

For every subject requiring doubles, output something like:

```text
Subject: Mathematics
Class: Form 4B
Required weekly periods: 4
Required doubles: 2

Generated lessons:

Lesson #101
subject = Mathematics
is_double = ?
periods = ?
student_group = ?
teacher = ?

Lesson #102
subject = Mathematics
is_double = ?
periods = ?
student_group = ?
teacher = ?
```

Then show the materialised slots:

```text
Monday 08:20–09:10 Mathematics
Monday 09:10–10:00 Mathematics
```

etc.

We need actual evidence.

---

# 4. CHECK WHETHER THE DOUBLE REQUIREMENT EVEN EXISTS IN THE ACADEMIC DATA

This is extremely important.

The system may currently know:

```text
Mathematics = 4 periods/week
```

but NOT:

```text
Mathematics = 2 double sessions/week
```

If the academic configuration only stores:

```text
weekly_periods = 4
```

then the solver cannot magically know that the school wants:

```text
2 doubles
```

unless there is a defined rule that converts 4 periods into 2 doubles.

Do not invent a rule silently.

Determine exactly how the School OS currently represents:

```text
weekly periods
double sessions
single sessions
```

If there is no explicit double configuration, determine whether the intended Cameroon timetable rule is:

```text
2 periods/week → 1 double
3 periods/week → 1 double + 1 single
4 periods/week → 2 doubles
5 periods/week → 2 doubles + 1 single
6 periods/week → 3 doubles
```

If this is the intended default, implement it explicitly and document it.

But make sure the administrator can override the default where necessary.

---

# 5. VERIFY `suggest_lessons_for()`

The previous report says:

> "`suggest_lessons_for` splits odd hours into a double lesson + single lesson."

That is not enough.

Inspect the entire function.

For these examples:

```text
2 periods/week
3 periods/week
4 periods/week
5 periods/week
6 periods/week
```

show exactly what Lesson objects it creates.

Expected default decomposition should be:

```text
2:
    Double

3:
    Double + Single

4:
    Double + Double

5:
    Double + Double + Single

6:
    Double + Double + Double
```

If the system's configured interpretation is different, follow the explicit configuration.

But the generated lesson objects must make the distinction clear.

---

# 6. VERY IMPORTANT — DO NOT CONFUSE WEEKLY HOURS WITH SESSION LENGTH

The following are different:

```text
4 periods/week
```

and:

```text
one lesson lasting 4 periods
```

We need:

```text
4 periods/week
=
2 separate double sessions
```

not:

```text
one 4-period session
```

unless explicitly configured.

The system must distinguish:

```text
weekly_volume
```

from:

```text
session_length
```

and:

```text
number_of_double_sessions
```

---

# 7. VERIFY EVEN NUMBERS

There is a particularly important possible bug here.

The previous implementation mentions handling odd hours:

> "splits odd hours into a double lesson + single lesson"

But what happens for:

```text
4 periods/week
```

?

This is the most common case where I should visibly see:

```text
Double
+
Double
```

If the code only explicitly handles odd numbers and does not correctly create double sessions for even numbers, then this explains why the UI still shows singles.

Test:

```text
2 → 1 double
4 → 2 doubles
6 → 3 doubles
8 → 4 doubles
```

and inspect the actual generated Lesson records.

---

# 8. VERIFY THE SOLVER INPUT

Before calling CP-SAT, log/debug the exact scheduling units being sent into the model.

For example:

```text
Form 4B
Mathematics

Lesson 101:
    is_double = True
    session_length = 2

Lesson 102:
    is_double = True
    session_length = 2
```

The solver should then explicitly report:

```text
Double sessions requested: 2
Double sessions modelled: 2
```

If instead it receives:

```text
Lesson 101:
    is_double = False
    session_length = 1

Lesson 102:
    is_double = False
    session_length = 1

Lesson 103:
    is_double = False
    session_length = 1

Lesson 104:
    is_double = False
    session_length = 1
```

then the problem is NOT CP-SAT.

The problem is the lesson-generation layer.

---

# 9. VERIFY THE CP-SAT SOLUTION

After solving, output the actual selected double variables.

For every double session:

```text
Double #1
Class: Form 4B
Subject: Mathematics
Group: Full cohort
Day: Monday
Periods: 3,4
```

Then:

```text
Double #2
Class: Form 4B
Subject: Mathematics
Group: Full cohort
Day: Thursday
Periods: 5,6
```

We need to see actual solver decisions.

Do not merely report:

```text
solver = feasible
```

because feasibility does not prove that the desired double sessions were actually selected.

---

# 10. VERIFY MATERIALISATION

This is another likely failure point.

The solver may correctly select:

```text
Monday period 3
Monday period 4
```

but the materialisation layer may create two unrelated TimeSlots without preserving their session relationship.

Inspect:

```text
solve()
materialise()
TimeSlot creation
Lesson creation
```

Verify that the selected pair becomes:

```text
TimeSlot #1
Monday period 3
Mathematics

TimeSlot #2
Monday period 4
Mathematics
```

with both tied to the same double session/lesson.

---

# 11. DO NOT MERGE THE TWO CELLS IN THE DATABASE

A double should still occupy two normal timetable periods.

For example:

```text
Monday
08:20–09:10 Mathematics
09:10–10:00 Mathematics
```

should remain two TimeSlots because:

- teachers occupy both periods
- students occupy both periods
- rooms occupy both periods
- conflicts must be checked independently
- manual editing needs individual cells
- attendance/timetable references need individual periods

The system can associate them with:

```text
double_session_id
```

or equivalent metadata.

---

# 12. VERIFY THE FRONTEND

After proving that the database contains:

```text
Monday period 3 Mathematics
Monday period 4 Mathematics
```

inspect the API response.

Confirm the frontend receives both cells.

Then inspect:

```text
TimetableGridView.tsx
```

and determine whether the frontend:

1. receives both slots,
2. renders both slots,
3. accidentally filters one,
4. renders the second as an empty/continuation cell,
5. displays only one lesson per period,
6. or incorrectly groups/deduplicates them.

The frontend must NOT hide the second period.

---

# 13. CHECK FOR THIS SPECIFIC FRONTEND BUG

Search for code resembling:

```text
if (lessonAlreadyRendered)
    return null
```

or:

```text
group lessons by subject
```

or:

```text
deduplicate by lesson.id
```

or:

```text
only render first slot
```

A double consists of two timetable cells.

The UI must render both.

---

# 14. THE SCREENSHOT MUST BE USED AS A REGRESSION CASE

Use the current generated timetable as the failure case.

Take one subject that should have:

```text
4 periods/week
2 doubles
```

and trace it from:

```text
Academic configuration
→ ClassSubject
→ Lesson generation
→ solver input
→ CP-SAT solution
→ TimeSlot records
→ API
→ React state
→ TimetableGridView
```

At each stage record:

```text
required doubles
actual double sessions
```

The first stage where the number changes from:

```text
2
```

to:

```text
0
```

is the actual bug.

Fix THAT stage.

---

# 15. ADD A REAL END-TO-END TEST

The previous 23 tests are useful, but we need a test that exercises the same pipeline used by the actual UI.

Create:

```text
test_real_timetable_generation_materialises_doubles()
```

It must:

1. create a tenant/school
2. create academic year
3. create section
4. create class
5. create subject
6. configure 4 periods/week
7. configure 2 doubles
8. create teacher
9. create teaching assignment
10. create timetable grid
11. invoke the same generation path used by the frontend
12. run the real solver
13. materialise the result
14. retrieve TimeSlots
15. inspect the generated timetable

Assert:

```text
total Mathematics periods = 4
double sessions = 2
```

and:

```text
double #1:
same day
consecutive periods

double #2:
same day
consecutive periods
```

Then assert that they are non-overlapping.

---

# 16. TEST THE EXACT CASE THAT IS CURRENTLY FAILING

Use:

```text
Form 4B
Mathematics
4 periods/week
2 doubles
```

Generate the timetable exactly as the admin currently does.

Expected:

```text
MONDAY

08:20–09:10    Mathematics
09:10–10:00    Mathematics
```

and somewhere on another suitable day:

```text
THURSDAY

13:00–13:50    Mathematics
13:50–14:40    Mathematics
```

The exact days/times can differ.

The structure cannot.

---

# 17. IMPORTANT — DO NOT FORCE DOUBLES WHERE THE SCHOOL HAS NOT REQUESTED THEM

We need a proper distinction between:

```text
subject has 4 weekly periods
```

and:

```text
subject requires 2 doubles
```

If the school's default rule says that 4 periods normally means 2 doubles, encode that as a configurable/default scheduling policy.

But do not make every four weekly periods a double automatically if the school has configured singles instead.

The admin should ultimately be able to configure something like:

```text
Subject:
Mathematics

Periods/week:
4

Preferred structure:
[ 2 Doubles ]

or

[ 1 Double + 2 Singles ]

or

[ 4 Singles ]
```

The solver should follow the selected structure.

---

# 18. SECTION GENERATION MUST STILL WORK

Do not break the section-aware scheduling architecture.

Example:

```text
COMMERCIAL
Mathematics
Teacher A
Monday 09:10–10:50
DOUBLE

GRAMMAR
English
Teacher A
Monday 09:10–10:00
```

must be detected as a teacher clash.

When Commercial is already approved, the entire double consumes:

```text
Monday 09:10–10:00
Monday 10:00–10:50
```

for Teacher A.

When Grammar is generated later, those two slots must be unavailable to Teacher A.

This must work even if Grammar did not exist when Commercial was generated.

---

# 19. TBD / TEACHER X MUST STILL WORK

If no teacher has been assigned yet:

```text
Mathematics
Teacher = TBD
```

the solver may generate:

```text
Monday
Mathematics
TBD
Mathematics
TBD
```

as a double.

Later, if Teacher A is assigned:

```text
Teacher A
```

the system must check both periods of the double against:

- Teacher A availability
- Teacher A assignments in other sections
- Teacher A assignments in other classes
- Teacher A's other subjects

It must not only check the first half.

---

# 20. MANUAL EDITING MUST RECOGNIZE DOUBLE BLOCKS

Once real doubles are being generated, improve the editor.

If the administrator clicks or drags one half of:

```text
Mathematics
09:10–10:00
10:00–10:50
```

the system should recognize:

```text
This is part of a double session.
```

Provide:

```text
Move entire double
Move this period only
Cancel
```

If they choose "Move this period only", the timetable may remain editable, but immediately show:

```text
RED
DOUBLE INTEGRITY BROKEN
```

Approval must remain blocked.

---

# 21. RED VS YELLOW STATUS

Maintain the existing manual-editing behaviour.

### RED = hard conflict / invalid timetable

Examples:

```text
Teacher clash
Student group clash
Room clash
Double integrity broken
Blocked period
Outside timetable boundary
Required volume not satisfied
Cross-section conflict
```

### YELLOW = warning / availability issue

For example:

```text
Teacher is normally unavailable at this time
```

but the admin may still keep the slot if the system permits override.

Do not convert a hard double-integrity violation into yellow.

---

# 22. ADD DEBUG INFORMATION TO THE GENERATION RESULT

For development/debug mode, generation should return something similar to:

```text
TIMETABLE GENERATION SUMMARY

Form 4B

Mathematics
Required periods: 4
Required doubles: 2
Double sessions generated: 2
Single sessions generated: 0

Generated:
Monday P2–P3
Thursday P6–P7

Status:
✓ Valid
```

This will make future debugging dramatically easier.

---

# 23. DO NOT ACCEPT "23/23 TESTS PASS" AS PROOF

The previous response says:

> "23/23 OK"

That proves the isolated tests pass.

It does NOT prove that the actual production generation flow is creating doubles.

We need BOTH:

```text
UNIT/ENGINE TESTS
+
REAL END-TO-END APPLICATION TEST
```

The current UI result contradicts the claim that the feature is complete.

Treat the actual timetable output as the source of truth.

---

# 24. IMPORTANT DIAGNOSTIC QUESTION TO ANSWER IN CODE, NOT WITH A USER QUESTION

Before making any changes, answer these internally:

```text
Q1:
Does ClassSubject store the number of weekly periods?

Q2:
Where is the requested number of doubles stored?

Q3:
If doubles are not explicitly stored, what rule determines them?

Q4:
Does suggest_lessons_for() create is_double=True lessons for even hour counts?

Q5:
Does it create TWO double lessons for 4 periods?

Q6:
Does _build_model receive those lessons?

Q7:
Does CP-SAT select two consecutive pairs?

Q8:
Does materialisation preserve both periods?

Q9:
Does the API return both periods?

Q10:
Does TimetableGridView render both periods?
```

Do not ask me these questions.

Inspect the code and database and answer them yourself.

---

# 25. FINAL ACCEPTANCE TEST

Do not report this task complete until the application visibly generates something equivalent to:

```text
FORM 4B

                 MONDAY              TUESDAY       WEDNESDAY

08:20–09:10      Mathematics
09:10–10:00      Mathematics
                 ↑
                 REAL DOUBLE
```

and another double elsewhere in the week for a subject requiring two doubles.

Also verify:

```text
4 periods/week
2 doubles

=

2 actual consecutive same-day blocks
=
4 actual timetable cells
```

not:

```text
4 isolated cells
```

---

# FINAL INSTRUCTION TO THE AI

The previous implementation solved the **constraint definition** of doubles.

The current application output proves that something in the **generation/materialisation/rendering pipeline is still wrong**.

Do not rewrite the solver blindly.

Trace one real subject from configuration to screen.

Find the first point where:

```text
Required doubles = 2
```

becomes:

```text
Generated doubles = 0
```

and fix that layer.

Then run:

1. existing 23 regression tests
2. new end-to-end generation test
3. actual UI timetable generation
4. database inspection
5. API inspection
6. frontend rendering verification

Only after the actual UI visibly contains consecutive same-day double periods should this feature be marked COMPLETE.

The goal is not to have code that "supports doubles."

The goal is:

> **When a Cameroonian school generates a timetable requiring doubles, the actual generated timetable must contain real consecutive same-day double blocks.**