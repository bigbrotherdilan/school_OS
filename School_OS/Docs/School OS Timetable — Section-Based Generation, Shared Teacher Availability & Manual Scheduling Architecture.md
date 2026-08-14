# SCHOOL OS TIMETABLE ENGINE
## SECTION-BASED GENERATION + SHARED SCHOOL-WIDE RESOURCE SCHEDULING

### CRITICAL ARCHITECTURAL EXTENSION

The timetable engine must now explicitly support **section-by-section timetable generation**.

This is not optional.

The existing School OS academic system already organizes the school into sections such as:

- Commercial
- Grammar
- Technical
- French sections
- Other sections configured by the school

These sections can have:

- Different subjects
- Different classes
- Different teachers
- Shared teachers
- Different scheduling requirements
- Different timetables

Therefore, the timetable engine must understand that a section is a **generation scope**, but NOT an isolated scheduling universe.

---

# 1. THE MOST IMPORTANT RULE

A section may be generated independently, but **teachers and other shared resources exist at the school level**.

For example:

```text
MONDAY 09:10–10:00

Commercial
    Mathematics
    Teacher A
```

If Commercial is generated and approved first, then later:

```text
Grammar
    Mathematics
    Teacher A
```

is being generated.

The Grammar scheduler MUST know:

```text
Teacher A
Monday 09:10–10:00
ALREADY OCCUPIED
```

Therefore Grammar cannot place Teacher A there.

The fact that the timetable is being generated on another day does not matter.

The timetable engine must operate against the **current global scheduling state**.

---

# 2. SECTIONS ARE GENERATION BOUNDARIES, NOT RESOURCE BOUNDARIES

This distinction is extremely important.

A section should define:

```text
What timetable are we currently generating?
```

It should NOT define:

```text
Which teachers/resources exist?
```

Teachers belong to the school/tenant.

Therefore:

```text
Commercial timetable
       ↓
uses school-wide teachers/resources

Grammar timetable
       ↓
uses school-wide teachers/resources

Technical timetable
       ↓
uses school-wide teachers/resources
```

All of them must see the same teacher occupancy state.

---

# 3. SECTION GENERATION CAN HAPPEN AT DIFFERENT TIMES

The system must support:

```text
Monday:
    Generate Commercial

Tuesday:
    Approve Commercial

Wednesday:
    Generate Grammar

Thursday:
    Generate Technical
```

The scheduling engine must not assume that all sections are generated simultaneously.

When a new section is generated, it must query the already-existing approved/committed schedules.

Conceptually:

```text
School
│
├── Commercial
│      └── Approved timetable
│
├── Grammar
│      └── Being generated
│
├── Technical
│      └── Not generated yet
│
└── French
       └── Not generated yet
```

When generating Grammar, the solver must see the Commercial timetable as an existing constraint.

---

# 4. GLOBAL TEACHER OCCUPANCY

The system needs a school-wide teacher occupancy model.

Conceptually:

```text
Teacher
+
Day
+
Period
+
Section
+
Class
+
Subject
```

Example:

```text
Teacher A
Monday
09:10–10:00
Commercial
Form 4 Commercial
Mathematics
```

This creates a teacher occupancy record.

When generating another section:

```text
Grammar
Monday
09:10–10:00
Teacher A
```

the solver must reject that slot.

---

# 5. IMPORTANT: DO NOT ONLY CHECK THE CURRENT SECTION

A common implementation mistake would be:

```text
generate(section_id)
    ↓
check conflicts within section
```

That is insufficient.

It must effectively behave like:

```text
generate(section_id)
    ↓
load current section requirements
    +
load committed schedules from other sections
    +
load global teacher availability
    +
load global room/resource occupancy
    ↓
solve
```

The existing timetable for other sections becomes part of the constraint environment.

---

# 6. APPROVED VS UNAPPROVED SECTION TIMETABLES

Introduce an explicit concept of timetable state.

For example:

```text
DRAFT
GENERATING
GENERATED
UNDER_REVIEW
APPROVED
PUBLISHED
ARCHIVED
```

The exact names can follow the existing School OS conventions.

The important distinction is:

### APPROVED / COMMITTED

The timetable occupies shared resources.

### DRAFT

It may not necessarily reserve resources globally unless explicitly configured to do so.

### GENERATING

Temporary solver state.

### PUBLISHED

Definitely occupies resources.

The architecture should make this state explicit rather than inferring it from whether rows exist in the database.

---

# 7. APPROVAL MUST COMMIT RESOURCE OCCUPANCY

When a section is approved:

```text
Commercial
    ↓
APPROVED
```

its teacher/resource occupancy becomes part of the global scheduling state.

Then:

```text
Generate Grammar
```

must automatically respect it.

The administrator should never have to manually tell the Grammar generator:

> "Don't use Teacher A on Monday at 09:10."

The system already knows.

---

# 8. WHAT IF THE TEACHER HAS NOT YET BEEN ASSIGNED?

This is another important real-world requirement.

Sometimes the timetable must be generated **before teachers are fully assigned**.

For example:

```text
Form 5
Mathematics
Required: 5 periods/week
Teacher: NOT YET ASSIGNED
```

The scheduler should NOT fail simply because the teacher is unknown.

Instead, it should be able to generate:

```text
Teacher X
```

or an equivalent explicit placeholder such as:

```text
Unassigned Teacher
TBD
Teacher X
```

The placeholder must be a real scheduling concept, not fake teacher data inserted into the database.

---

# 9. TEACHER X MUST NOT BECOME A REAL SHARED TEACHER

This distinction is critical.

If:

```text
Form 5 Mathematics
Teacher X
```

is only a placeholder, it must NOT cause:

```text
Form 4 Mathematics
Teacher X
```

to be considered a teacher conflict.

Because "Teacher X" does not represent an actual person.

Therefore:

```text
UNASSIGNED / PLACEHOLDER
```

means:

> No known teacher resource has been assigned yet.

It should not reserve a real teacher's schedule.

---

# 10. TEACHER ASSIGNMENT CAN HAPPEN AFTER GENERATION

Example:

### Initial state

```text
Form 6 Lower
Mathematics
4 periods
Teacher:
TBD
```

The timetable can be generated:

```text
Monday    08:20–09:10   Mathematics   TBD
Tuesday   09:10–10:00   Mathematics   TBD
Thursday  08:20–09:10   Mathematics   TBD
Friday    10:00–10:50   Mathematics   TBD
```

Later the school assigns:

```text
Teacher A
```

The system should then validate Teacher A's availability and existing workload.

---

# 11. ONE SUBJECT MAY HAVE MULTIPLE TEACHERS

This is also essential.

Do NOT model:

```text
Class + Subject = exactly one Teacher
```

That is too restrictive.

For example:

```text
Lower Sixth Mathematics
Required: 8 periods/week
```

could be taught by:

```text
Teacher A → 4 periods
Teacher B → 4 periods
```

Or:

```text
Teacher A → 3 periods
Teacher B → 5 periods
```

Or:

```text
Teacher A → 2
Teacher B → 2
Teacher C → 4
```

All are legitimate.

---

# 12. TEACHER ALLOCATION SHOULD BE PERIOD-LEVEL

The important distinction is:

```text
Subject requirement
        ↓
Required total periods
        ↓
Individual timetable periods
        ↓
Teacher assignment per period
```

For example:

```text
Lower Sixth Mathematics
8 periods/week
```

could become:

```text
Monday    Mathematics   Teacher A
Monday    Mathematics   Teacher A

Tuesday   Mathematics   Teacher B
Tuesday   Mathematics   Teacher B

Wednesday Mathematics   Teacher A
Thursday  Mathematics   Teacher B
Thursday  Mathematics   Teacher C
Friday    Mathematics   Teacher C
```

The total remains:

```text
8 periods
```

but the teaching responsibility is distributed across teachers.

---

# 13. SUPPORT TEACHER ALLOCATION RULES

The system should eventually support:

```text
Required periods:
8

Teacher allocations:
Teacher A → 4
Teacher B → 4
```

or:

```text
Teacher A → 3
Teacher B → 5
```

or:

```text
Teacher A → minimum 2
Teacher B → minimum 2
Teacher C → remaining
```

The exact allocation can be configured or manually assigned.

Do not hard-code one-teacher-per-subject assumptions into the scheduling engine.

---

# 14. TEACHER ASSIGNMENT AFTER GENERATION MUST REVALIDATE

Suppose the timetable currently contains:

```text
Monday 09:10
Mathematics
Teacher X
```

Admin changes it to:

```text
Teacher A
```

The system must immediately check:

### Teacher A

- Is already teaching another class?
- Is unavailable?
- Is assigned to another section?
- Is assigned to another class?
- Is the period inside their availability?
- Is the teacher's workload exceeded?

If there is a hard conflict, the system should immediately indicate it.

---

# 15. MANUAL TIMETABLE EDITING IS A FIRST-CLASS FEATURE

The generated timetable is not the final authority.

School administrators need to be able to manually adjust the generated schedule.

The UI should support operations such as:

```text
Drag subject
Drop subject
Move period
Swap periods
Change teacher
Change group
Change room
```

However, manual editing must be **constraint-aware**.

---

# 16. RED = HARD CLASH

When an administrator moves an item into a slot that creates a genuine hard conflict, the UI should immediately signal **RED**.

Examples:

```text
Teacher already teaching another class
```

```text
Same student group already has another subject
```

```text
Room already occupied
```

```text
Outside school timetable
```

```text
Blocked period
```

The red state means:

> This creates a hard scheduling conflict.

The administrator may be prevented from committing the move, depending on the school's configured policy.

---

# 17. YELLOW = TEACHER AVAILABILITY WARNING

Teacher availability should have a different visual meaning.

Example:

```text
Teacher A
Available:
07:30–12:00

Admin moves lesson to:
14:00
```

The system should show:

```text
YELLOW
Teacher A is unavailable during this period.
```

But the administrator may still be allowed to make the move manually.

This is intentional.

There is a difference between:

```text
HARD CONFLICT
```

and:

```text
WARNING / POLICY VIOLATION
```

---

# 18. RED AND YELLOW MUST NOT BE CONFUSED

Use a hierarchy such as:

```text
RED
Hard conflict
Cannot safely coexist.

YELLOW
Warning
Potential policy/availability issue,
but administrator may intentionally override.

GREEN
Valid
No detected conflict.

GRAY / MUTED
Unassigned / TBD / informational.
```

The exact colors can follow the existing School OS design system.

The important thing is the semantics.

---

# 19. MANUAL OVERRIDE MUST BE AUDITED

If an administrator intentionally overrides a yellow teacher-availability warning, the system should record:

```text
Who made the override
When
What was changed
Original value
New value
Reason, if required
```

For example:

```text
Admin:
John Doe

Changed:
Mathematics
Teacher A

From:
Monday 10:00

To:
Monday 14:00

Warning:
Teacher A unavailable

Override:
Accepted
```

This creates accountability without preventing legitimate administrative decisions.

---

# 20. MANUAL RED OVERRIDES SHOULD BE MUCH MORE RESTRICTIVE

A red hard clash should generally not be silently accepted.

If the product eventually permits administrators to force a hard conflict, it should require an explicit override and produce a persistent warning.

Do not make it easy to accidentally create invalid timetables.

---

# 21. SECTION GENERATION EXAMPLE

The engine should support this workflow.

### STEP 1

Admin chooses:

```text
Section:
Commercial
```

System generates Commercial.

```text
Commercial
    ↓
Generated
    ↓
Reviewed
    ↓
Approved
```

---

### STEP 2

Admin chooses:

```text
Section:
Grammar
```

The Grammar generator automatically loads:

```text
Approved Commercial timetable
+
Global teacher availability
+
Global rooms
+
Grammar requirements
```

If Teacher A is occupied in Commercial:

```text
Teacher A
Monday 09:10–10:00
```

the Grammar solver cannot use Teacher A there.

---

### STEP 3

Later:

```text
Technical
```

The Technical generator loads:

```text
Commercial occupancy
+
Grammar occupancy
+
Global resources
```

---

### STEP 4

French section is generated later.

It must respect all existing teacher/resource commitments.

---

# 22. IMPORTANT: TEACHER OCCUPANCY MUST CROSS SECTION BOUNDARIES

This is the central invariant:

```text
Teacher availability is SCHOOL-WIDE.
```

NOT:

```text
Teacher availability is SECTION-WIDE.
```

A teacher does not become a different person when the scheduler changes sections.

---

# 23. SECTION GENERATION SHOULD NOT LOCK THE ENTIRE SCHOOL

Generating Commercial must NOT freeze:

```text
all teachers
all classes
all sections
```

Only the actual resources occupied by approved/committed Commercial allocations should become unavailable.

For example:

```text
Commercial:
Teacher A → Monday 09:10
Teacher B → Tuesday 10:00
```

Only those teacher/time combinations are occupied.

Teacher A remains available at other times.

---

# 24. WHEN A NEW TEACHER ASSIGNMENT IS MADE

Suppose Commercial was generated first.

At that time:

```text
Teacher A
```

was not assigned to Grammar.

Later, administration assigns:

```text
Teacher A → Grammar Form 5 Mathematics
```

The system must immediately evaluate:

```text
Teacher A existing school-wide timetable
+
new Grammar allocation
```

and identify available periods.

The scheduler should preferably place or regenerate the Grammar allocation using Teacher A's remaining free slots.

---

# 25. DO NOT REGENERATE UNRELATED SECTIONS UNNECESSARILY

If Grammar changes, do not automatically destroy:

```text
Approved Commercial
Approved Technical
```

unless the administrator explicitly requests a school-wide regeneration.

The architecture should support:

```text
Generate Section
Repair Section
Regenerate Section
Regenerate Entire School
```

as different operations.

---

# 26. THREE IMPORTANT GENERATION MODES

The engine should conceptually support:

### A. INITIAL SECTION GENERATION

Generate one section while respecting already committed school-wide resources.

```text
Generate:
Grammar

Respect:
Commercial
Technical
etc.
```

---

### B. SECTION REPAIR

Existing section has been modified.

Repair it while minimizing disruption.

```text
Keep:
Locked/approved allocations

Change:
Only necessary allocations
```

---

### C. SCHOOL-WIDE GENERATION

Generate all sections together.

This is useful when the administrator wants the mathematically best global timetable.

The solver should then have visibility of all sections simultaneously.

---

# 27. SCHOOL-WIDE GENERATION MAY PRODUCE A BETTER GLOBAL RESULT

This is important.

Sequential generation is necessary because schools may build timetables over several days.

But the system should also support:

```text
Generate Entire School
```

because global optimization can sometimes produce a better result than:

```text
Commercial first
Grammar second
Technical third
```

The architecture should therefore support both:

```text
Incremental scheduling
```

and:

```text
Global scheduling
```

without creating two completely separate engines.

They should use the same underlying constraint model.

---

# 28. GLOBAL OCCUPANCY SHOULD BE RESOURCE-BASED

At minimum:

```text
Teacher
+
Day
+
Period
```

should be globally tracked.

Eventually the same architecture can support:

```text
Room
+
Day
+
Period
```

and other resources.

This allows School OS to grow without redesigning the entire timetable engine.

---

# 29. SECTION-AWARE VALIDATION

Validation should be able to answer:

```text
Is this section valid by itself?
```

and:

```text
Is this section valid against the rest of the school?
```

These are different questions.

For example:

```text
Grammar
```

may have zero internal conflicts.

But:

```text
Grammar
+
Commercial
```

could have a Teacher A conflict.

Therefore validation should include:

```text
validate_section_internal()
```

and:

```text
validate_section_against_school()
```

or equivalent architecture.

---

# 30. THE FRONTEND MUST SHOW CROSS-SECTION CONFLICTS

If an administrator edits Grammar and assigns:

```text
Teacher A
Monday 09:10
```

while Teacher A is already teaching Commercial at that time, the Grammar UI should immediately show:

```text
RED

Teacher A is already teaching:
Commercial
Form 4
Mathematics
Monday 09:10–10:00
```

The admin should not need to open the Commercial timetable manually to discover this.

---

# 31. TEACHER AVAILABILITY VS TEACHER OCCUPANCY

These are different concepts.

### Teacher availability

Whether the teacher is willing/allowed to teach during a period.

Example:

```text
Teacher A
Unavailable:
Monday 14:00–16:00
```

### Teacher occupancy

Whether the teacher is already teaching during that period.

Example:

```text
Teacher A
Teaching Commercial
Monday 09:10–10:00
```

A teacher can be:

```text
Available + Free
Available + Occupied
Unavailable + Free
Unavailable + Occupied
```

The generator should avoid both:

```text
Unavailable
```

and:

```text
Occupied
```

Manual editing should visually distinguish them.

---

# 32. SUBJECT TEACHER PLACEHOLDERS

For unassigned subjects, use a proper conceptual state:

```text
Teacher:
UNASSIGNED
```

not a fake person record.

The UI may display:

```text
Teacher X
```

if that is the desired user-facing terminology.

But internally:

```text
teacher_id = NULL
teacher_status = UNASSIGNED
```

is preferable.

This allows a real teacher to be assigned later without treating "Teacher X" as a real shared resource.

---

# 33. MULTIPLE TEACHERS PER SUBJECT MUST NOT BREAK WEEKLY VOLUME

Suppose:

```text
Lower Sixth Mathematics
Required = 8 periods
```

Assignments:

```text
Teacher A = 4
Teacher B = 4
```

Validation must calculate:

```text
4 + 4 = 8
```

not treat them as two separate Mathematics requirements.

Likewise:

```text
Teacher A = 3
Teacher B = 5
```

must still produce:

```text
Total Mathematics = 8
```

---

# 34. TEACHER SPLITS MUST WORK ACROSS CLASSES TOO

The same teacher can teach:

```text
Form 4 Mathematics
Form 5 Mathematics
Lower Sixth Mathematics
```

The school-wide teacher occupancy engine must prevent simultaneous assignments across all of them.

The same teacher resource is shared across:

```text
Sections
Classes
Streams
Subjects
```

---

# 35. FINAL RESOURCE MODEL

The architecture should think in terms of:

```text
                    SCHOOL
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       Sections      Teachers      Rooms
          │            │            │
     ┌────┼────┐       │            │
     ↓    ↓    ↓       │            │
  Classes Streams       │            │
     │      │           │            │
     └──────┼───────────┼────────────┘
            ↓
       Timetable
            ↓
      Day + Period
            ↓
    Resource Allocation
```

---

# 36. THE CENTRAL INVARIANTS

The following must always remain true.

### Student constraint

The same student group cannot attend two incompatible subjects simultaneously.

### Teacher constraint

The same real teacher cannot teach two classes/sections simultaneously.

### Room constraint

The same room cannot host two incompatible allocations simultaneously.

### School constraint

No class/group may be scheduled outside its permitted school periods.

### Block constraint

Blocked periods cannot contain generated lessons.

### Volume constraint

Every required subject allocation must receive its required number of periods unless the system explicitly reports infeasibility.

### Section constraint

Generating one section must respect committed resources from previously approved sections.

### Placeholder constraint

Unassigned teachers do not reserve a real teacher resource.

### Manual editing constraint

Manual changes immediately recalculate conflicts and warnings.

---

# 37. THIS MUST NOW BECOME PART OF THE PERMANENT TEST SUITE

Add permanent tests for:

```text
test_section_generation_respects_approved_section_teachers

test_section_generation_respects_multiple_previous_sections

test_teacher_occupancy_crosses_section_boundary

test_unassigned_teacher_does_not_create_false_conflict

test_assign_teacher_after_generation

test_subject_can_have_multiple_teachers

test_teacher_period_allocation_totals_subject_volume

test_teacher_split_3_5_periods

test_teacher_split_2_2_4_periods

test_schoolwide_teacher_conflict

test_section_internal_validation

test_section_against_school_validation

test_manual_move_teacher_hard_conflict

test_manual_move_teacher_availability_warning

test_parallel_streams_across_sections

test_repair_section_without_destroying_approved_sections
```

---

# 38. FINAL ARCHITECTURAL PRINCIPLE

The timetable system should now be understood as:

> **A school-wide resource scheduling engine that supports incremental section-based generation.**

Not:

> A collection of independent section timetables.

The section is the **scope of generation**.

The school is the **scope of resource availability**.

This distinction is fundamental.

---

# FINAL WORKFLOW

The intended workflow should be:

```text
                    SCHOOL
                      │
          ┌───────────┴───────────┐
          │                       │
    Global Resources        Global Availability
    Teachers / Rooms        Teacher Availability
          │                       │
          └───────────┬───────────┘
                      ↓
              SECTION GENERATOR
                      │
        ┌─────────────┼──────────────┐
        ↓             ↓              ↓
   Commercial      Grammar       Technical
        │             │              │
        ↓             ↓              ↓
    APPROVED       GENERATE        GENERATE
        │             │              │
        └─────────────┼──────────────┘
                      ↓
             SHARED RESOURCE STATE
                      │
                      ↓
               VALIDATE SCHOOL
```

When Grammar is generated after Commercial:

```text
Commercial APPROVED
       ↓
Teacher A occupied:
Monday 09:10
       ↓
Grammar solver sees this
       ↓
Teacher A cannot be assigned there
       ↓
Find another legal slot
```

When a teacher is not yet assigned:

```text
Subject
   ↓
Teacher = UNASSIGNED
   ↓
Generate timetable
   ↓
Display Teacher X / TBD
   ↓
Teacher assigned later
   ↓
Revalidate school-wide occupancy
   ↓
Move/reassign if necessary
```

When an administrator manually edits:

```text
DRAG / DROP
      ↓
Immediate validation
      ↓
 ┌────┼───────────┐
 ↓    ↓           ↓
RED  YELLOW     GREEN
 ↓    ↓           ↓
Hard Warning     Valid
clash            only
```

This architecture must be implemented **before considering the timetable engine complete**.

The existing CP-SAT solver, group-aware model, half-day support, blocked periods, and validation work should be preserved and extended rather than replaced.

The key architectural change is:

> **The scheduler operates section-by-section, but teacher/resource constraints operate school-wide.**