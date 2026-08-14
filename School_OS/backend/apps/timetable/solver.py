"""
Automatic school-wide timetable generation using Google OR-Tools CP-SAT.

Architecture: "Sections are generation scopes; the school is the resource
universe." (see Docs/"School OS Timetable — Section-Based Generation, Shared
Teacher Availability & Manual Scheduling Architecture").

  - The period grid is the school day (`Timetable.periods`, `day_periods`
    for half-days, `blocked_slots` for breaks/lunch/assembly).
  - A class is NOT automatically one student group. Classes may define
    `StudentGroup`s (Arts/Science/Commercial); a subject allocation may target
    one group, and parallel subjects may run at the same time in one class.
  - The real student clash rule is group coverage overlap:
        full-cohort lesson  ∩  anything          -> clash
        group A lesson      ∩  group B lesson    -> NO clash
  - Teachers are global resources: a teacher NEVER teaches two classes at once.

Scheduling units are CARDS (spec §11-13): each lesson becomes one card per
`TeacherAllocation` (multi-teacher split), or a single card taught entirely by
`Lesson.teacher` when the lesson has no allocations. A card with a NULL teacher
is an explicit UNASSIGNED placeholder ("Teacher X / TBD", spec §8-10): it is
scheduled without reserving any real teacher resource.

Resource ownership (spec §6-7): only COMMITTED timetables (APPROVED/PUBLISHED)
reserve school-wide teacher occupancy. Drafts and generated-but-uncommitted
timetables never block anyone. Therefore the generator, in any mode, only
respects the locked slots and committed slots of non-target timetables.

Three generation modes (spec §4-5):
  - school-wide:  target_ids = all timetables of the term.
  - section:      target_ids = one section's classes (e.g. Form 4 Arts+Science);
                  committed/locked slots of other sections are fixed blocks.
  - repair:       target_ids = one class; every other class's committed/locked
                  slots become fixed teacher blocks.

Hard constraints guarantee:
  - no student-group overlap per slot per class (parallel streams allowed)
  - a teacher NEVER teaches two classes at once
  - every card's weekly volume is fully scheduled
  - teacher unavailability windows are respected
  - blocked periods (break/lunch/assembly) contain no lessons
  - half-day grids: lessons never appear beyond the day's configured periods
  - locked slots (and, outside the targets, committed slots) stay fixed
  - double periods (is_double) are HARD same-day consecutive blocks: a
    lesson of n periods is n//2 double sessions + (n%2) single session,
    and the solver never silently splits a double into singles — if the
    grid cannot host every double session the solve reports infeasible
    with a diagnostic of how many doubles could be placed.

Soft constraints (weighted objective) minimise:
  - gaps ("trous") in each class day
  - gaps in a teacher's day (vacataires travel between schools)
  - the number of distinct days each teacher works
  - heavy subject concentration (no subject 3+ times in one day per class)
  - unbalanced class weeks (one day heavily overloaded)
  - core subjects placed in the afternoon

If the model is infeasible, a relaxation pass re-solves with the
teacher/student clash constraints softened, so we can report exactly
*why* a timetable is impossible.
"""
from collections import defaultdict
from datetime import time

from django.utils import timezone
from ortools.sat.python import cp_model


def _to_time(value):
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        parts = value.split(':')
        return time(int(parts[0]), int(parts[1]))
    return value


def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def _period_index(periods, slot):
    """Find the period index matching a slot's start time, else None."""
    start = slot.start_time
    for idx, period in enumerate(periods):
        if _to_time(period['start']) == start:
            return idx
    return None


def _group_coverage(groups, lesson_group_id):
    """
    The set of students a lesson covers, expressed as group keys.

    A class with no StudentGroups behaves as a single implicit group (None),
    so lessons never overlap-free. A lesson with group None in a class that
    HAS groups is a full-cohort lesson: it covers every group.
    """
    if not groups:
        return {None}
    if lesson_group_id is None:
        return set(groups)
    return {lesson_group_id}


class _Card:
    """
    One schedulable unit. A lesson with TeacherAllocations yields one card
    per allocation; otherwise one card for the whole lesson.
    """
    __slots__ = (
        'id', 'lesson', 'lesson_id', 'timetable_id', 'subject', 'subject_id',
        'teacher', 'teacher_id', 'student_group', 'student_group_id',
        'periods', 'is_double', 'note',
    )

    def __init__(self, id, lesson, timetable_id, subject, subject_id, teacher,
                 teacher_id, student_group, student_group_id, periods,
                 is_double, note):
        self.id = id
        self.lesson = lesson
        self.lesson_id = lesson.id
        self.timetable_id = timetable_id
        self.subject = subject
        self.subject_id = subject_id
        self.teacher = teacher
        self.teacher_id = teacher_id
        self.student_group = student_group
        self.student_group_id = student_group_id
        self.periods = periods
        self.is_double = is_double
        self.note = note or ''

    def has_teacher(self):
        return self.teacher_id is not None


class SchoolSolver:
    def __init__(self, timetables, target_ids=None, time_limit_seconds=90):
        self.timetables = list(timetables)
        self.target_ids = set(target_ids) if target_ids is not None else {t.id for t in self.timetables}
        self.time_limit = time_limit_seconds
        self.repair_mode = len(self.target_ids) == 1
        self.cards = self._load_cards()
        self.by_timetable = defaultdict(list)
        for card in self.cards:
            self.by_timetable[card.timetable_id].append(card)

        # student groups per class: timetable_id -> [group ids]
        self.groups_by_class = defaultdict(list)
        from .models import StudentGroup
        for tt in self.timetables:
            self.groups_by_class[tt.id] = list(
                StudentGroup.objects.filter(academic_class=tt.class_obj)
                .values_list('id', flat=True)
            )

    # ------------------------------------------------------------------ #
    #  Data helpers                                                      #
    # ------------------------------------------------------------------ #
    def _load_cards(self):
        """
        Cards from lessons: one per TeacherAllocation, or one whole-lesson
        card. A NULL allocation teacher => unassigned placeholder (TBD).
        """
        from .models import Lesson, TeacherAllocation
        cards = []
        lessons = Lesson.objects.filter(
            timetable__in=self.timetables
        ).select_related('subject', 'teacher', 'timetable', 'student_group').all()
        allocs = TeacherAllocation.objects.filter(
            lesson__timetable__in=self.timetables
        ).select_related('lesson', 'teacher', 'lesson__subject').order_by('created_at')
        allocs_by_lesson = defaultdict(list)
        for a in allocs:
            allocs_by_lesson[a.lesson_id].append(a)

        for lesson in lessons:
            lesson_allocs = allocs_by_lesson.get(lesson.id, [])
            if lesson_allocs:
                for a in lesson_allocs:
                    cards.append(_Card(
                        id=f'a:{a.pk}',
                        lesson=lesson,
                        timetable_id=lesson.timetable_id,
                        subject=lesson.subject,
                        subject_id=lesson.subject_id,
                        teacher=a.teacher,
                        teacher_id=a.teacher_id,
                        student_group=lesson.student_group,
                        student_group_id=lesson.student_group_id,
                        periods=a.periods,
                        is_double=a.is_double,
                        note=a.note or lesson.note,
                    ))
            else:
                cards.append(_Card(
                    id=f'l:{lesson.pk}',
                    lesson=lesson,
                    timetable_id=lesson.timetable_id,
                    subject=lesson.subject,
                    subject_id=lesson.subject_id,
                    teacher=lesson.teacher,
                    teacher_id=lesson.teacher_id,
                    student_group=lesson.student_group,
                    student_group_id=lesson.student_group_id,
                    periods=lesson.periods_per_week,
                    is_double=lesson.is_double,
                    note=lesson.note,
                ))
        return cards

    def _teacher_name(self, teacher_id):
        teacher = next((c.teacher for c in self.cards if c.teacher_id == teacher_id), None)
        if teacher is not None:
            try:
                return teacher.user.full_name
            except AttributeError:
                pass
        return f'#{teacher_id}'

    def grid(self):
        """
        The shared week template of the solve, half-day aware:
        {day_number: [periods]}.
        """
        for tt in self.timetables:
            if tt.id in self.target_ids:
                return self._grid_for(tt)
        return self._grid_for(self.timetables[0])

    @staticmethod
    def _grid_for(tt):
        return {d: tt.periods_for_day(d) for d in tt.days()}

    def grid_mismatch_errors(self):
        """Target classes must share the same week template."""
        grid = self.grid()
        bad = []
        for tt in self.timetables:
            if tt.id not in self.target_ids:
                continue
            if self._grid_for(tt) != grid:
                bad.append(tt.class_obj.name)
        return bad

    def _unavailability_by_teacher(self):
        """Map teacher_id -> {day: [(start, end), ...]} from availability windows."""
        from .models import TeacherUnavailability
        result = defaultdict(lambda: defaultdict(list))
        teacher_ids = {c.teacher_id for c in self.cards if c.has_teacher()}
        windows = TeacherUnavailability.objects.filter(teacher_id__in=teacher_ids)
        for window in windows:
            result[window.teacher_id][window.day_of_week].append(
                (_to_time(window.start_time), _to_time(window.end_time))
            )
        return result

    def _blocked_by_day(self):
        """
        Break/lunch/assembly windows that no lesson may occupy, unioned over
        the target classes: {day: [(start, end), ...]}.
        """
        result = defaultdict(list)
        for tt in self.timetables:
            if tt.id not in self.target_ids:
                continue
            for block in tt.blocked_slots or []:
                try:
                    day = int(block['day'])
                except (KeyError, TypeError, ValueError):
                    continue
                result[day].append(
                    (_to_time(block['start']), _to_time(block['end']))
                )
        return result

    def _fixed_slots(self):
        """
        Slots that must stay exactly as they are / must block cells:
          - every locked slot of the target classes (fixed, all modes)
          - committed (APPROVED/PUBLISHED) slots of NON-target classes, which
            own their teachers school-wide (spec §6-7). Drafts/uncommitted
            timetables never reserve anything.
        Returns (fixed_cells, teacher_blocks).
        fixed_cells:     {card_id: [(day, period_idx), ...]}  -> x = 1
        teacher_blocks:  {(teacher_id, day): [(start, end), ...]}
        """
        from .models import TimeSlot
        fixed_cells = defaultdict(list)
        blocks = defaultdict(list)
        grid = self.grid()

        card_by_lesson_teacher = {}
        card_by_subject_teacher = defaultdict(list)
        for card in self.cards:
            card_by_lesson_teacher[(card.lesson_id, card.teacher_id)] = card
            card_by_subject_teacher[
                (card.subject_id, card.teacher_id, card.student_group_id)
            ].append(card)

        slots = TimeSlot.objects.filter(
            timetable__in=self.timetables
        ).select_related('lesson', 'timetable')
        for slot in slots:
            is_target = slot.timetable_id in self.target_ids
            is_committed = slot.timetable.is_committed()
            if not is_target and not (is_committed or slot.is_locked):
                continue  # uncommitted non-target timetable reserves nothing

            # teacher occupancy blocks (for non-target committed + locked)
            if slot.teacher_id and (not is_target or slot.is_locked):
                blocks[(slot.teacher_id, slot.day_of_week)].append(
                    (slot.start_time, slot.end_time)
                )

            # locked slots are fixed cells for the target classes
            if slot.is_locked and is_target:
                day_periods = grid.get(slot.day_of_week, [])
                p = _period_index(day_periods, slot)
                if p is None:
                    continue
                if slot.lesson_id is not None:
                    card = card_by_lesson_teacher.get((slot.lesson_id, slot.teacher_id))
                    if card is not None:
                        fixed_cells[card.id].append((slot.day_of_week, p))
                else:
                    for card in card_by_subject_teacher.get(
                        (slot.subject_id, slot.teacher_id, slot.student_group_id), []
                    ):
                        fixed_cells[card.id].append((slot.day_of_week, p))
        return fixed_cells, blocks

    def _student_coverage(self, tt_id, lesson_group_id):
        return _group_coverage(self.groups_by_class.get(tt_id, []), lesson_group_id)

    def _student_card_map(self):
        """
        {tt_id: {group_key: [cards]}} for the target classes, so the student
        clash constraint can be expressed per group rather than per class.
        """
        result = {}
        for tt_id, cards in self.by_timetable.items():
            if tt_id not in self.target_ids:
                continue
            by_group = defaultdict(list)
            for card in cards:
                for key in self._student_coverage(tt_id, card.student_group_id):
                    by_group[key].append(card)
            result[tt_id] = by_group
        return result

    # ------------------------------------------------------------------ #
    #  Pre-checks that fail fast with an honest explanation              #
    # ------------------------------------------------------------------ #
    def capacity_check(self):
        errors = []
        grid = self.grid()
        D = list(grid.keys())
        slot_capacity = sum(len(grid[d]) for d in D)

        # --- class/group capacity: each group's required volume must fit ---
        student_map = self._student_card_map()
        for tt in self.timetables:
            if tt.id not in self.target_ids:
                continue
            by_group = student_map.get(tt.id, {})
            for group_key, cards in by_group.items():
                units = sum(c.periods for c in cards)
                if units > slot_capacity:
                    label = 'full cohort' if group_key is None else \
                        f'group {self._group_name(tt.id, group_key)}'
                    errors.append(
                        f'{tt.class_obj.name} ({label}) needs {units} lesson periods per week '
                        f'but the week only has {slot_capacity}. Reduce weekly hours or add '
                        f'periods/days.'
                    )

        # --- multi-teacher volume: splits must sum to the weekly volume ---
        for card_group in self.by_timetable.values():
            seen = set()
            for card in card_group:
                if card.lesson_id in seen:
                    continue
                seen.add(card.lesson_id)
                allocs = [c for c in card_group if c.lesson_id == card.lesson_id]
                if len(allocs) < 2:
                    continue
                total = sum(c.periods for c in allocs)
                if total != card.lesson.periods_per_week:
                    errors.append(
                        f'{card.lesson.subject.name}'
                        + (f' ({card.lesson.student_group.name})' if card.lesson.student_group_id else '')
                        + f' is split across {len(allocs)} teachers totalling {total} '
                        f'periods/week, but the subject requires '
                        f'{card.lesson.periods_per_week}. Adjust the allocations so they '
                        f'sum to the required weekly volume.'
                    )

        # --- teacher capacity (committed occupancy + unavailability + breaks) --
        target_cards = [c for c in self.cards if c.timetable_id in self.target_ids]
        by_teacher = defaultdict(int)
        for card in target_cards:
            if not card.has_teacher():
                continue  # unassigned placeholder reserves no real teacher
            by_teacher[card.teacher_id] += card.periods
        unavailable = self._unavailability_by_teacher()
        blocked = self._blocked_by_day()
        _, blocks = self._fixed_slots()
        for teacher_id, units in by_teacher.items():
            allowed = 0
            blocked_other = 0
            blocked_unavail = 0
            blocked_school = 0
            for day in D:
                for period in grid[day]:
                    p_start = _to_time(period['start'])
                    p_end = _to_time(period['end'])
                    blocked_by_other = any(
                        _overlaps(p_start, p_end, s, e)
                        for s, e in blocks.get((teacher_id, day), [])
                    )
                    blocked_by_unavail = any(
                        _overlaps(p_start, p_end, s, e)
                        for s, e in unavailable.get(teacher_id, {}).get(day, [])
                    )
                    blocked_by_school = any(
                        _overlaps(p_start, p_end, s, e)
                        for s, e in blocked.get(day, [])
                    )
                    if blocked_by_other:
                        blocked_other += 1
                    elif blocked_by_unavail:
                        blocked_unavail += 1
                    elif blocked_by_school:
                        blocked_school += 1
                    else:
                        allowed += 1
            if units > allowed:
                parts = []
                if blocked_other:
                    parts.append(f'{blocked_other} slot(s) taken by their committed lessons in other sections/classes')
                if blocked_unavail:
                    parts.append(f'{blocked_unavail} slot(s) blocked by their unavailability')
                if blocked_school:
                    parts.append(f'{blocked_school} slot(s) blocked by breaks/assembly')
                errors.append(
                    f'Teacher {self._teacher_name(teacher_id)} needs {units} lesson periods '
                    f'but only {allowed} cells are free after {" and ".join(parts)}. Free up a '
                    f'day, reduce their workload, or redistribute the subject across teachers.'
                )
        return errors

    def _group_name(self, tt_id, group_id):
        from .models import StudentGroup
        group = StudentGroup.objects.filter(id=group_id).first()
        return group.name if group else f'#{group_id}'

    # ------------------------------------------------------------------ #
    #  Model builder                                                     #
    # ------------------------------------------------------------------ #
    def _build_model(self, relax=False):
        model = cp_model.CpModel()
        grid = self.grid()
        D = list(grid.keys())
        target_cards = [c for c in self.cards if c.timetable_id in self.target_ids]
        if not target_cards:
            raise ValueError('No lessons to schedule.')

        x = {}
        for card in target_cards:
            for d in D:
                for p in range(len(grid[d])):
                    x[(card.id, d, p)] = model.NewBoolVar(f'x_{card.id}_{d}_{p}')

        student_map = self._student_card_map()
        by_teacher = defaultdict(list)
        for card in target_cards:
            if card.has_teacher():
                by_teacher[card.teacher_id].append(card)

        # --- Hard: no student-group overlap per slot (parallel streams OK) --
        for tt_id, by_group in student_map.items():
            for group_key, cards in by_group.items():
                for d in D:
                    for p in range(len(grid[d])):
                        units = [x[(c.id, d, p)] for c in cards]
                        if not relax and units:
                            model.Add(sum(units) <= 1)

        # --- Hard: teacher NEVER double-booked (global across classes) -- #
        for teacher_id, cards in by_teacher.items():
            for d in D:
                for p in range(len(grid[d])):
                    units = [x[(c.id, d, p)] for c in cards]
                    if not relax and units:
                        model.Add(sum(units) <= 1)

        # --- Hard: weekly volume fully scheduled ----------------------- #
        for card in target_cards:
            n = card.periods
            total = sum(x[(card.id, d, p)] for d in D for p in range(len(grid[d])))
            if relax:
                model.Add(total <= n)
            else:
                model.Add(total == n)

        # --- Soft objective terms (collected below) --------------------- #
        penalties = []

        # --- Double periods: same-day consecutive session blocks -------- #
        # STRICT mode: a double lesson is decomposed into SESSIONS — n//2
        # double sessions (2 consecutive periods, same day, same class /
        # student group / subject) plus, when the weekly volume is odd,
        # exactly one single session. Every required double session is a
        # HARD constraint: the solver never silently converts doubles into
        # singles. If the grid cannot host every double session the strict
        # solve fails and the relaxation pass diagnoses the bottleneck.
        # RELAX mode: pairs are rewarded (not required) so the pass can
        # measure how many double sessions are actually achievable.
        self.relax_pair_vars = []
        self.relax_pair_required = []
        if relax:
            for card in target_cards:
                if not card.is_double:
                    continue
                self.relax_pair_required.append((card.id, card.periods // 2))
                for d in D:
                    periods = grid[d]
                    adjacent = [
                        p for p in range(len(periods) - 1)
                        if _to_time(periods[p]['end']) == _to_time(periods[p + 1]['start'])
                    ]
                    pairs = []
                    for p in adjacent:
                        pair = model.NewBoolVar(f's_{card.id}_{d}_{p}')
                        model.Add(x[(card.id, d, p)] >= pair)
                        model.Add(x[(card.id, d, p + 1)] >= pair)
                        pairs.append(pair)
                    self.relax_pair_vars.extend(pairs)
                    # Pairs never share a unit: a day with 2k units can host
                    # k pairs — odd leftovers are singles, never rewarded twice.
                    for i in range(len(pairs) - 1):
                        model.Add(pairs[i] + pairs[i + 1] <= 1)
                    for pair in pairs:
                        penalties.append((pair, -60))
                    # Units on both sides of a break are NOT a double.
                    for p in range(len(periods) - 1):
                        if p in adjacent:
                            continue
                        bad = model.NewBoolVar(f'gap_{card.id}_{d}_{p}')
                        model.Add(bad >= x[(card.id, d, p)] + x[(card.id, d, p + 1)] - 1)
                        penalties.append((bad, 60))
        else:
            for card in target_cards:
                if not card.is_double:
                    continue
                n_pairs = card.periods // 2
                odd_volume = (n_pairs * 2) != card.periods
                pair_vars = []
                single_vars = []
                for d in D:
                    periods = grid[d]
                    adjacent = [
                        p for p in range(len(periods) - 1)
                        if _to_time(periods[p]['end']) == _to_time(periods[p + 1]['start'])
                    ]
                    s = {}
                    for p in adjacent:
                        s[p] = model.NewBoolVar(f's_{card.id}_{d}_{p}')
                    for p in range(len(periods)):
                        terms = []
                        if p in adjacent:
                            terms.append(s[p])
                        if p - 1 in adjacent:
                            terms.append(s[p - 1])
                        if odd_volume:
                            single = model.NewBoolVar(f'sg_{card.id}_{d}_{p}')
                            terms.append(single)
                            single_vars.append(single)
                        model.Add(x[(card.id, d, p)] == sum(terms))
                    pair_vars.extend(s.values())
                model.Add(sum(pair_vars) == n_pairs)
                if single_vars:
                    model.Add(sum(single_vars) == 1)

        # --- Hard: teacher unavailability windows ---------------------- #
        unavailable = self._unavailability_by_teacher()
        for teacher_id, windows in unavailable.items():
            for day, win_list in windows.items():
                if day not in D:
                    continue
                for p, period in enumerate(grid[day]):
                    p_start = _to_time(period['start'])
                    p_end = _to_time(period['end'])
                    if any(_overlaps(p_start, p_end, w0, w1) for w0, w1 in win_list):
                        for card in target_cards:
                            if card.teacher_id == teacher_id:
                                model.Add(x[(card.id, day, p)] == 0)

        # --- Hard: school blocked periods (breaks/assembly/lunch) ------ #
        blocked = self._blocked_by_day()
        for day, win_list in blocked.items():
            if day not in D:
                continue
            for p, period in enumerate(grid[day]):
                p_start = _to_time(period['start'])
                p_end = _to_time(period['end'])
                if any(_overlaps(p_start, p_end, w0, w1) for w0, w1 in win_list):
                    for card in target_cards:
                        model.Add(x[(card.id, day, p)] == 0)

        # --- Hard: fixed cells from committed non-target classes ------- #
        _, blocks = self._fixed_slots()
        for (teacher_id, day), win_list in blocks.items():
            if day not in D:
                continue
            for p, period in enumerate(grid[day]):
                p_start = _to_time(period['start'])
                p_end = _to_time(period['end'])
                if any(_overlaps(p_start, p_end, w0, w1) for w0, w1 in win_list):
                    for card in target_cards:
                        if card.teacher_id == teacher_id:
                            model.Add(x[(card.id, day, p)] == 0)

        # --- Hard: locked slots stay fixed ----------------------------- #
        fixed_cells, _ = self._fixed_slots()
        for card_id, positions in fixed_cells.items():
            if card_id not in {c.id for c in target_cards}:
                continue
            for day, p in positions:
                if p is None or day not in D or p >= len(grid[day]):
                    continue
                model.Add(x[(card_id, day, p)] == 1)

        self._locked_slot_conflicts()

        # --- Relaxation accounting ------------------------------------- #
        clash_vars = {'student': [], 'teacher': []}
        if relax:
            for tt_id, by_group in student_map.items():
                for group_key, cards in by_group.items():
                    for d in D:
                        for p in range(len(grid[d])):
                            units = [x[(c.id, d, p)] for c in cards]
                            if not units:
                                continue
                            over = model.NewIntVar(0, len(units), f'std_over_{tt_id}_{group_key}_{d}_{p}')
                            model.Add(sum(units) - 1 <= over)
                            clash_vars['student'].append(over)
            for teacher_id, cards in by_teacher.items():
                for d in D:
                    for p in range(len(grid[d])):
                        units = [x[(c.id, d, p)] for c in cards]
                        over = model.NewIntVar(0, len(units), f'teach_over_{teacher_id}_{d}_{p}')
                        model.Add(sum(units) - 1 <= over)
                        clash_vars['teacher'].append(over)
            missing = []
            for card in target_cards:
                miss = model.NewIntVar(0, card.periods, f'missing_{card.id}')
                model.Add(
                    card.periods - sum(x[(card.id, d, p)] for d in D for p in range(len(grid[d]))) <= miss
                )
                missing.append(miss)

        # --- Soft: objective terms ------------------------------------- #

        # 1. No subject 3+ times in one day (per card)
        if not relax:
            for card in target_cards:
                for d in D:
                    count = sum(x[(card.id, d, p)] for p in range(len(grid[d])))
                    excess = model.NewIntVar(0, len(grid[d]), f'excess_{card.id}_{d}')
                    model.Add(count - 2 <= excess)
                    penalties.append((excess, 8))

        # 1b. Balanced class weeks
        if not relax:
            for tt_id, cards in self.by_timetable.items():
                if tt_id not in self.target_ids:
                    continue
                units = sum(c.periods for c in cards)
                ideal = -(-units // len(D))
                for d in D:
                    count = sum(x[(c.id, d, p)] for c in cards for p in range(len(grid[d])))
                    excess = model.NewIntVar(0, len(grid[d]), f'day_excess_{tt_id}_{d}')
                    model.Add(count - ideal <= excess)
                    penalties.append((excess, 6))

        # 2. Compact class days
        if not relax:
            for tt_id, cards in self.by_timetable.items():
                if tt_id not in self.target_ids:
                    continue
                for d in D:
                    lo = model.NewIntVar(0, len(grid[d]) + 1, f'clas_lo_{tt_id}_{d}')
                    hi = model.NewIntVar(0, len(grid[d]) + 1, f'clas_hi_{tt_id}_{d}')
                    span = model.NewIntVar(0, len(grid[d]) + 1, f'clas_span_{tt_id}_{d}')
                    for card in cards:
                        for p in range(len(grid[d])):
                            xv = x[(card.id, d, p)]
                            model.Add(lo <= p + 1 + (len(grid[d]) + 1) * (1 - xv))
                            model.Add(hi >= (p + 1) * xv)
                    model.Add(span >= hi - lo)
                    penalties.append((span, 5))

        # 3. Teacher compactness + working days (global across classes)
        if not relax:
            for teacher_id, cards in by_teacher.items():
                for d in D:
                    has = model.NewBoolVar(f'has_{teacher_id}_{d}')
                    lo = model.NewIntVar(0, len(grid[d]) + 1, f't_lo_{teacher_id}_{d}')
                    hi = model.NewIntVar(0, len(grid[d]) + 1, f't_hi_{teacher_id}_{d}')
                    span = model.NewIntVar(0, len(grid[d]) + 1, f't_span_{teacher_id}_{d}')
                    for card in cards:
                        for p in range(len(grid[d])):
                            xv = x[(card.id, d, p)]
                            model.Add(has >= xv)
                            model.Add(lo <= p + 1 + (len(grid[d]) + 1) * (1 - xv))
                            model.Add(hi >= (p + 1) * xv)
                    model.Add(span >= hi - lo)
                    penalties.append((span, 10))
                    penalties.append((has, 20))

        # 4. Core subjects (coeff >= 3) not in the last 3 periods
        if not relax:
            for card in target_cards:
                try:
                    if card.subject.default_coefficient < 3:
                        continue
                except Exception:
                    continue
                for d in D:
                    for p in range(max(0, len(grid[d]) - 3), len(grid[d])):
                        penalties.append((x[(card.id, d, p)], 1))

        if relax:
            huge = 10_000
            objective_terms = []
            for var in clash_vars['student']:
                objective_terms.append(var * huge)
            for var in clash_vars['teacher']:
                objective_terms.append(var * huge)
            for var in missing:
                objective_terms.append(var * 1000)
            # Prefer complete double sessions so the diagnostic reports the
            # true maximum of achievable pairs (never clashes/missing).
            for var in self.relax_pair_vars:
                objective_terms.append(var * -10)
            model.Minimize(sum(objective_terms))
            self.relaxation_vars = (clash_vars, missing)
        else:
            model.Minimize(sum(var * weight for var, weight in penalties))

        self.x = x
        return model

    def _locked_slot_conflicts(self):
        """Two locked slots that already clash make a feasible solve impossible."""
        from .models import TimeSlot
        locked = list(TimeSlot.objects.filter(
            timetable__in=self.timetables, is_locked=True
        ))
        by_teacher = defaultdict(list)
        for slot in locked:
            if slot.teacher_id:
                by_teacher[slot.teacher_id].append(slot)
        errors = []
        for teacher_id, slots in by_teacher.items():
            for i, a in enumerate(slots):
                for b in slots[i + 1:]:
                    if a.day_of_week == b.day_of_week and _overlaps(
                        a.start_time, a.end_time, b.start_time, b.end_time
                    ):
                        errors.append(
                            f'Locked slots clash: teacher {self._teacher_name(teacher_id)} '
                            f'has two locked lessons on {a.get_day_of_week_display()} '
                            f'at {a.start_time.strftime("%H:%M")} and {b.start_time.strftime("%H:%M")}. '
                            f'Unlock or move one before generating.'
                        )
        if errors:
            raise ValueError('\n'.join(errors))

    # ------------------------------------------------------------------ #
    #  Solve                                                             #
    # ------------------------------------------------------------------ #
    def solve(self):
        if not self.timetables:
            return {'ok': False, 'status': 'infeasible', 'message': 'No classes to schedule.'}
        grid_bad = self.grid_mismatch_errors()
        if grid_bad:
            return {
                'ok': False,
                'status': 'infeasible',
                'message': (
                    'All classes in this generation scope must share the same school week '
                    '(days + per-day periods, half-days included) to guarantee teacher '
                    'clash-freedom, but these classes have different grids: '
                    + ', '.join(grid_bad) + '. Open each one and set the same school week.'
                ),
            }
        errors = self.capacity_check()
        if errors:
            return {'ok': False, 'status': 'infeasible', 'message': '\n'.join(errors)}

        try:
            model = self._build_model(relax=False)
        except ValueError as exc:
            return {'ok': False, 'status': 'infeasible', 'message': str(exc)}

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.time_limit
        solver.parameters.num_search_workers = 4
        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return self._materialise(solver)

        # --- Relaxation pass: find out why it is impossible ------------ #
        try:
            model_r = self._build_model(relax=True)
        except ValueError as exc:
            return {'ok': False, 'status': 'infeasible', 'message': str(exc)}
        solver_r = cp_model.CpSolver()
        solver_r.parameters.max_time_in_seconds = self.time_limit
        solver_r.parameters.num_search_workers = 4
        status_r = solver_r.Solve(model_r)

        if status_r not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {
                'ok': False,
                'status': 'infeasible',
                'message': 'Even a relaxed solve failed. Check that weekly hours are reasonable '
                           'and that periods/days are configured correctly.',
            }

        clash_vars, missing_vars = self.relaxation_vars
        student_over = sum(solver_r.Value(v) for v in clash_vars['student'])
        teacher_over = sum(solver_r.Value(v) for v in clash_vars['teacher'])
        missing = sum(solver_r.Value(v) for v in missing_vars)

        achieved_pairs = sum(solver_r.Value(v) for v in self.relax_pair_vars)
        required_pairs = sum(r for _, r in self.relax_pair_required)
        pair_deficit = required_pairs - achieved_pairs

        if student_over == 0 and teacher_over == 0 and missing == 0:
            if pair_deficit > 0:
                return {
                    'ok': False,
                    'status': 'infeasible',
                    'message': (
                        f'The double-period requirement cannot be met: {required_pairs} double '
                        f'session(s) are required, but only {achieved_pairs} could be placed as '
                        f'consecutive same-day blocks. Free the teacher availability or locked '
                        f'cells those blocks need, or reduce the double requirement.'
                    ),
                    'diagnostics': {
                        'required_double_sessions': required_pairs,
                        'placeable_double_sessions': achieved_pairs,
                    },
                }
            return {
                'ok': False,
                'status': 'infeasible',
                'message': 'The model was reported infeasible, but a relaxed pass found a clean '
                           'solution. Try generating again (this can happen with double-period '
                           'or lock constraints).',
            }

        lines = ['The week cannot be scheduled without clashes. Closest attempt:']
        if missing:
            lines.append(f'- {missing} lesson period(s) could not be placed at all.')
        if student_over:
            lines.append(f'- {student_over} slot(s) would give a student group two lessons at once.')
        if teacher_over:
            lines.append(f'- {teacher_over} slot(s) would double-book a teacher.')
        if pair_deficit:
            lines.append(
                f'- {pair_deficit} of the {required_pairs} required double session(s) cannot be '
                f'placed as consecutive same-day blocks.'
            )
        lines.append('Hint: reduce weekly hours, add periods/days, free teacher availability, '
                     'or redistribute subjects across teachers.')
        return {
            'ok': False,
            'status': 'infeasible',
            'message': '\n'.join(lines),
            'diagnostics': {
                'unplaced_periods': missing,
                'student_overbooked_slots': student_over,
                'teacher_overbooked_slots': teacher_over,
                'required_double_sessions': required_pairs,
                'placeable_double_sessions': achieved_pairs,
            },
        }

    # ------------------------------------------------------------------ #
    #  Materialise the solution into TimeSlot rows                       #
    # ------------------------------------------------------------------ #
    def _materialise(self, solver):
        from django.db import transaction

        grid = self.grid()
        D = list(grid.keys())
        target_ids = self.target_ids

        placements = []
        for card in self.cards:
            if card.timetable_id not in target_ids:
                continue
            for d in D:
                for p in range(len(grid[d])):
                    if solver.Value(self.x[(card.id, d, p)]):
                        placements.append((card, d, p))
        placements.sort(key=lambda t: (t[1], t[2], t[0].subject.name))

        from .models import TimeSlot
        locked_by_tt = defaultdict(set)
        for slot in TimeSlot.objects.filter(timetable__in=self.timetables, is_locked=True):
            locked_by_tt[slot.timetable_id].add(slot.id)

        kept_keys = set()
        fixed_cells, _ = self._fixed_slots()
        for card_id, positions in fixed_cells.items():
            for day, p in positions:
                kept_keys.add((card_id, day, p))

        by_tt = defaultdict(list)
        for card, d, p in placements:
            if (card.id, d, p) in kept_keys:
                continue
            period = grid[d][p]
            by_tt[card.timetable_id].append((card, d, p, period))

        with transaction.atomic():
            results = []
            for tt in self.timetables:
                if tt.id not in target_ids:
                    continue
                tt.slots.exclude(id__in=locked_by_tt.get(tt.id, set())).delete()
                created = []
                for card, d, p, period in by_tt.get(tt.id, []):
                    created.append(tt.slots.create(
                        day_of_week=d,
                        start_time=_to_time(period['start']),
                        end_time=_to_time(period['end']),
                        subject=card.subject,
                        teacher=card.teacher,
                        student_group=card.student_group,
                        classroom=card.note,
                        lesson=card.lesson,
                    ))
                tt.generation_status = tt.GenerationStatus.GENERATED
                tt.generation_message = (
                    f'Scheduled {len(created)} lesson periods. Optimised against the '
                    f'committed school schedule — teachers have no clashes, gaps and working '
                    f'days minimised. Parallel student groups are scheduled without clashing.'
                )
                tt.generation_score = int(round(solver.ObjectiveValue()))
                tt.last_generated_at = timezone.now()
                tt.save(update_fields=[
                    'generation_status', 'generation_message', 'generation_score',
                    'last_generated_at', 'updated_at',
                ])
                results.append({
                    'class_name': tt.class_obj.name,
                    'slots': len(created),
                    'status': tt.generation_status,
                })

        return {
            'ok': True,
            'status': 'generated',
            'message': (
                f'Scheduled {len(placements)} lesson periods across '
                f'{len(target_ids)} class(es). Teachers are clash-free across the whole school.'
            ),
            'placed_periods': len(placements),
            'classes': results,
            'score': int(round(solver.ObjectiveValue())),
        }


def _weekly_pair_capacity(timetable):
    """
    Maximum number of same-day consecutive blocks the class's week template
    can physically host: for each day, every run of k consecutive placeable
    periods (breaks/lunch gaps and blocked windows split runs) contributes
    floor(k / 2) blocks, since blocks must be disjoint. This caps how many
    subjects can be generated as doubles.
    """
    capacity = 0
    for day in timetable.days():
        periods = timetable.periods_for_day(day)
        windows = timetable.blocked_for_day(day)

        def placeable(index):
            start = _to_time(periods[index]['start'])
            end = _to_time(periods[index]['end'])
            return not any(
                _to_time(b['start']) < end and start < _to_time(b['end'])
                for b in windows
            )

        run = 0
        for index in range(len(periods)):
            if not placeable(index):
                capacity += run // 2
                run = 0
            elif run and _to_time(periods[index]['start']) == _to_time(periods[index - 1]['end']):
                run += 1
            else:
                capacity += run // 2
                run = 1
        capacity += run // 2
    return capacity


def suggest_lessons_for(timetable):
    """
    Build lesson cards for a class from each subject's weekly hours — now
    group-aware: a ClassSubject targeting a StudentGroup produces a lesson
    for that group, so parallel streams can be scheduled simultaneously.

    DEFAULT RULE (Cameroon timetable norm): a subject without explicit
    double configuration is generated as DOUBLE sessions whenever the class
    week template can host them — 2h → 1 double, 3h → 1 double + 1 single,
    4h → 2 doubles, 5h → 2 doubles + 1 single, 6h → 3 doubles, ... Subjects
    beyond the template's consecutive-block capacity are generated as
    singles. The administrator can always override per subject with the
    `is_double` flag on the class subject, or `is_double_preferred` on the
    subject itself.

    Returns (created_count, total_periods, doubles, errors).
    """
    from apps.academic.models import ClassSubject
    from apps.staff.models import TeachingAssignment
    from .models import Lesson

    class_subjects = list(
        ClassSubject.objects.filter(
            academic_class=timetable.class_obj, weekly_hours__gt=0
        ).select_related('subject', 'student_group').order_by('subject__name')
    )
    if not class_subjects:
        return 0, 0, 0, (
            f'{timetable.class_obj.name}: no weekly hours set yet. Set "weekly hours" per '
            f'subject before suggesting lessons.'
        )

    pair_capacity = _weekly_pair_capacity(timetable)
    default_doubles = set()
    used_pairs = 0
    for cs in sorted(class_subjects, key=lambda c: (-c.weekly_hours, c.subject.name)):
        explicitly_configured = cs.is_double is not None or cs.subject.is_double_preferred
        if (
            not explicitly_configured
            and cs.weekly_hours >= 2
            and used_pairs + cs.weekly_hours // 2 <= pair_capacity
        ):
            default_doubles.add(cs.pk)
            used_pairs += cs.weekly_hours // 2

    suggestions = []
    for cs in class_subjects:
        assignment = (
            TeachingAssignment.objects.filter(
                academic_class=timetable.class_obj, subject=cs.subject,
                student_group=cs.student_group,
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                subject=cs.subject, student_group=cs.student_group,
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                academic_class=timetable.class_obj, subject=cs.subject,
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                subject=cs.subject
            ).select_related('teacher').first()
        )
        teacher_obj = assignment.teacher if assignment else None
        hours = cs.weekly_hours
        double = cs.is_double if cs.is_double is not None else cs.subject.is_double_preferred
        if not double and cs.pk in default_doubles:
            double = True
        if double and hours >= 2:
            suggestions.append({
                'subject': cs.subject,
                'teacher': teacher_obj,
                'student_group': cs.student_group,
                'periods_per_week': (hours // 2) * 2,
                'is_double': True,
                'note': '',
            })
            if hours % 2:
                suggestions.append({
                    'subject': cs.subject,
                    'teacher': teacher_obj,
                    'student_group': cs.student_group,
                    'periods_per_week': 1,
                    'is_double': False,
                    'note': '',
                })
        else:
            suggestions.append({
                'subject': cs.subject,
                'teacher': teacher_obj,
                'student_group': cs.student_group,
                'periods_per_week': hours,
                'is_double': False,
                'note': '',
            })

    timetable.lessons.all().delete()
    from .models import TeacherAllocation
    TeacherAllocation.objects.filter(lesson__timetable=timetable).delete()

    for item in suggestions:
        Lesson.objects.create(timetable=timetable, **item)

    total = sum(l['periods_per_week'] for l in suggestions)
    doubles = sum((l['periods_per_week'] // 2) for l in suggestions if l['is_double'])
    return len(suggestions), total, doubles, None


def _slot_group_overlap(tt, a_group_id, b_group_id):
    """
    True when two slots of the same class actually share students:
      - class without groups: everything overlaps (single implicit cohort)
      - full-cohort slots (None) overlap everything
      - two different groups do NOT overlap (valid parallel stream)
    """
    if not tt.class_obj.student_groups.exists():
        return True
    if a_group_id is None or b_group_id is None:
        return True
    return a_group_id == b_group_id


def committed_slots(root_tt, exclude_timetable=None):
    """
    The school-wide committed schedule for a term: slots of every APPROVED or
    PUBLISHED timetable in the same tenant + academic year, excluding the
    given timetable. Used for cross-section conflict detection (RED) and for
    `validate_section_against_school`.
    """
    from .models import TimeSlot
    qs = TimeSlot.objects.filter(
        timetable__tenant=root_tt.tenant_id,
        timetable__academic_year=root_tt.academic_year_id,
    ).select_related('timetable', 'subject', 'teacher', 'lesson')
    if exclude_timetable is not None:
        qs = qs.exclude(timetable=exclude_timetable)
    return [s for s in qs if s.timetable.is_committed()]


def _cross_section_clashes(slot, committed):
    """
    Clashes between one slot and the committed school schedule.
    Returns a list of issue dicts (RED errors).
    """
    from .models import Timetable
    issues = []
    for other in committed:
        if other.timetable_id == slot.timetable_id:
            continue
        if other.day_of_week != slot.day_of_week:
            continue
        if not _overlaps(slot.start_time, slot.end_time, other.start_time, other.end_time):
            continue
        if slot.teacher_id and slot.teacher_id == other.teacher_id:
            issues.append({
                'severity': 'error',
                'type': 'school_teacher_clash',
                'message': (
                    f'{slot.subject.name} clashes with {other.timetable.class_obj.name}\'s '
                    f'{other.subject.name} on {slot.get_day_of_week_display()} '
                    f'{slot.start_time.strftime("%H:%M")} — teacher '
                    f'{slot.teacher.user.full_name if getattr(slot.teacher, "user", None) else slot.teacher_id} '
                    f'is already committed to that period in an approved timetable.'
                ),
            })
        room_a = slot.room_id or (slot.classroom.strip().lower() if slot.classroom.strip() else None)
        room_b = other.room_id or (other.classroom.strip().lower() if other.classroom.strip() else None)
        if room_a and room_b and room_a == room_b:
            issues.append({
                'severity': 'error',
                'type': 'school_room_clash',
                'message': (
                    f'Room "{room_a}" is double-booked between {slot.subject.name} and '
                    f'{other.timetable.class_obj.name}\'s {other.subject.name} on '
                    f'{slot.get_day_of_week_display()} at {slot.start_time.strftime("%H:%M")} — '
                    f'the room is committed to an approved timetable.'
                ),
            })
    return issues


def validate_timetable(timetable):
    """
    Manual-edit checker: the same rules the generator enforces, applied to
    whatever is currently on the grid. Returns a list of issues.
    Severity semantics (spec §15):
      error    -> RED, hard clash (student/teacher/room, cross-section
                  committed resource, boundary, blocked period, volume)
      warning  -> YELLOW, overridable (teacher unavailability)
      info     -> GRAY, unassigned teacher (TBD) — not a clash
    """
    slots = list(timetable.slots.select_related('subject', 'teacher', 'lesson').all())
    issues = []
    by_teacher = defaultdict(list)
    by_class_slot = defaultdict(list)
    by_room = defaultdict(list)
    for slot in slots:
        by_teacher[slot.teacher_id].append(slot)
        by_class_slot[(slot.timetable_id, slot.day_of_week, slot.start_time, slot.end_time)].append(slot)
        room_key = None
        if slot.room_id:
            room_key = f'room:{slot.room_id}'
        elif slot.classroom.strip():
            room_key = f'text:{slot.classroom.strip().lower()}'
        if room_key:
            by_room[room_key].append(slot)

    def overlap(a, b):
        return a.day_of_week == b.day_of_week and _overlaps(
            a.start_time, a.end_time, b.start_time, b.end_time
        )

    for teacher_id, teacher_slots in by_teacher.items():
        if teacher_id is None:
            continue  # unassigned placeholder clashes with nobody
        for i, a in enumerate(teacher_slots):
            for b in teacher_slots[i + 1:]:
                if overlap(a, b):
                    issues.append({
                        'severity': 'error',
                        'type': 'teacher_clash',
                        'message': (
                            f'{a.subject.name} and {b.subject.name} both at '
                            f'{a.get_day_of_week_display()} {a.start_time.strftime("%H:%M")} '
                            f'— same teacher.'
                        ),
                    })

    # Student clash: only when the two slots' groups actually share students.
    for (tt_id, day, start, end), slots_at in by_class_slot.items():
        if len(slots_at) < 2:
            continue
        for i, a in enumerate(slots_at):
            for b in slots_at[i + 1:]:
                if _slot_group_overlap(timetable, a.student_group_id, b.student_group_id):
                    group_a = a.student_group.name if a.student_group_id else 'full cohort'
                    group_b = b.student_group.name if b.student_group_id else 'full cohort'
                    issues.append({
                        'severity': 'error',
                        'type': 'student_clash',
                        'message': (
                            f'{a.subject.name} ({group_a}) and {b.subject.name} ({group_b}) '
                            f'both at {a.get_day_of_week_display()} '
                            f'{a.start_time.strftime("%H:%M")} — the same students would '
                            f'have to attend both.'
                        ),
                    })

    for room, room_slots in by_room.items():
        for i, a in enumerate(room_slots):
            for b in room_slots[i + 1:]:
                if overlap(a, b):
                    label = a.room.name if a.room_id else a.classroom
                    issues.append({
                        'severity': 'error',
                        'type': 'room_clash',
                        'message': (
                            f'Room "{label}" double-booked on '
                            f'{a.get_day_of_week_display()} at {a.start_time.strftime("%H:%M")}.'
                        ),
                    })

    # Half-day + break + boundary guards: every slot must line up with the
    # configured grid of its day and never sit inside a blocked period.
    for slot in slots:
        if slot.day_of_week not in timetable.days():
            issues.append({
                'severity': 'error',
                'type': 'boundary',
                'message': (
                    f'{slot.subject.name} is on {slot.get_day_of_week_display()}, '
                    f'a non-working day.'
                ),
            })
            continue
        day_periods = timetable.periods_for_day(slot.day_of_week)
        if _period_index(day_periods, slot) is None:
            issues.append({
                'severity': 'error',
                'type': 'boundary',
                'message': (
                    f'{slot.subject.name} starts at {slot.start_time.strftime("%H:%M")} on '
                    f'{slot.get_day_of_week_display()} — outside that day\'s configured '
                    f'period grid (a break, lunch or half-day limit).'
                ),
            })
        for block in timetable.blocked_for_day(slot.day_of_week):
            if _overlaps(
                slot.start_time, slot.end_time,
                _to_time(block['start']), _to_time(block['end']),
            ):
                issues.append({
                    'severity': 'error',
                    'type': 'blocked_period',
                    'message': (
                        f'{slot.subject.name} on {slot.get_day_of_week_display()} at '
                        f'{slot.start_time.strftime("%H:%M")} sits inside a blocked period '
                        f'("{block.get("label") or "break"}").'
                    ),
                })

    # Cross-section: committed (approved/published) timetables own teachers
    # and rooms school-wide (spec §6-7).
    committed = committed_slots(timetable, exclude_timetable=timetable)
    for slot in slots:
        if slot.teacher_id is None:
            issues.append({
                'severity': 'info',
                'type': 'unassigned',
                'message': (
                    f'{slot.subject.name} on {slot.get_day_of_week_display()} '
                    f'{slot.start_time.strftime("%H:%M")} has no teacher assigned (TBD). '
                    f'It reserves no real teacher resource.'
                ),
            })
        issues.extend(_cross_section_clashes(slot, committed))

    # Teacher availability windows -> YELLOW, overridable (spec §15).
    from .models import TeacherUnavailability
    unavail = TeacherUnavailability.objects.filter(
        teacher_id__in=[s.teacher_id for s in slots if s.teacher_id]
    )
    for slot in slots:
        if not slot.teacher_id:
            continue
        for window in unavail:
            if window.teacher_id != slot.teacher_id or window.day_of_week != slot.day_of_week:
                continue
            if _overlaps(slot.start_time, slot.end_time, window.start_time, window.end_time):
                issues.append({
                    'severity': 'warning',
                    'type': 'availability',
                    'message': (
                        f'{slot.subject.name} on {slot.get_day_of_week_display()} '
                        f'{slot.start_time.strftime("%H:%M")} falls inside teacher '
                        f'{slot.teacher.user.full_name if getattr(slot.teacher, "user", None) else slot.teacher_id}\'s '
                        f'unavailability window. Overridable, but verify the teacher agreed.'
                    ),
                })

    lessons = list(timetable.lessons.select_related('subject', 'teacher').prefetch_related('allocations').all())
    if lessons:
        scheduled = defaultdict(int)
        for slot in slots:
            if slot.lesson_id is not None:
                scheduled[slot.lesson_id] += 1
            else:
                for lesson in lessons:
                    if lesson.subject_id == slot.subject_id and lesson.teacher_id == slot.teacher_id \
                            and lesson.student_group_id == slot.student_group_id:
                        scheduled[lesson.id] += 1
                        break
        for lesson in lessons:
            if scheduled[lesson.id] != lesson.periods_per_week:
                issues.append({
                    'severity': 'warning',
                    'type': 'volume_mismatch',
                    'message': (
                        f'{lesson.subject.name}'
                        + (f' ({lesson.student_group.name})' if lesson.student_group_id else '')
                        + f': scheduled {scheduled[lesson.id]} of '
                        f'{lesson.periods_per_week} required weekly periods.'
                    ),
                })

        # Multi-teacher splits must sum to the lesson's weekly volume.
        for lesson in lessons:
            allocs = list(lesson.allocations.all())
            if not allocs:
                continue
            total = sum(a.periods for a in allocs)
            if total != lesson.periods_per_week:
                issues.append({
                    'severity': 'error',
                    'type': 'allocation_volume',
                    'message': (
                        f'{lesson.subject.name}'
                        + (f' ({lesson.student_group.name})' if lesson.student_group_id else '')
                        + f' is split across {len(allocs)} teachers for {total} periods/week, '
                        f'but the subject requires {lesson.periods_per_week}. The allocations '
                        f'must sum to the required weekly volume.'
                    ),
                })
            for a in allocs:
                if a.periods <= 0:
                    issues.append({
                        'severity': 'error',
                        'type': 'allocation_volume',
                        'message': (
                            f'Allocation {a.teacher_id or "TBD"} on {lesson.subject.name} has '
                            f'{a.periods} periods — every split must be at least 1 period.'
                        ),
                    })

        # Double-integrity: every required double session must exist as a
        # same-day consecutive block; doubles are never silently split into
        # singles (spec §7, §25-26).
        for lesson in lessons:
            if not lesson.is_double:
                continue
            lesson_slots = [s for s in slots if s.lesson_id == lesson.id]
            expected_pairs = lesson.periods_per_week // 2
            expected_singles = lesson.periods_per_week % 2
            counted_pairs = 0
            counted_singles = 0
            for day in timetable.days():
                day_slots = sorted(
                    (s for s in lesson_slots if s.day_of_week == day),
                    key=lambda s: s.start_time,
                )
                i = 0
                while i < len(day_slots):
                    a = day_slots[i]
                    b = day_slots[i + 1] if i + 1 < len(day_slots) else None
                    pa = _period_index(timetable.periods_for_day(day), a)
                    pb = _period_index(timetable.periods_for_day(day), b) if b else None
                    if b is not None and pa is not None and pb == pa + 1:
                        counted_pairs += 1
                        i += 2
                        continue
                    counted_singles += 1
                    i += 1
            if counted_pairs != expected_pairs or counted_singles != expected_singles:
                issues.append({
                    'severity': 'error',
                    'type': 'double_integrity',
                    'code': 'DOUBLE_COUNT_MISMATCH',
                    'message': (
                        f'{lesson.subject.name}'
                        + (f' ({lesson.student_group.name})' if lesson.student_group_id else '')
                        + f' requires {expected_pairs} double session(s) and {expected_singles} '
                        f'single(s) ({lesson.periods_per_week} periods/week), but '
                        f'{counted_pairs} double(s) and {counted_singles} single(s) were found. '
                        f'A double is two consecutive periods on the same day — two periods on '
                        f'different days are never a double.'
                    ),
                })

    return issues
