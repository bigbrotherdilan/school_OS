# School OS — Timetable Generation Algorithm

## Complete Technical Specification (English Algorithm)

---

## 1. Overview

The School OS timetable generator is a **constraint programming system** built on **Google OR-Tools CP-SAT**. It produces conflict-free school timetables for Cameroonian bilingual schools (Anglophone/Francophone sections) with support for parallel student groups, double periods, half-day schedules, teacher unavailability, and cross-section resource sharing.

**Key Design Principle**: *"Sections are generation scopes; the school is the resource universe."*

---

## 2. Core Concepts & Data Model

### 2.1 Generation Units

| Concept                     | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **Timetable**         | One class × one term. Contains period grid, working days, blocked slots.             |
| **Lesson**            | A subject × weekly volume × teacher × optional student group. The "card" to place. |
| **TeacherAllocation** | Split of a lesson's weekly volume across multiple teachers (or TBD placeholders).     |
| **StudentGroup**      | Configurable groups inside a class (Arts/Science/Commercial). Null = full cohort.     |
| **TimeSlot**          | One placed lesson occurrence: day, start/end, subject, teacher, group, room.          |

### 2.2 Period Grid (The Week Template)

Each timetable defines:

- `periods`: Base period list (e.g., 07:30–08:20, 08:20–09:10, ...)
- `working_days`: Days lessons run (1=Mon ... 5=Fri)
- `day_periods`: Per-day overrides for half-day schedules
- `blocked_slots`: Breaks, lunch, assembly — **no lesson may occupy these**

### 2.3 Three Generation Modes

| Mode                  | Target                                            | Fixed Resources                            |
| --------------------- | ------------------------------------------------- | ------------------------------------------ |
| **School-wide** | All timetables of the term                        | None (first generation)                    |
| **Section**     | One section's classes (e.g., Form 4 Arts+Science) | Committed/locked slots of other sections   |
| **Repair**      | One class                                         | Every other class's committed/locked slots |

> **Resource Ownership Rule**: Only **COMMITTED** timetables (APPROVED/PUBLISHED) reserve school-wide teacher occupancy. Drafts and generated-but-uncommitted timetables **never** block anyone.

---

## 3. The Card System (Scheduling Units)

Each **Lesson** becomes one or more **Cards**:

```
Lesson WITH TeacherAllocations → One card per allocation
Lesson WITHOUT allocations      → One card for whole lesson (taught by Lesson.teacher)
Card with NULL teacher          → UNASSIGNED placeholder ("Teacher X / TBD") — schedules without reserving real teacher resource
```

**Card properties**: `id`, `lesson`, `timetable`, `subject`, `teacher`, `student_group`, `periods` (weekly count), `is_double`, `note`.

---

## 4. Hard Constraints (Must Be Satisfied)

The CP-SAT model enforces these **non-negotiable** constraints:

### 4.1 Student-Group Non-Overlap (Per Class, Per Slot)

```
For each class, each student group, each day, each period:
    Sum of cards covering that group at that slot ≤ 1
```

- **Parallel streams allowed**: Group A lesson ∩ Group B lesson = NO clash
- **Full-cohort lesson** (group=None) covers ALL groups → clashes with anything
- A class with no StudentGroups behaves as a single implicit group

### 4.2 Teacher Non-Double-Booking (Global Across School)

```
For each teacher, each day, each period:
    Sum of their cards at that slot ≤ 1
```

- Teachers are **global resources**: a teacher NEVER teaches two classes at once
- Applies across ALL sections in the generation scope

### 4.3 Weekly Volume Fully Scheduled

```
For each card:
    Sum of its x[card, day, period] over all slots = card.periods
```

Every required weekly period must be placed.

### 4.4 Teacher Unavailability Windows

```
For each teacher unavailability window (day, start, end):
    For each period overlapping the window:
        x[card, day, period] = 0  (for all cards of that teacher)
```

### 4.5 School Blocked Periods (Breaks/Lunch/Assembly)

```
For each blocked slot (day, start, end):
    For each period overlapping the block:
        x[card, day, period] = 0  (for ALL cards)
```

### 4.6 Cross-Section Committed Teacher Blocks

```
For each committed (APPROVED/PUBLISHED) timetable NOT in target scope:
    Its locked + all slots become teacher blocks for the solver
```

Non-target committed timetables' teachers are treated as unavailable.

### 4.7 Locked Slots Stay Fixed

```
For each locked TimeSlot in target timetables:
    x[card, day, period] = 1  (where card matches the slot)
```

Locked slots are immovable anchors.

### 4.8 Double Periods = HARD Consecutive Same-Day Blocks

```
For each double-period card requiring N periods/week:
    Required double sessions = N // 2
    Required single sessions = N % 2
  
    Each double session = 2 consecutive periods on SAME DAY
    The solver NEVER silently splits a double into singles
```

If the grid cannot host every required double session → **infeasible** with diagnostic.

### 4.9 Half-Day Grid Boundaries

```
Lessons never appear beyond the day's configured periods
(periods_for_day(day) defines the valid grid for that day)
```

### 4.10 Allocation Volume Integrity

```
For lessons with multiple TeacherAllocations:
    Sum of allocation.periods == lesson.periods_per_week
```

Split allocations must exactly sum to the required weekly volume.

---

## 5. Soft Constraints (Weighted Objective Minimization)

The solver **minimizes** a weighted sum of penalty terms:

| # | Soft Constraint                             | Weight   | Description                                                                                                 |
| - | ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| 1 | **No subject 3+ times/day**           | 10,001   | Excess periods beyond 2 per day per card                                                                    |
| 2 | **Balanced class weeks**              | 6/day    | Daily load deviation from ideal (total_hours / days)                                                        |
| 3 | **Compact class days**                | 5/day    | Span (last_period - first_period + 1) per class per day                                                     |
| 4 | **Teacher compactness**               | 10/day   | Teacher's daily span                                                                                        |
| 5 | **Teacher working days**              | 20/day   | Penalty for each day a teacher works (minimize days)                                                        |
| 6 | **Core subjects not late**            | 1/slot   | Coefficient ≥ 3 subjects penalized in last 3 periods                                                       |
| 7 | **Cognitive load / time preferences** | 0–1000  | Based on subject cognitive_demand, time_preference, morning/afternoon preference, class fatigue_sensitivity |
| 8 | **Double session rewards**            | -60/pair | In relaxation mode: reward placing double sessions                                                          |

**Priority Hierarchy**: Hard constraints > Volume/Doubles > Cross-section > Teacher/Room > Pedagogical

---

## 6. Cognitive Load & Pedagogical Scoring

Each subject has configurable preferences:

- `cognitive_demand`: LOW(1) / MEDIUM(2) / HIGH(3)
- `time_preference`: early / middle / late / flexible
- `morning_preference`: 0–100
- `afternoon_preference`: 0–100
- `late_day_penalty`: 0–100

Each class has:

- `fatigue_sensitivity`: 1(LOW) … 5(HIGH)

**Penalty Calculation**:

```
period_bucket = early(0.00–0.30) / middle(0.30–0.60) / late(0.60–1.00)
              (relative position within day's available teaching periods)

time_penalty = f(bucket, subject preferences, time_preference)
demand_weight = cognitive_demand / 2.0          (0.5, 1.0, 1.5)
fatigue_weight = class.fatigue_sensitivity / 2.0 (0.5 … 2.5)

penalty = time_penalty × demand_weight × fatigue_weight × 100
          → clamped to [0, 1000]
```

For double periods: average penalty of both periods applied to the pair variable.

---

## 7. Generation Pipeline

### Step 1: Pre-Validation (Fast Fail)

Before building the CP-SAT model:

1. **Grid Compatibility Check**: All target classes must share identical week template (days + per-day periods).
2. **Capacity Check**:
   - Class/group required volume ≤ total available slots per week
   - Teacher required volume ≤ free cells (after unavailability + blocks + other sections)
   - Allocation volumes sum correctly
3. **Locked Slot Conflict Check**: No two locked slots of same teacher overlap.

### Step 2: Build CP-SAT Model

- Create boolean variable `x[card, day, period]` for each target card × each slot in grid
- Add all hard constraints
- Add soft objective terms with weights

### Step 3: Solve (Strict Mode)

- Time limit: 90 seconds (configurable)
- 4 search workers
- If **OPTIMAL** or **FEASIBLE** → materialize solution

### Step 4: Relaxation Pass (If Infeasible)

If strict solve fails:

- Rebuild model with **relaxed** constraints:
  - Student/teacher clashes allowed (penalty variables with huge weight: 10,000)
  - Volume ≤ required (not ==)
  - Double sessions rewarded, not required
- Solve relaxed model
- Diagnose **why** infeasible:
  - Unplaced periods (missing volume)
  - Student overbooked slots
  - Teacher overbooked slots
  - Double session deficit (required vs. placeable)

### Step 5: Materialize Solution

- Delete all non-locked TimeSlots of target timetables
- Create new TimeSlots from solver variable assignments
- Update timetable: `generation_status=GENERATED`, `generation_score=objective_value`, `last_generated_at=now`

---

## 8. Validation & Conflict Detection

The system provides **two validation layers**:

### 8.1 Section Validation (`validate_section`)

Checks same hard constraints the solver enforces:

- Teacher conflicts (within section)
- Student-group conflicts (within section, group-aware)
- Teacher availability violations
- Room double-booking
- Boundary/blocked-period guards
- Weekly volume compliance
- Double-period integrity (consecutive same-day pairs)

### 8.2 School-Level Validation (`validate_section_against_school`)

Checks generated section against **committed** school schedule:

- Teacher cross-section clashes with APPROVED/PUBLISHED timetables
- Room cross-section clashes
- Only committed timetables are checked (drafts ignored)

### 8.3 Per-Slot Conflict State (UI Rendering)

Each TimeSlot gets a color state:

| Color     | Level   | Meaning                                          |
| --------- | ------- | ------------------------------------------------ |
| 🔴 Red    | error   | Hard clash: must fix before commit               |
| 🟡 Yellow | warning | Availability override: teacher approved anyway   |
| ⚫ Gray   | info    | Unassigned teacher (TBD) — reserves no resource |
| 🟢 Green  | valid   | Clean slot                                       |

**Precedence**: Red > Yellow > Gray > Green

---

## 9. Key Algorithms (Pseudocode)

### 9.1 Student Group Overlap Detection

```python
def group_coverage(class_groups, lesson_group_id):
    if not class_groups:              # No groups defined → single implicit group
        return {None}
    if lesson_group_id is None:       # Full-cohort lesson
        return set(class_groups)      # Covers ALL groups
    return {lesson_group_id}          # Covers only its group

def slot_group_overlap(timetable, group_a, group_b):
    # True if same students would attend both
    if group_a is None or group_b is None:
        return True  # Full cohort overlaps with everything
    return group_a == group_b  # Only same parallel group overlaps
```

### 9.2 Double Period Integrity Check

```python
def validate_double_periods(lesson_slots, periods_per_week):
    expected_pairs = periods_per_week // 2
    expected_singles = periods_per_week % 2
  
    for each day:
        sort slots by start_time
        i = 0
        while i < len(day_slots):
            if i+1 < len and consecutive(day_slots[i], day_slots[i+1]):
                counted_pairs += 1
                i += 2
            else:
                counted_singles += 1
                i += 1
  
    return counted_pairs == expected_pairs and counted_singles == expected_singles
```

### 9.3 Capacity Check (Teacher)

```python
def teacher_free_cells(teacher_id, grid, unavailability, blocked_school, other_blocks):
    free = 0
    for day, periods in grid:
        for period in periods:
            p_start, p_end = period.start, period.end
            blocked = any(overlaps(p_start, p_end, s, e) 
                          for s,e in other_blocks.get((teacher_id, day), []))
                   or any(overlaps(p_start, p_end, s, e) 
                          for s,e in unavailability[teacher_id].get(day, []))
                   or any(overlaps(p_start, p_end, s, e) 
                          for s,e in blocked_school.get(day, []))
            if not blocked:
                free += 1
    return free
```

---

## 10. Configuration & Customization Points

### 10.1 Period Templates

```python
DEFAULT_PERIODS = [
    {'start': '07:30', 'end': '08:20'},
    {'start': '08:20', 'end': '09:10'},
    {'start': '09:10', 'end': '10:00'},
    {'start': '10:30', 'end': '11:20'},  # break after 3rd
    {'start': '11:20', 'end': '12:10'},
    {'start': '12:10', 'end': '13:00'},
    {'start': '13:40', 'end': '14:30'},  # lunch break
    {'start': '14:30', 'end': '15:20'},
    {'start': '15:20', 'end': '16:10'},
]
```

### 10.2 Subject Cognitive Properties

```python
class Subject(models.Model):
    cognitive_demand = IntegerChoices(LOW=1, MEDIUM=2, HIGH=3)
    time_preference = TextChoices(EARLY, MIDDLE, LATE, FLEXIBLE)
    morning_preference = IntegerField(0-100, default=50)
    afternoon_preference = IntegerField(0-100, default=50)
    late_day_penalty = IntegerField(0-100, default=30)
    is_double_preferred = BooleanField(default=False)
```

### 10.3 Class Fatigue Sensitivity

```python
class Class(models.Model):
    fatigue_sensitivity = IntegerChoices(
        LOW=1, MEDIUM_LOW=2, MEDIUM=3, MEDIUM_HIGH=4, HIGH=5
    )
    # Younger classes (Form 1-2) should have HIGHER sensitivity
```

### 10.4 Soft Constraint Weights (Adjustable in solver.py)

```python
# In _build_model():
penalties.append((excess, 10001))      # 3+ periods/day
penalties.append((span, 5))             # Class day compactness
penalties.append((span, 10))            # Teacher day compactness
penalties.append((has_day, 20))         # Teacher working days
penalties.append((slot_var, 1))         # Core subjects not late
# Cognitive load penalties: 0-1000 range
```

---

## 11. Diagnostics & Error Reporting

When generation fails, the system returns **actionable diagnostics**:

```json
{
  "ok": false,
  "status": "infeasible",
  "message": "The week cannot be scheduled without clashes. Closest attempt:\n- 4 lesson period(s) could not be placed at all.\n- 2 slot(s) would give a student group two lessons at once.\n- 3 slot(s) would double-book a teacher.\n- 1 of the 4 required double session(s) cannot be placed as consecutive same-day blocks.\nHint: reduce weekly hours, add periods/days, free teacher availability, or redistribute subjects across teachers.",
  "diagnostics": {
    "unplaced_periods": 4,
    "student_overbooked_slots": 2,
    "teacher_overbooked_slots": 3,
    "required_double_sessions": 4,
    "placeable_double_sessions": 3
  }
}
```

---

## 12. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATION REQUEST                           │
│  (timetables, target_ids, mode: school/section/repair)          │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRE-VALIDATION                             │
│  • Grid compatibility  • Capacity checks  • Lock conflicts     │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CP-SAT MODEL BUILDER                         │
│  • Cards (lessons + allocations)                                │
│  • Variables: x[card, day, period] ∈ {0,1}                     │
│  • HARD: student, teacher, volume, unavailability, blocks,     │
│           locked, doubles, boundaries, allocations             │
│  • SOFT: gaps, balance, teacher days, core subjects, cognitive │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STRICT SOLVE                               │
│  OR-Tools CP-SAT (90s, 4 workers)                               │
└──────────────────────────┬──────────────────────────────────────┘
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
   ┌─────────────┐                      ┌─────────────┐
   │  FEASIBLE   │                      │  INFEASIBLE │
   └──────┬──────┘                      └──────┬──────┘
          ▼                                   ▼
   ┌─────────────┐                      ┌─────────────┐
   │ MATERIALIZE │                      │  RELAXATION │
   │  TimeSlots  │                      │    PASS     │
   └─────────────┘                      └──────┬──────┘
                                               ▼
                                      ┌─────────────────┐
                                      │  DIAGNOSE WHY   │
                                      │  (student clash │
                                      │   teacher clash │
                                      │   missing vol   │
                                      │   double defic) │
                                      └─────────────────┘
```

---

## 13. Files Reference

| File                 | Purpose                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `solver.py`        | Core CP-SAT model, constraints, objective, solve pipeline                                 |
| `models.py`        | Timetable, TimeSlot, Lesson, TeacherAllocation, StudentGroup, Room, TeacherUnavailability |
| `section_tools.py` | Section-level preview, feasibility check, validation                                      |
| `conflicts.py`     | Per-slot conflict detection for UI/ (red/yellow/gray/green)                              |
| `pdf_export.py`    | Timetable PDF generation                                                                  |
| `views.py`         | API endpoints for generation, validation, preview                                         |

---

*Generated from School OS backend codebase — `backend/apps/timetable/`*
*Algorithm version: Section-Based Generation with Shared Teacher Availability & Manual Scheduling Architecture*
