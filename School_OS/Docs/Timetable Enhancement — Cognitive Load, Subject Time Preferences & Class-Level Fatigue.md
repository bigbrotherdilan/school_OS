# TIMETABLE ENHANCEMENT — COGNITIVE LOAD, SUBJECT TIME PREFERENCES & CLASS-LEVEL FATIGUE

The double-period generation is now working correctly.

The next enhancement is to make the timetable more educationally intelligent.

We need the algorithm to understand that **not all subjects are equally suitable for every time of day**, while also understanding that these are generally **preferences/optimization goals, not absolute constraints**.

For example:

- Mathematics often benefits from earlier periods because it requires sustained concentration.
- Physics, Chemistry and some other cognitively demanding subjects may similarly benefit from earlier periods.
- Lower-level students become tired more quickly and therefore should receive stronger preference for demanding subjects earlier in the school day.
- Higher-level students can generally tolerate later cognitively demanding lessons better.
- However, higher-level students should NOT be prohibited from having Mathematics in the morning.
- Mathematics should NOT become "morning only."
- A feasible timetable with Mathematics in period 6 should still be possible if necessary.
- The solver should prefer better educational arrangements, but must never make the system unnecessarily infeasible.

This should become a proper **soft-constraint / weighted scheduling objective**.

---

# 1. DISTINGUISH HARD CONSTRAINTS FROM SOFT PREFERENCES

This is critical.

### HARD CONSTRAINTS

These must never be violated during automatic generation:

```text
Teacher cannot teach two classes at once
Student group cannot attend two subjects at once
Room cannot host two classes at once
Lesson weekly volume must be satisfied
Required doubles must remain consecutive and same-day
Teacher unavailability
Blocked periods
Half-day boundaries
Section occupancy
Cross-section teacher conflicts
Approved timetable occupancy
Student-group conflicts
```

### SOFT CONSTRAINTS

These should influence which feasible timetable is preferred:

```text
Mathematics earlier in the day
Physics earlier in the day
Chemistry earlier in the day
Languages at suitable periods
Creative/practical subjects later where appropriate
Lower classes getting demanding subjects earlier
Avoiding too many cognitively demanding periods late in the day
Avoiding excessive concentration-heavy subjects consecutively where possible
Teacher preferences
```

The solver must ALWAYS satisfy hard constraints before optimizing soft preferences.

---

# 2. ADD SUBJECT TIME PREFERENCE PROFILES

The system should not hard-code "Mathematics = morning."

Instead, introduce configurable subject scheduling preferences.

For example:

```text
Subject:
Mathematics

Cognitive demand:
HIGH

Preferred time:
EARLY_DAY

Morning preference:
90

Afternoon preference:
40

Late-day penalty:
80
```

Another subject could be:

```text
Subject:
History

Cognitive demand:
MEDIUM

Preferred time:
FLEXIBLE

Morning preference:
50

Afternoon preference:
50
```

Another:

```text
Subject:
Physical Education

Cognitive demand:
LOW

Preferred time:
LATE_DAY_ALLOWED

Morning preference:
30

Afternoon preference:
80
```

These should be configurable by the administrator.

---

# 3. DO NOT OVERENGINEER THE UI INITIALLY

The backend/model should support the concept properly first.

The minimum useful configuration could be:

```text
Subject scheduling profile

Cognitive demand:
[ Low / Medium / High ]

Preferred period:
[ Early / Midday / Late / Flexible ]

Morning preference:
0–100

Late-day penalty:
0–100
```

Or a simpler initial implementation:

```text
Time-of-day preference:
[ Strong Morning / Morning / Neutral / Afternoon / Strong Afternoon ]
```

Internally translate this into solver weights.

---

# 4. CLASS-LEVEL / AGE-LEVEL FATIGUE PROFILE

The key requirement is that the same subject preference should behave differently for younger and older classes.

For example:

```text
Form 1
fatigue sensitivity = HIGH

Form 2
fatigue sensitivity = HIGH

Form 3
fatigue sensitivity = MEDIUM-HIGH

Form 4
fatigue sensitivity = MEDIUM

Form 5
fatigue sensitivity = MEDIUM

Lower Sixth
fatigue sensitivity = LOW-MEDIUM

Upper Sixth
fatigue sensitivity = LOW
```

Do NOT hard-code these exact values without checking the existing class/level structure in School OS.

Use the application's existing academic class/level representation.

If the system already knows:

```text
Class level
Form
Grade
Cycle
```

derive the fatigue profile from that.

If it does not, introduce a configurable class scheduling profile.

---

# 5. THINK OF THIS AS COGNITIVE LOAD

The algorithm should ultimately reason approximately like this:

```text
Student class
        +
Subject cognitive demand
        +
Time of day
        +
Period number
        =
Scheduling cost
```

For example:

### Form 1 Mathematics

```text
07:30 → very good
08:20 → very good
09:10 → good
10:50 → acceptable
13:00 → undesirable
13:50 → strongly undesirable
14:50 → very undesirable
```

### Lower Sixth Mathematics

```text
07:30 → very good
08:20 → very good
09:10 → very good
10:50 → good
13:00 → acceptable
13:50 → acceptable
14:50 → slightly undesirable
```

The later periods are NOT prohibited.

They simply carry a higher scheduling penalty.

---

# 6. USE PERIOD POSITION, NOT CLOCK TIME ONLY

The algorithm should preferably use the actual timetable grid.

For example:

```text
day
period_index
start_time
end_time
```

rather than assuming that:

```text
08:00 = morning
13:00 = afternoon
```

because schools may configure:

- different opening times
- different closing times
- half-days
- different numbers of periods
- different period lengths
- Friday schedules
- special school schedules

The engine already has:

```text
day_periods
blocked_slots
period configuration
```

Use those.

---

# 7. DEFINE TIME-OF-DAY BUCKETS DYNAMICALLY

Instead of hard-coding:

```text
period 1–3 = morning
period 4–5 = midday
period 6–9 = afternoon
```

calculate the relative position within that day's available teaching periods.

For example:

```text
relative_position = 
    index_of_period / number_of_available_periods_that_day
```

Then classify approximately:

```text
0.00–0.30 = early
0.30–0.60 = middle
0.60–1.00 = late
```

This must work with half-days.

For example, if Wednesday only has four teaching periods:

```text
Wednesday:
P1
P2
P3
P4
```

then P4 is still the late part of Wednesday even though it might be 11:00.

---

# 8. DOUBLE PERIODS MUST BE SCORED AS A UNIT

This is very important given the recent double-period implementation.

If Mathematics has:

```text
DOUBLE
```

the algorithm should score the entire double session.

For example:

```text
Mathematics
Monday P2 + P3
```

should have a combined cognitive-time score based on both periods.

Do NOT score only the first half.

For example:

```text
P2 = excellent
P3 = good
```

means the double should receive a combined score reflecting:

```text
excellent + good
```

Similarly:

```text
P7 + P8
```

should receive a much worse score.

This prevents the solver from placing a cognitively demanding double late simply because the first period barely falls into an acceptable bucket.

---

# 9. PREFERRED DOES NOT MEAN REQUIRED

This distinction is fundamental.

If Mathematics has:

```text
strong morning preference
```

the solver should try:

```text
morning
```

first.

But if teacher availability, section occupancy, doubles, groups, rooms, or other constraints make that impossible, it should still allow:

```text
afternoon Mathematics
```

with a penalty.

Example objective:

```text
Hard constraints:
MUST satisfy

Soft objective:
minimize scheduling penalty
```

Therefore:

```text
Morning Mathematics = cost 0

Midday Mathematics = cost 10

Afternoon Mathematics = cost 30

Late Mathematics = cost 60
```

The exact numbers should be configurable/calibrated rather than arbitrary.

---

# 10. CLASS FATIGUE SHOULD MULTIPLY THE SUBJECT PENALTY

This is where the algorithm becomes genuinely intelligent.

For example:

```text
Mathematics
cognitive demand = HIGH
```

and:

```text
Form 1
fatigue sensitivity = HIGH
```

could produce:

```text
late Mathematics penalty = 80
```

while:

```text
Lower Sixth
fatigue sensitivity = LOW
```

could produce:

```text
late Mathematics penalty = 30
```

The same subject therefore behaves differently for different classes.

Conceptually:

```text
scheduling_cost =
    subject_time_penalty
    × class_fatigue_weight
```

Use sensible normalization so that this does not overwhelm the hard constraint model or create numerical problems.

---

# 11. ADD A "COGNITIVE LOAD" FIELD TO SUBJECTS

If the existing Subject model can safely be extended, consider:

```text
cognitive_load
```

with:

```text
LOW
MEDIUM
HIGH
```

or numeric:

```text
0–100
```

A numeric value may eventually be more flexible.

For example:

```text
Mathematics = 90
Physics = 90
Chemistry = 85
English = 70
History = 65
Geography = 60
ICT = 55
Physical Education = 20
```

BUT:

Do not hard-code these examples as universal educational truths.

The administrator should be able to modify them.

The system should provide sensible defaults only.

---

# 12. SUBJECT PREFERENCE SHOULD BE SCHOOL-CONFIGURABLE

Different schools may have different philosophies.

One school may want:

```text
Mathematics → morning
French → morning
English → morning
```

Another may prefer:

```text
Mathematics → morning
Physical Education → afternoon
```

Another may have special Saturday arrangements.

Therefore this should be part of the school's timetable configuration rather than a fixed global rule.

---

# 13. SUPPORT "PREFERRED", "NEUTRAL", AND "AVOID IF POSSIBLE"

A useful model is:

```text
Preferred
Neutral
Avoid if possible
```

Example:

```text
Mathematics:
Preferred = early
Neutral = middle
Avoid if possible = late
```

This maps naturally into a weighted objective.

---

# 14. DO NOT CREATE A MASSIVE SINGLE OBJECTIVE

The solver already has many scheduling objectives.

Do not simply add an enormous coefficient like:

```text
MATHEMATICS_MORNING = 100000
```

because this can effectively turn a preference into a hidden hard constraint.

Instead use a clear hierarchy/weighted objective:

### Priority 1
Hard feasibility.

### Priority 2
Required doubles and weekly volume.

### Priority 3
Approved cross-section occupancy.

### Priority 4
Teacher/student/room quality.

### Priority 5
Pedagogical time preferences.

Within pedagogical preferences:

```text
class fatigue
+
subject cognitive demand
+
preferred time of day
```

---

# 15. AVOID TOO MANY HIGH-LOAD SUBJECTS LATE IN THE DAY

This can be a second-stage optimization.

For example, avoid:

```text
Form 1

P6 Mathematics
P7 Physics
P8 Chemistry
```

if alternatives exist.

Instead prefer something like:

```text
P6 Mathematics
P7 Art
P8 Physical Education
```

or other suitable lower-load subjects.

But this must remain a soft objective.

Do not make it impossible to schedule consecutive demanding subjects when the school configuration requires it.

---

# 16. AVOID CONSECUTIVE HIGH-LOAD SUBJECTS FOR YOUNGER CLASSES

Another useful soft penalty:

```text
HIGH cognitive load
+
HIGH cognitive load
```

in consecutive periods for younger classes.

For example:

```text
Form 1

Mathematics
Physics
```

could carry a penalty.

But:

```text
Form 1

Mathematics
History
```

may have a smaller penalty.

Again:

This is NOT a hard clash.

It is a timetable-quality optimization.

---

# 17. DO NOT OVERFIT TO MATHEMATICS

The architecture must support any subject.

The system should not contain logic like:

```text
if subject.name == "Mathematics":
```

Instead:

```text
subject.cognitive_load
subject.time_preference
subject.late_day_penalty
```

This means the same engine works for:

```text
Mathematics
Physics
Chemistry
Biology
English
French
History
Geography
Computer Science
Accounting
Economics
Technical subjects
Commercial subjects
```

and future subjects.

---

# 18. SECTION-AWARE OPTIMIZATION

This must work with the section architecture already implemented.

For example:

```text
Grammar
Form 4
Mathematics
```

and:

```text
Commercial
Form 4
Mathematics
```

may have different teachers and different available slots.

The algorithm must optimize each class/section's timetable while respecting the GLOBAL teacher schedule.

If Teacher A teaches:

```text
Grammar Form 4 Mathematics
```

at:

```text
Monday P2–P3
```

then:

```text
Commercial Form 5
Teacher A
```

cannot use those periods.

This remains a HARD constraint.

The cognitive-load preference must NEVER override that.

---

# 19. HALF-DAY SUPPORT

The system already supports half-days.

Make sure cognitive scoring understands them.

For example:

```text
Wednesday:
P1
P2
P3
P4
```

If Mathematics is placed at:

```text
P4
```

the system should recognize it as relatively late **within Wednesday's available instructional day**.

Do not compare Wednesday P4 to Friday P8 using raw period numbers.

Use each day's actual grid.

---

# 20. GENERATION REPORT SHOULD EXPLAIN QUALITY

Eventually the generation result should be able to say:

```text
TIMETABLE QUALITY

Hard constraints:
✓ 0 teacher clashes
✓ 0 student clashes
✓ 0 room clashes
✓ 0 double violations

Pedagogical preferences:
✓ 84% of high-load subjects placed in preferred periods
✓ 91% of Form 1–3 high-load lessons placed before midday
✓ 0 Form 1 classes with 3 consecutive high-load subjects

Warnings:
2 Mathematics lessons placed late because of teacher availability.
```

This would make the AI's scheduling decisions understandable to the administrator.

---

# 21. MANUAL EDITING MUST ALSO SHOW THE PREFERENCE

When the administrator manually moves a lesson:

For example:

```text
Mathematics
Form 1
14:00
```

the system could show:

```text
YELLOW — Pedagogical preference

Mathematics is configured as a high-cognitive-load subject
with a strong early-day preference for this class level.

This slot is allowed, but not preferred.
```

This is NOT a red error.

The administrator can still keep it.

---

# 22. RED / YELLOW / GREEN SEMANTICS

Keep the existing visual logic.

### RED

Hard violation:

```text
Teacher clash
Student clash
Room clash
Blocked period
Double broken
Weekly volume broken
Cross-section conflict
```

### YELLOW

Soft warning:

```text
Teacher availability concern
High-load subject placed late
Younger class has demanding lesson late
Consecutive high-load subjects
Pedagogical preference not satisfied
```

### GREEN

Preferred arrangement:

```text
High-load subject placed in preferred period
Double placed in preferred time
Balanced cognitive load
```

Do not turn a yellow pedagogical preference into a hard scheduling failure.

---

# 23. THE SOLVER SHOULD OPTIMIZE, NOT JUST VALIDATE

The current engine has moved from:

```text
"Can I create a timetable?"
```

to:

```text
"Can I create a valid timetable?"
```

Now we want:

```text
"Among all valid timetables, which is educationally better?"
```

That is the correct architecture.

The solver should search the feasible solution space and minimize a quality score.

Conceptually:

```text
TOTAL COST =

teacher preference cost
+
subject time preference cost
+
class fatigue cost
+
late high-load cost
+
consecutive high-load cost
+
other future soft preferences
```

while hard constraints remain absolute.

---

# 24. ADD TESTS

Create tests for at least:

### Test A — Mathematics prefers morning

```text
Mathematics
HIGH cognitive load
Form 1
teacher available all day
```

Expected:

```text
solver chooses early period
```

when equivalent alternatives exist.

---

### Test B — Higher class has weaker penalty

```text
Mathematics
Form 1
vs
Mathematics
Lower Sixth
```

Both may be scheduled late if necessary.

But Form 1 should receive the stronger penalty.

---

### Test C — Preference never causes infeasibility

If Mathematics cannot be scheduled in the morning:

```text
teacher unavailable
```

the solver should place it later rather than report infeasible merely because the preferred time is unavailable.

---

### Test D — Double preference

A Mathematics double should preferably occur early:

```text
P1 + P2
```

rather than:

```text
P7 + P8
```

when both are otherwise equally feasible.

---

### Test E — Half-day

Wednesday has only four periods.

Verify the algorithm correctly identifies:

```text
P4
```

as late relative to Wednesday.

---

### Test F — Section interaction

A teacher shared across sections must never be double-booked even if one section is generated later.

---

### Test G — Manual movement

Moving Mathematics from preferred morning period to afternoon:

```text
does NOT create RED
```

but:

```text
creates YELLOW pedagogical warning
```

---

# 25. VERY IMPORTANT — PRESERVE EXISTING DOUBLE LOGIC

Do not regress the recently fixed double engine.

All current tests must continue passing.

Especially:

```text
2 periods = 1 double
3 periods = 1 double + 1 single
4 periods = 2 doubles
5 periods = 2 doubles + 1 single
6 periods = 3 doubles
```

where this is the configured/default session structure.

The new cognitive-load objective must operate on the resulting sessions.

For example:

```text
Mathematics
4 periods
2 doubles

→ solver chooses two good morning/early-day blocks where possible.
```

---

# 26. DO NOT MAKE THE ALGORITHM "MORNING ONLY"

This is the most important conceptual requirement.

We are NOT building:

```text
Math → morning only
```

We are building:

```text
Math → morning preferred
```

with preference strength depending on:

```text
subject cognitive demand
+
class level
+
time of day
```

The system must remain flexible enough to generate a valid timetable when real-world constraints make the preferred placement impossible.

---

# 27. FUTURE-READY ARCHITECTURE

Design the model so that we can later add:

```text
Teacher preferred periods
Teacher maximum consecutive periods
Teacher free periods
Subject room preferences
Laboratory preferences
Practical subjects
Sports periods
Assembly
Devotion
Breaks
Lunch
Class concentration profiles
Exam periods
Special school days
```

without rewriting the solver architecture.

The correct abstraction is:

```text
HARD CONSTRAINTS
+
SOFT CONSTRAINTS
+
WEIGHTED OBJECTIVE
```

---

# FINAL ACCEPTANCE CRITERIA

Do not mark this enhancement complete merely because the code compiles.

We should be able to demonstrate:

```text
Form 1 Mathematics
→ strongly prefers morning

Form 4 Mathematics
→ prefers morning, but less strongly

Lower Sixth Mathematics
→ still prefers morning, but tolerates later periods better

Mathematics can still be scheduled in afternoon
→ no hard error

Mathematics double
→ scored as a complete two-period session

Half-day
→ correctly scored relative to that day's available periods

Teacher availability
→ always overrides pedagogical preference

Cross-section teacher occupancy
→ always overrides pedagogical preference

Manual move to late period
→ yellow warning, not red

Actual timetable generation
→ produces measurably better placement of high-cognitive-load subjects
```

The goal is to make the scheduler behave more like an experienced school timetable administrator:

> **First make the timetable possible. Then make it conflict-free. Then make it educationally sensible.**

Do not sacrifice feasibility for preference.

Do not treat pedagogical preferences as hard constraints.

Build this as a clean weighted optimization layer on top of the existing hard-constraint scheduling engine.