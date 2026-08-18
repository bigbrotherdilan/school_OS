# Section Based School Timetable Generation — Complete Implementation Plan

## 1. Objective

* [ ] 

The school is divided into different sections, for example:

* Grammar
* Technical
* Commercial

The timetable generator must work **one section at a time**.

The administrator should be able to select a section, such as **Grammar**, and generate a complete timetable for every class and every teacher involved in that section.

After the Grammar timetable has been successfully generated and validated, the administrator can move to the next section, such as Technical, and generate that section separately.

The system must not simply randomly place subjects into timetable cells. It must understand the relationships between:

**Section → Classes → Subjects → Teachers → Weekly Period Requirements → Teacher Availability → Timetable Slots**

The objective is to produce a timetable that is:

* Complete
* Conflict free
* Balanced
* Realistic
* Easy to understand
* Consistent with the school's configured working days and periods
* Consistent with teacher availability
* Consistent with the number of periods required for every subject in every class
* Consistent with the number of working days assigned to each teacher
* Suitable for viewing by class and by teacher
* Capable of being regenerated when necessary

The school configuration for the general timetable structure has already been implemented.

Therefore, this implementation should build on the existing system rather than recreate the school timetable configuration functionality.

---

# 2. Existing School Timetable Configuration

The software already allows the school to configure the general timetable structure.

This configuration includes things such as:

* Working days
* School starting time
* School ending time
* Number of periods per day
* Period duration
* Break times
* Possibly multiple breaks
* The order of periods during the school day

For example, the school may configure:

Monday to Friday

School starts:

07:30

School ends:

15:00

Periods:

Period 1
Period 2
Period 3
Break
Period 4
Period 5
Period 6

The timetable generator must use this existing configuration.

Do not create another independent configuration for days, period times, or breaks.

The timetable generation engine must retrieve the school's already configured timetable structure and use it as the available timetable grid.

For example:

```text
Monday
    Period 1
    Period 2
    Period 3
    Break
    Period 4
    Period 5
    Period 6

Tuesday
    Period 1
    Period 2
    Period 3
    Break
    Period 4
    Period 5
    Period 6

Wednesday
    Period 1
    Period 2
    Period 3
    Break
    Period 4
    Period 5
    Period 6

Thursday
    Period 1
    Period 2
    Period 3
    Break
    Period 4
    Period 5
    Period 6

Friday
    Period 1
    Period 2
    Period 3
    Break
    Period 4
    Period 5
    Period 6
```

The generator should treat breaks as unavailable timetable slots.

---

# 3. Meaning of a Section

A section is the school's academic stream or division.

Examples:

```text
Grammar
Technical
Commercial
```

A section is NOT the same thing as a class.

For example:

```text
Grammar
    Form 1A
    Form 1B
    Form 2A
    Form 2B
    Form 3A
    Form 3B
    Form 4A
    Form 5A

Technical
    Form 1 Technical
    Form 2 Technical
    Form 3 Technical
    Form 4 Technical
    Form 5 Technical

Commercial
    Form 1 Commercial
    Form 2 Commercial
    Form 3 Commercial
    Form 4 Commercial
    Form 5 Commercial
```

The exact classes should come from the existing school's data.

The timetable engine must not hardcode these examples.

---

# 4. Section Based Generation

The main workflow should be:

```text
Select Section
        ↓
Load Classes
        ↓
Load Teachers
        ↓
Load Teacher Assignments
        ↓
Load Subjects
        ↓
Load Period Requirements
        ↓
Load Teacher Working Days / Availability
        ↓
Load School Timetable Configuration
        ↓
Build Required Lessons
        ↓
Build Available Timetable Slots
        ↓
Generate Timetable
        ↓
Validate Timetable
        ↓
Display Results
        ↓
Save Timetable
```

The administrator should be able to repeat this process independently for each section.

Example:

```text
Generate Timetable

[ Grammar ▼ ]

[ Load Section Data ]

        ↓

Grammar timetable generated

        ↓

[ Save Timetable ]
```

Then:

```text
Generate Timetable

[ Technical ▼ ]

[ Load Section Data ]

        ↓

Technical timetable generated
```

And then Commercial.

---

# 5. What Happens When a Section Is Selected

Suppose the administrator selects:

```text
Grammar
```

The system should retrieve all classes belonging to Grammar.

For example:

```text
Grammar

Form 1A
Form 1B
Form 2A
Form 2B
Form 3A
Form 3B
Form 4A
Form 5A
```

Then the system needs to determine which teachers teach those classes.

This is important because not every teacher in the school necessarily belongs to the selected section.

If a teacher teaches only Technical classes, that teacher should not be included in the Grammar timetable generation.

However, if a teacher teaches both Grammar and Technical classes, that teacher may appear in both generation processes.

The implementation must therefore determine teacher participation based on actual teacher assignments.

---

# 6. Teacher Selection

The system should provide a way to review the teachers involved in the selected section.

For example:

```text
Section: Grammar

Teachers:

☑ Mr. John
☑ Mrs. Mary
☑ Mr. Peter
☑ Mrs. Sarah
☑ Mr. David
```

Ideally, these teachers should be automatically identified from the existing teacher-class-subject assignments.

The administrator should not have to manually reconstruct all assignments if the system already knows them.

The system can automatically say:

```text
These are the teachers who have assignments in Grammar.
```

The administrator can then review the information before generation.

If the application design requires manual confirmation, allow the administrator to select or deselect teachers.

However, deselecting a teacher who has active assignments in the section must trigger a warning because those assignments cannot be scheduled without that teacher.

---

# 7. Teacher → Subject → Class Relationship

This is one of the most important parts of the implementation.

The system must understand that a teacher assignment consists of a relationship between:

```text
Teacher
Subject
Class
```

For example:

```text
Mr. John
    Mathematics
        Form 1A
        Form 2A
        Form 3A
```

Another teacher:

```text
Mrs. Mary
    English
        Form 1A
        Form 1B
        Form 2A
```

Another:

```text
Mr. Peter
    Physics
        Form 3A
        Form 4A
        Form 5A
```

The generator must not assume that one teacher teaches one subject to one class.

One teacher can:

* Teach multiple subjects
* Teach one subject to multiple classes
* Teach different subjects to different classes
* Teach multiple classes at the same time only if the school explicitly models that as a valid shared lesson, otherwise it is a conflict

The normal assumption should be:

**One teacher cannot teach two different classes at the same time.**

---

# 8. Subject Period Requirements

Every subject assigned to a class must have a weekly period requirement.

For example:

```text
Form 1A

Mathematics → 5 periods/week
English → 5 periods/week
Physics → 3 periods/week
Biology → 3 periods/week
Chemistry → 3 periods/week
History → 2 periods/week
Geography → 2 periods/week
ICT → 2 periods/week
```

Another class might have different requirements.

For example:

```text
Form 2A

Mathematics → 5 periods/week
English → 4 periods/week
Physics → 3 periods/week
Chemistry → 3 periods/week
Biology → 3 periods/week
History → 2 periods/week
```

The system must NOT assume that the same subject always has the same number of periods for every class.

The required value belongs to the **class-subject assignment**.

Therefore:

```text
Class + Subject = Required weekly periods
```

This is the value the timetable generator must satisfy.

---

# 9. Required Lesson Instances

The generator should convert each weekly requirement into a number of required lesson instances.

For example:

```text
Form 1A
Mathematics
5 periods/week
Teacher: Mr. John
```

creates five required lessons:

```text
Lesson 1:
Form 1A → Mathematics → Mr. John

Lesson 2:
Form 1A → Mathematics → Mr. John

Lesson 3:
Form 1A → Mathematics → Mr. John

Lesson 4:
Form 1A → Mathematics → Mr. John

Lesson 5:
Form 1A → Mathematics → Mr. John
```

These lessons do not yet have days or times.

The generation engine's job is to assign each lesson to a valid timetable slot.

---

# 10. Teacher Number of Working Days

The system must support a teacher's expected number of working days.

For example:

```text
Mr. John

Expected working days: 5
```

or:

```text
Mrs. Mary

Expected working days: 4
```

This does not necessarily mean that the teacher must teach every period on those days.

It means the generator should distribute the teacher's workload across the permitted number of days.

For example, if Mrs. Mary has 16 periods per week and is expected to work 4 days, a reasonable timetable might distribute her workload across four days instead of unnecessarily placing all 16 periods across only two days.

The implementation must distinguish:

```text
Teacher working days
```

from:

```text
Teacher periods per week
```

and:

```text
Teacher maximum periods per day
```

These are separate constraints.

---

# 11. Teacher Availability

The system should support teacher availability.

A teacher may have:

```text
Available:
Monday
Tuesday
Wednesday
Thursday
Friday
```

Another teacher might only be available:

```text
Monday
Tuesday
Thursday
Friday
```

Another teacher may have specific unavailable periods.

For example:

```text
Mr. John

Wednesday:
Period 1 → unavailable
Period 2 → unavailable
```

The timetable generator must never place Mr. John in those slots.

If the existing application already has a teacher availability system, integrate with it instead of creating another one.

---

# 12. Teacher Workload

The generator should support teacher workload constraints.

Possible values include:

```text
Periods per week
Maximum periods per day
Minimum periods per day
Maximum consecutive periods
Preferred working days
Required working days
Unavailable days
Unavailable periods
```

Not all of these necessarily have to be exposed to the user immediately.

The architecture should, however, allow them to be added.

At minimum, the generator should understand:

```text
Teacher
    Weekly workload
    Working days
    Daily capacity
    Availability
```

---

# 13. Class Timetable Requirements

Classes also have constraints.

A class cannot have two subjects at the same time.

For example:

```text
Monday
Period 2

Form 1A → Mathematics
```

means Form 1A cannot simultaneously have:

```text
Form 1A → English
```

The generator must therefore maintain class occupancy.

Conceptually:

```text
Class + Day + Period
```

must be unique.

---

# 14. Teacher Timetable Requirements

Teachers also have occupancy constraints.

Conceptually:

```text
Teacher + Day + Period
```

must be unique.

For example:

```text
Monday
Period 3

Mr. John → Form 1A
```

means the system cannot simultaneously assign:

```text
Mr. John → Form 2A
```

at Monday Period 3.

This is one of the most important hard constraints.

---

# 15. Timetable Slot

A timetable slot should represent:

```text
Day
Period
Start Time
End Time
```

For example:

```text
Monday
Period 1
07:30
08:10
```

The generator should use the existing school timetable configuration to obtain these slots.

Breaks should not be treated as normal teaching slots.

---

# 16. Hard Constraints

Hard constraints are rules that MUST be satisfied.

The generator must never knowingly return a timetable that violates them.

### Constraint 1: No teacher conflict

A teacher cannot teach two classes at the same time.

```text
Teacher + Day + Period
```

must be unique.

### Constraint 2: No class conflict

A class cannot have two subjects at the same time.

```text
Class + Day + Period
```

must be unique.

### Constraint 3: Teacher availability

A teacher cannot be assigned to an unavailable day or period.

### Constraint 4: Required weekly periods

If:

```text
Form 1A
Mathematics
5 periods/week
```

the timetable must contain exactly five Mathematics lessons for Form 1A.

### Constraint 5: School timetable boundaries

Lessons must only be placed inside the school's configured working periods.

### Constraint 6: Break periods

No teaching lesson may be assigned to a configured break.

### Constraint 7: Teacher daily capacity

If the teacher has a maximum number of periods per day, that limit must not be exceeded.

### Constraint 8: Class daily capacity

If the school defines a maximum number of lessons for a class per day, that limit must not be exceeded.

### Constraint 9: Teacher working days

Where the teacher has a specified working-day requirement or availability restriction, the generator must respect it.

### Constraint 10: Section isolation

When generating a section, only the assignments relevant to that section should be considered for that section's timetable.

However, if the same teacher teaches multiple sections and the school intends the sections to operate during the same timetable periods, the system must account for those cross-section teacher conflicts.

This is especially important.

---

# 17. Cross-Section Teacher Conflicts

Although timetable generation is performed section by section, teachers may teach more than one section.

For example:

```text
Mr. John

Grammar:
    Mathematics → Form 2A

Technical:
    Mathematics → Form 2 Technical
```

If Grammar and Technical are generated independently, the system could accidentally create:

```text
Grammar:
Monday Period 2
Mr. John → Form 2A

Technical:
Monday Period 2
Mr. John → Form 2 Technical
```

That would be impossible.

Therefore, the implementation must decide how cross-section conflicts are handled.

The safest architecture is:

**Generate one section at a time, but validate teacher occupancy against already generated sections.**

For example:

```text
Grammar generated
        ↓
Save teacher occupancy
        ↓
Technical generated
        ↓
Check Technical assignments against existing Grammar occupancy
        ↓
Resolve conflicts
```

Alternatively, the application may allow the administrator to generate all sections and then run a final cross-section conflict validation.

The implementation should support this.

---

# 18. Soft Constraints

Soft constraints are preferences.

They should be optimized after hard constraints are satisfied.

Examples:

### Spread subjects across the week

If Mathematics requires five periods, avoid:

```text
Monday → Mathematics
Monday → Mathematics
Monday → Mathematics
Tuesday → Mathematics
Tuesday → Mathematics
```

if the timetable can reasonably distribute them.

Prefer something like:

```text
Monday → Mathematics
Tuesday → Mathematics
Wednesday → Mathematics
Thursday → Mathematics
Friday → Mathematics
```

### Avoid excessive consecutive lessons

Avoid giving a teacher six consecutive periods if a better distribution is available.

### Avoid excessive subject repetition

If possible, avoid putting the same subject twice in the same day unless the weekly requirement makes it necessary.

### Balance teacher workload

Try to distribute teaching periods across the teacher's working days.

### Balance class workload

Try to prevent a class from receiving an unnecessarily heavy concentration of lessons on one day.

### Avoid unnecessary gaps

If possible, avoid:

```text
Period 1 → Teaching
Period 2 → Free
Period 3 → Teaching
Period 4 → Free
Period 5 → Teaching
```

for teachers when the workload can be arranged more efficiently.

### Preferred subject placement

If the school eventually wants to define preferences such as:

```text
Mathematics preferably in morning periods
Practical subjects preferably after break
```

the architecture should allow these to become soft constraints.

---

# 19. Hard Constraints vs Soft Constraints

The implementation should explicitly separate the two.

```text
HARD CONSTRAINTS
    ↓
Must never be violated

SOFT CONSTRAINTS
    ↓
Should be optimized
```

A timetable that violates a hard constraint is invalid.

A timetable that violates a soft constraint may still be valid, but it should receive a lower quality score.

For example:

```text
Timetable A
Hard violations: 0
Soft violations: 15

Timetable B
Hard violations: 0
Soft violations: 5
```

Timetable B should be preferred.

But:

```text
Timetable C
Hard violations: 1
Soft violations: 0
```

Timetable C must be rejected.

---

# 20. Generation Strategy

Do not implement the generator as simple random placement.

The generator should be designed as a **constraint satisfaction / optimization problem**.

The basic problem is:

```text
Required Lessons
        +
Available Slots
        +
Hard Constraints
        +
Soft Constraints
        ↓
Valid Optimized Timetable
```

Each required lesson needs a slot.

For every lesson, the generator should determine:

```text
Day
Period
```

while preserving:

```text
Teacher availability
Class availability
Teacher occupancy
Class occupancy
Weekly subject requirements
Daily limits
Working-day requirements
```

---

# 21. Recommended Generation Process

The generator should follow an intelligent process.

## Step 1: Load the selected section

```text
sectionId
```

## Step 2: Load all classes

```text
classes = classes belonging to section
```

## Step 3: Load teacher assignments

Retrieve:

```text
Teacher
Subject
Class
```

for all classes in the section.

## Step 4: Load period requirements

For every class-subject assignment:

```text
requiredPeriodsPerWeek
```

## Step 5: Load teacher constraints

Retrieve:

```text
workingDays
availableDays
unavailableDays
availablePeriods
maximumPeriodsPerDay
maximumConsecutivePeriods
```

where available.

## Step 6: Load school timetable configuration

Retrieve:

```text
workingDays
periods
period times
breaks
```

## Step 7: Build lesson instances

Convert:

```text
Mathematics → 5 periods
```

into five schedulable lesson instances.

## Step 8: Rank difficult lessons first

The generator should schedule the most constrained lessons first.

For example, a lesson taught by a teacher who is only available on two days should be considered before a lesson taught by a teacher available all week.

Similarly, subjects with many weekly periods may require careful distribution.

## Step 9: Generate candidate slots

For each lesson, find all slots that satisfy hard constraints.

## Step 10: Assign lessons

Choose the best available slot.

## Step 11: Evaluate soft constraints

Calculate how good the placement is.

## Step 12: Backtrack when necessary

If placing a lesson later makes the timetable impossible, the generator must be able to move previous lessons and try another arrangement.

Do not simply stop at the first conflict.

## Step 13: Validate

After generation, perform a complete validation.

## Step 14: Save only a valid timetable

Do not save an incomplete or invalid timetable as a final generated timetable.

---

# 22. Why Backtracking Is Important

A simple greedy algorithm may produce something like:

```text
Form 1A
Mathematics → Monday Period 1

Form 2A
Mathematics → Monday Period 2

Form 3A
Mathematics → Monday Period 3
```

It may appear valid initially.

But later the generator may discover that a particular teacher is only available on Tuesday and Thursday, and the teacher has already been filled during all suitable slots.

The generator must then be able to go backwards and rearrange previous assignments.

Therefore, the implementation should support some form of:

```text
Constraint satisfaction
Backtracking
Optimization
```

or use an appropriate scheduling/constraint solver if the technology stack allows it.

---

# 23. Recommended Lesson Priority

Not every lesson should be treated equally during generation.

A useful strategy is to schedule the most constrained lessons first.

For example:

### Highest priority

* Teachers with very limited availability
* Classes with very limited available slots
* Subjects with high weekly requirements
* Practical subjects requiring special resources
* Lessons involving shared teachers
* Lessons with specific time restrictions

### Medium priority

* Normal subjects with ordinary availability

### Lower priority

* Lessons with many possible slots

This greatly improves the probability of finding a complete timetable.

---

# 24. Required Data Model

The implementation should use the existing database architecture where possible.

The logical entities needed by the timetable engine are:

```text
Section
Class
Teacher
Subject
TeacherAssignment
ClassSubject / SubjectRequirement
TeacherAvailability
SchoolTimetableConfiguration
TimetableDay
TimetablePeriod
TimetableEntry
```

Depending on the existing project, some of these may already exist under different names.

Do not duplicate existing entities.

First inspect the current codebase and reuse existing models and relationships.

---

# 25. Teacher Assignment

A teacher assignment should conceptually represent:

```text
teacherId
subjectId
classId
sectionId
```

Example:

```text
Teacher: 12
Subject: Mathematics
Class: Form 1A
Section: Grammar
```

The generator uses this relationship to know:

> Mr. John teaches Mathematics to Form 1A in Grammar.

---

# 26. Subject Requirement

A class-subject requirement should conceptually contain:

```text
classId
subjectId
periodsPerWeek
```

For example:

```text
classId: Form 1A
subjectId: Mathematics
periodsPerWeek: 5
```

This is the source of truth for how many lessons must appear in the timetable.

---

# 27. Teacher Availability

Teacher availability should conceptually support:

```text
teacherId
day
available
period
available
```

or another structure compatible with the existing application.

The implementation should not create unnecessary duplicate availability systems if one already exists.

---

# 28. Timetable Entry

Each generated timetable entry should conceptually contain:

```text
sectionId
classId
subjectId
teacherId
day
period
```

Potential additional fields:

```text
schoolId
academicYear
term
timetableVersion
createdAt
updatedAt
status
```

This makes the timetable reusable and versionable.

---

# 29. Timetable Versioning

The system should preferably support generated timetable versions.

For example:

```text
Grammar Timetable
Version 1
Version 2
Version 3
```

This allows the administrator to regenerate without destroying historical information immediately.

A generated timetable could have a status such as:

```text
DRAFT
GENERATED
PUBLISHED
ARCHIVED
```

The exact implementation should match the existing application's architecture.

---

# 30. Generation User Interface

The generation interface should be simple.

Example:

```text
------------------------------------------------
Generate Timetable
------------------------------------------------

Section

[ Grammar ▼ ]

------------------------------------------------

Section Information

Classes: 8
Teachers: 14
Subjects: 18

------------------------------------------------

[ Load Assignments ]

------------------------------------------------

Teacher Assignments

Teacher       Subject       Classes
Mr. John      Mathematics   Form 1A, Form 2A
Mrs. Mary     English       Form 1A, Form 1B
Mr. Peter     Physics       Form 3A, Form 4A

------------------------------------------------

[ Generate Timetable ]

------------------------------------------------
```

Before generation, the system should provide a summary.

For example:

```text
Section: Grammar

Classes: 8
Teachers: 14
Teacher assignments: 42
Required lessons: 236
Available teaching slots: 240
```

This is useful because the administrator can immediately identify obvious problems.

---

# 31. Pre-Generation Validation

Before attempting generation, run a feasibility check.

The system should check:

### Teacher capacity

Does the total number of lessons assigned to a teacher exceed the number of periods they can realistically teach?

### Class capacity

Does the class require more periods than the timetable provides?

### Section capacity

Does the section contain more required lessons than available class slots?

### Availability

Does every assigned lesson have at least one possible teacher slot?

### Working days

Can each teacher's required workload fit into their configured working days?

### Daily limits

Are the weekly requirements compatible with daily maximums?

If a problem is detected, do not attempt to generate blindly.

Show a useful message.

For example:

```text
Timetable cannot currently be generated.

Mr. John has 32 required teaching periods.

His current configuration allows a maximum of
25 periods per week.

Please adjust his workload or availability.
```

Another example:

```text
Form 2A requires 32 lessons per week,
but the class currently has only 30 available
teaching periods.

Please review the class timetable configuration.
```

---

# 32. Generation Result

After successful generation, display:

```text
Timetable Generated Successfully

Section: Grammar

Classes: 8
Teachers: 14
Required lessons: 236
Scheduled lessons: 236

Hard constraint violations: 0

Optimization score: 94%

[View Timetable]
[View Teacher Timetables]
[Validate]
[Save]
[Regenerate]
```

The exact score calculation can be implemented later, but the system should be designed so that timetable quality can be measured.

---

# 33. Class Timetable View

The generated timetable should be viewable by class.

Example:

```text
GRAMMAR — FORM 1A

              MON      TUE       WED       THU       FRI
------------------------------------------------------------
07:30-08:10   Maths    English   Physics   Maths     Biology
08:10-08:50   English  Maths     Biology   English   Maths
08:50-09:30   Physics  Biology   Maths     Chemistry English
09:30-10:00   BREAK    BREAK     BREAK     BREAK     BREAK
10:00-10:40   Biology  Chemistry English   Physics   Maths
...
```

The timetable must come from the actual generated entries.

Do not generate a separate class timetable manually.

---

# 34. Teacher Timetable View

The same generated timetable should also be viewable by teacher.

Example:

```text
MR. JOHN

              MON      TUE       WED       THU       FRI
------------------------------------------------------------
Period 1      Form 1A  Form 2A   Free      Form 3A   Form 1A
Period 2      Form 2A  Form 1A   Form 3A   Free      Form 2A
Period 3      Free     Form 3A   Form 1A   Form 2A   Form 3A
...
```

This allows the administrator to verify teacher workload.

---

# 35. Section Timetable View

There should also be a section-level view.

For example:

```text
Grammar

Classes:
Form 1A
Form 1B
Form 2A
Form 2B
...

[Select Class]

[View Section Timetable]
```

The section-level interface should make it easy to navigate between classes and teachers.

---

# 36. Validation After Generation

The system must perform a full validation after generation.

The validator should check:

```text
Every required lesson scheduled?
Every class free from conflicts?
Every teacher free from conflicts?
Teacher availability respected?
Teacher working days respected?
Teacher daily limits respected?
Class daily limits respected?
Breaks respected?
School timetable boundaries respected?
Correct number of periods for each subject?
```

For every class-subject combination:

```text
Required: 5
Scheduled: 5
Status: PASS
```

If:

```text
Required: 5
Scheduled: 4
Status: FAIL
```

the timetable is incomplete.

---

# 37. Validation Report

A useful validation report might look like:

```text
TIMETABLE VALIDATION

Section: Grammar

Hard Constraints
----------------------------
Teacher conflicts:       0
Class conflicts:         0
Availability conflicts:  0
Missing lessons:         0
Excess lessons:          0
Daily limit violations:  0
Break violations:        0

Result: VALID
```

If invalid:

```text
TIMETABLE VALIDATION

Result: INVALID

Problems:

1. Mr. John is scheduled in two classes
   on Monday Period 3.

2. Form 2A requires 5 Mathematics periods
   but only 4 were scheduled.

3. Mrs. Mary is scheduled on Wednesday,
   which is outside her configured availability.
```

The administrator should be able to understand exactly why generation failed.

---

# 38. Regeneration

The system should allow:

```text
Generate
Regenerate
```

If the timetable is poor or the administrator changes a teacher assignment, the system should be able to generate a new solution.

When regenerating:

* Do not blindly duplicate timetable entries.
* Either replace the draft version or create a new version.
* Ensure old generated entries do not interfere with the new generation.
* Preserve published timetables unless the administrator explicitly chooses to replace them.

---

# 39. Manual Adjustment After Generation

The ideal system should eventually allow an administrator to manually adjust a generated lesson.

For example:

```text
Form 1A
Monday Period 2
Mathematics → English
```

Before allowing the change, the system should validate:

```text
Is the teacher available?
Is the teacher already teaching another class?
Is the class already occupied?
Does the change violate a hard constraint?
```

If the change creates a conflict, show it immediately.

This turns the timetable into an intelligent editable schedule rather than a static generated document.

---

# 40. Important Difference Between Assignment and Timetable Entry

Do not confuse these two concepts.

### Assignment

```text
Mr. John teaches Mathematics to Form 1A.
```

This describes the teaching responsibility.

### Timetable entry

```text
Monday Period 2:
Mr. John teaches Mathematics to Form 1A.
```

This describes when that assignment occurs.

The generator converts assignments and requirements into timetable entries.

---

# 41. Important Difference Between Weekly Requirement and Daily Schedule

If Mathematics requires:

```text
5 periods/week
```

the database should not store five arbitrary timetable entries as the requirement.

The requirement is:

```text
Mathematics → Form 1A → 5 periods/week
```

The generated timetable then determines:

```text
Monday → Mathematics
Tuesday → Mathematics
Wednesday → Mathematics
Thursday → Mathematics
Friday → Mathematics
```

The timetable entries are the result of the generation process.

---

# 42. Handling Subjects With High Weekly Requirements

If a subject requires many periods per week, the generator should attempt to distribute them intelligently.

For example:

```text
Mathematics → 6 periods/week
```

should preferably be distributed over several days rather than placing six Mathematics periods into only two days, unless the school's constraints make that necessary.

A soft constraint can penalize excessive repetition.

---

# 43. Handling Double Periods

The architecture should support the possibility of double periods.

Some subjects may require:

```text
Double Period
```

For example:

```text
Physics Practical
Monday Period 5 + Period 6
```

If the existing application supports double periods, the generator must treat the two periods as one linked scheduling requirement.

The same teacher and class must remain occupied for both periods.

If double periods are not currently supported, design the lesson model so this feature can be added later.

---

# 44. Practical Subjects and Special Resources

Technical and other sections may eventually require special rooms or equipment.

For example:

```text
Computer Laboratory
Physics Laboratory
Chemistry Laboratory
Workshop
```

The architecture should therefore be extensible to include:

```text
Room
Resource
SubjectResourceRequirement
```

Then the generator can eventually enforce:

```text
Two classes cannot use the same laboratory simultaneously.
```

This may not need to be implemented in the first version, but the timetable engine should not be designed in a way that makes it impossible later.

---

# 45. Section Generation and Existing Timetables

When generating a section, the system must understand whether other sections already have generated timetables.

For example:

```text
Grammar → Generated
Technical → Not generated
Commercial → Not generated
```

When generating Technical, the system should know about existing Grammar teacher occupancy if teachers are shared.

Therefore, the generation engine should have access to existing timetable entries from other sections when checking teacher conflicts.

---

# 46. Do Not Assume Sections Are Completely Independent

Although the user interface generates sections separately, teachers may cross sections.

Therefore:

```text
Section generation = separate workflow
```

does NOT necessarily mean:

```text
Section scheduling = completely independent
```

The teacher is a shared resource.

The system must account for that.

---

# 47. Recommended Internal Structure

A clean architecture could look like:

```text
Timetable Generation Module

├── Section Loader
├── Class Loader
├── Teacher Assignment Loader
├── Subject Requirement Loader
├── Teacher Availability Loader
├── School Schedule Loader
├── Feasibility Checker
├── Lesson Builder
├── Slot Generator
├── Constraint Engine
├── Timetable Solver
├── Optimization Engine
├── Timetable Validator
├── Timetable Persistence Service
└── Timetable Presentation Service
```

The exact names can be changed to fit the existing project.

---

# 48. Backend Responsibilities

The backend should be responsible for:

* Loading section information
* Loading classes
* Loading teacher assignments
* Loading subjects
* Loading weekly period requirements
* Loading teacher availability
* Loading school timetable configuration
* Building lesson instances
* Checking feasibility
* Generating the timetable
* Validating the result
* Saving timetable entries
* Managing timetable versions
* Returning useful generation errors
* Returning timetable data for class and teacher views

Do not place the actual scheduling algorithm entirely in the frontend.

The frontend should request generation from the backend.

---

# 49. Frontend Responsibilities

The frontend should provide:

### Section selection

```text
[ Grammar ▼ ]
```

### Data preview

Show:

```text
Classes
Teachers
Subjects
Assignments
Period requirements
Teacher availability
```

### Generation controls

```text
[ Generate Timetable ]
```

### Progress state

For a complex timetable, show something such as:

```text
Preparing assignments...
Checking constraints...
Generating schedule...
Optimizing schedule...
Validating timetable...
```

### Results

Show:

```text
Generation successful
```

or:

```text
Generation failed
```

with meaningful reasons.

---

# 50. API Design

The exact endpoints must match the existing project architecture, but conceptually the backend may expose functionality similar to:

```text
GET /sections
GET /sections/{sectionId}/classes
GET /sections/{sectionId}/teachers
GET /sections/{sectionId}/assignments
GET /sections/{sectionId}/requirements
GET /sections/{sectionId}/generation-data
POST /timetables/generate
GET /timetables/{id}
GET /timetables/{id}/classes/{classId}
GET /timetables/{id}/teachers/{teacherId}
POST /timetables/{id}/validate
POST /timetables/{id}/regenerate
```

Do not blindly create these exact endpoints if equivalent endpoints already exist.

First inspect the existing backend and integrate with the current API conventions.

---

# 51. Generation Request

A generation request should conceptually contain:

```text
sectionId
academicYear
term
```

Potential options:

```text
optimizationLevel
allowManualOverrides
respectExistingTimetables
```

But keep the first implementation simple.

The generator should be able to infer most information from the database.

---

# 52. Generation Response

A successful response should provide enough information for the frontend to display the result.

Conceptually:

```text
generationId
sectionId
status
scheduledLessons
totalRequiredLessons
hardConstraintViolations
softConstraintScore
validationResult
```

If generation fails:

```text
status
reason
violations
unscheduledLessons
```

This is much better than simply returning:

```text
Generation failed.
```

---

# 53. Failed Generation Must Be Explainable

This is extremely important.

If the timetable cannot be generated, the system should explain why.

For example:

```text
Unable to generate a complete Grammar timetable.

3 lessons could not be scheduled.

Unscheduled:

Form 3A
Physics
Mr. Peter
Required: 3 periods
Scheduled: 2 periods

Possible cause:

Mr. Peter is available only Monday,
Tuesday and Thursday, but the current
workload requires more available slots.

Recommended action:

Increase teacher availability or reduce
the assigned workload.
```

The system should help the administrator fix the data rather than simply saying that generation failed.

---

# 54. Feasibility Calculation

Before running the full solver, calculate basic capacity.

For a class:

```text
Total required lessons
```

must not exceed:

```text
Available class teaching slots
```

For a teacher:

```text
Total assigned teaching periods
```

must be compatible with:

```text
Available working days × daily capacity
```

However, capacity calculations are only preliminary.

A timetable can still be impossible even when total capacity looks sufficient because of specific availability and collision constraints.

Therefore:

```text
Capacity check
```

is a quick early warning, not the final feasibility test.

---

# 55. Example

Suppose Grammar contains:

```text
Form 1A
Form 1B
Form 2A
```

Teachers:

```text
Mr. John
Mrs. Mary
Mr. Peter
```

Assignments:

```text
Mr. John
    Mathematics → Form 1A → 5 periods
    Mathematics → Form 1B → 5 periods
    Mathematics → Form 2A → 5 periods

Mrs. Mary
    English → Form 1A → 5 periods
    English → Form 1B → 5 periods
    English → Form 2A → 4 periods

Mr. Peter
    Physics → Form 1A → 3 periods
    Physics → Form 2A → 4 periods
```

The generator creates:

```text
Form 1A
    Mathematics × 5
    English × 5
    Physics × 3

Form 1B
    Mathematics × 5
    English × 5

Form 2A
    Mathematics × 5
    English × 4
    Physics × 4
```

It now has to place all of these lessons.

It cannot place:

```text
Monday Period 1

Mr. John → Form 1A
Mr. John → Form 1B
```

because that violates the teacher constraint.

Instead it might produce:

```text
Monday Period 1

Form 1A → Mathematics → Mr. John
Form 1B → English → Mrs. Mary
Form 2A → Physics → Mr. Peter
```

and continue filling the schedule.

---

# 56. Important Data Integrity Rules

The timetable generator should never silently ignore invalid assignments.

If a class has:

```text
Mathematics → 5 periods/week
```

but no teacher is assigned to Mathematics for that class, generation should fail with a clear error.

If a teacher is assigned but the subject does not exist, report the data problem.

If a subject requirement exists without a valid class, report it.

If a teacher has zero available slots but has assigned lessons, report it.

The generator must expose data problems before attempting to produce an apparently valid timetable.

---

# 57. Database Integrity

Where appropriate, enforce relationships at the database level.

For example:

```text
TeacherAssignment
    teacher_id → Teacher
    subject_id → Subject
    class_id → Class
```

and:

```text
SubjectRequirement
    class_id → Class
    subject_id → Subject
```

The exact database implementation should follow the existing project.

Avoid duplicating information unnecessarily.

For example, if a class already belongs to a section, do not store a second independent section relationship in every timetable entry unless there is a clear reason.

---

# 58. Uniqueness Rules

Consider enforcing appropriate uniqueness.

For example:

```text
Class + Subject
```

should normally have one active weekly requirement.

And a timetable entry should not allow:

```text
Class + Day + Period
```

to appear twice.

Similarly:

```text
Teacher + Day + Period
```

should not appear twice within the same scheduling scope.

Database constraints can provide a final layer of protection even if the scheduling algorithm already checks them.

---

# 59. Transaction Safety

Timetable generation should be handled safely.

Do not partially save hundreds of timetable entries and then leave the database in an inconsistent state if generation fails.

A safer approach is:

```text
Generate in memory
        ↓
Validate
        ↓
If valid
    Save transaction
        ↓
Commit
```

If generation fails:

```text
Rollback
```

This ensures the database does not contain half-generated timetables.

---

# 60. Draft Generation

For complex schedules, consider generating into a temporary/draft state first.

For example:

```text
DRAFT
    ↓
VALIDATED
    ↓
PUBLISHED
```

This allows the administrator to inspect the result before publishing it.

---

# 61. Publishing

A timetable should only become the official timetable after validation.

For example:

```text
Generated
    ↓
Validated
    ↓
Administrator reviews
    ↓
Published
```

Once published, teachers and students can use it.

---

# 62. Final Validation Checklist

Before a timetable is considered complete, the system must verify:

```text
[ ] Every required class-subject period is scheduled.
[ ] No class has two lessons at the same time.
[ ] No teacher has two lessons at the same time.
[ ] No teacher is scheduled outside availability.
[ ] No lesson is placed during a break.
[ ] No lesson is outside school hours.
[ ] Teacher daily limits are respected.
[ ] Class daily limits are respected.
[ ] Teacher working-day requirements are respected.
[ ] Required weekly subject frequencies are satisfied.
[ ] Existing cross-section teacher conflicts are respected.
[ ] No duplicate timetable entries exist.
[ ] All timetable entries reference valid classes.
[ ] All timetable entries reference valid teachers.
[ ] All timetable entries reference valid subjects.
```

Only after these checks pass should the timetable be considered valid.

---

# 63. Performance

The system should be designed with performance in mind.

A section may contain:

```text
10+ classes
20+ teachers
20+ subjects
hundreds of weekly lessons
```

The generator should therefore not repeatedly query the database for every individual placement.

Prefer:

```text
Load required data
        ↓
Build an in-memory scheduling model
        ↓
Run the solver
        ↓
Validate
        ↓
Persist the result
```

This will be much more efficient.

---

# 64. Do Not Put Business Logic in the UI

The frontend should not determine whether a teacher is available.

The frontend can display availability.

The backend should be the authority for:

* Constraints
* Teacher conflicts
* Class conflicts
* Period requirements
* Generation
* Validation

This prevents users from bypassing timetable rules through frontend manipulation.

---

# 65. Recommended Development Order

Implement this feature incrementally.

## Phase 1 — Data Retrieval

Build functionality to retrieve:

```text
Selected section
Classes
Teachers
Teacher assignments
Subjects
Period requirements
Teacher availability
School timetable configuration
```

Verify the retrieved data before writing the generator.

## Phase 2 — Generation Data Model

Build the internal representation of:

```text
Lesson
TimetableSlot
TeacherAvailability
ClassAvailability
Constraints
```

## Phase 3 — Feasibility Validation

Implement checks for:

```text
Missing teacher
Missing subject
Missing requirement
Insufficient class capacity
Insufficient teacher capacity
Invalid availability
```

## Phase 4 — Basic Generator

Generate a valid timetable using hard constraints.

Do not optimize heavily yet.

The first goal is:

```text
0 hard constraint violations
```

## Phase 5 — Optimization

Add:

```text
Subject distribution
Teacher workload balancing
Consecutive period reduction
Gap reduction
Working-day optimization
```

## Phase 6 — Validation

Build the complete validation engine.

## Phase 7 — Persistence

Save valid timetables safely.

## Phase 8 — User Interface

Build:

```text
Section selection
Data preview
Generate button
Generation progress
Result
Validation report
Class view
Teacher view
```

## Phase 9 — Regeneration

Allow the administrator to regenerate a section.

## Phase 10 — Cross-Section Validation

Ensure teachers shared between sections cannot be scheduled simultaneously.

---

# 66. Important Instruction to the AI Developer

Before implementing anything, inspect the existing project.

Determine:

* Existing database schema
* Existing Section model
* Existing Class model
* Existing Teacher model
* Existing Subject model
* Existing teacher assignment implementation
* Existing school timetable configuration
* Existing working days
* Existing period configuration
* Existing break configuration
* Existing frontend components
* Existing backend services
* Existing controllers
* Existing repositories
* Existing API conventions

Do not create duplicate models when an equivalent model already exists.

Do not replace existing timetable configuration.

Extend the current implementation.

Use the existing architecture, naming conventions, authentication, database relationships, API structure, validation patterns, and frontend design system.

Before writing new code, explain which existing components will be reused and which new components are actually necessary.

---

# 67. Core Concept the Implementation Must Follow

The most important conceptual model is:

```text
SECTION
   ↓
CLASSES
   ↓
CLASS + SUBJECT
   ↓
TEACHER ASSIGNMENT
   ↓
WEEKLY PERIOD REQUIREMENT
   ↓
REQUIRED LESSON INSTANCES
   ↓
AVAILABLE TIMETABLE SLOTS
   ↓
CONSTRAINT SOLVER
   ↓
VALID TIMETABLE
```

The teacher is a shared resource.

The class is a shared resource.

The timetable slot is a shared resource.

Therefore, the solver must coordinate all three.

---

# 68. Final Expected Workflow

The complete user workflow should eventually look like this:

```text
Administrator opens Timetable Generator
                ↓
Selects "Grammar"
                ↓
System loads all Grammar classes
                ↓
System identifies all teachers teaching Grammar
                ↓
System loads teacher-subject-class assignments
                ↓
System loads weekly period requirements
                ↓
System loads teacher working days
                ↓
System loads teacher availability
                ↓
System loads existing school timetable configuration
                ↓
System displays a generation summary
                ↓
Administrator reviews the information
                ↓
Administrator clicks "Generate Timetable"
                ↓
System performs feasibility checks
                ↓
System creates required lesson instances
                ↓
System creates available timetable slots
                ↓
System applies hard constraints
                ↓
System generates a conflict-free timetable
                ↓
System optimizes the timetable using soft constraints
                ↓
System performs complete validation
                ↓
If invalid:
    Show detailed problems
    Do not publish
                ↓
If valid:
    Show timetable
                ↓
Administrator reviews
                ↓
Save / Publish
                ↓
Grammar timetable completed
                ↓
Administrator moves to Technical
                ↓
Repeat the same process
                ↓
Commercial
                ↓
Repeat the same process
```

---

# 69. Final Architectural Goal

The final system should not be thought of as a simple timetable table with subjects randomly inserted into cells.

It should be treated as a **school scheduling engine**.

The system receives:

```text
School timetable structure
+
Section
+
Classes
+
Teachers
+
Teacher assignments
+
Subjects
+
Class-subject period requirements
+
Teacher working days
+
Teacher availability
+
Teacher workload limits
+
Class constraints
+
Existing timetable information
```

and produces:

```text
A complete, conflict-free, optimized timetable
```

for the selected section.

The timetable should then be available as:

```text
Section timetable
Class timetable
Teacher timetable
```

all generated from the same underlying timetable data.

The most important requirements are:

1. **Generate one section at a time.**
2. **Automatically identify the teachers involved in that section.**
3. **Understand every Teacher → Subject → Class assignment.**
4. **Know exactly how many periods each subject requires for each class every week.**
5. **Know how many days and periods each teacher is allowed or expected to work.**
6. **Use the school's existing working-day, period, time, and break configuration.**
7. **Prevent teacher conflicts.**
8. **Prevent class conflicts.**
9. **Respect teacher availability.**
10. **Respect weekly period requirements.**
11. **Respect daily workload limits.**
12. **Handle teachers shared between sections.**
13. **Use hard constraints to guarantee validity.**
14. **Use soft constraints to improve timetable quality.**
15. **Validate the entire timetable before saving or publishing it.**
16. **Explain clearly when a timetable cannot be generated.**
17. **Allow regeneration when necessary.**
18. **Keep the architecture extensible for rooms, laboratories, double periods, practical subjects, and additional constraints later.**
19. **Reuse the existing school timetable configuration and existing application architecture.**
20. **Do not implement the generator as simple random slot filling.**

The end result should be a timetable generation engine that can take a complete section such as **Grammar**, understand every teaching requirement and every relevant teacher constraint, and intelligently construct the best possible timetable for that entire section before moving on to the next section..md file read it
