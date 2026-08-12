"""
Automatic school-wide timetable generation using Google OR-Tools CP-SAT.

Teachers teach across classes and sections, so a per-class solve can never
guarantee clash-free weeks. SchoolSolver therefore builds ONE model for
many classes at once:

Hard constraints guarantee:
  - one lesson per slot per class
  - a teacher NEVER teaches two classes at once (global across all classes)
  - every lesson's weekly volume is fully scheduled
  - double periods are consecutive and never split by a break
  - teacher unavailability windows are respected
  - locked slots (and, in repair mode, other classes' slots) stay fixed

Soft constraints (weighted objective) minimise:
  - gaps ("trous") in each class day
  - gaps in a teacher's day (vacataires travel between schools)
  - the number of distinct days each teacher works
  - heavy subject concentration (no subject 3+ times in one day per class)
  - unbalanced class weeks (one day heavily overloaded)
  - core subjects placed in the afternoon

Two modes:
  - school-wide: target_ids = all timetables; locked slots are fixed.
  - repair one class: target_ids = one class; every other class's existing
    slots become fixed teacher blocks, so the repair can never clash with
    the rest of the school.

If the model is infeasible, a relaxation pass re-solves with the
teacher/class clash constraints softened, so we can report exactly
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


class SchoolSolver:
    def __init__(self, timetables, target_ids=None, time_limit_seconds=90):
        self.timetables = list(timetables)
        self.target_ids = set(target_ids) if target_ids is not None else {t.id for t in self.timetables}
        self.time_limit = time_limit_seconds
        self.repair_mode = len(self.target_ids) == 1
        self.lessons = [
            lesson for lesson in
            self._load_lessons()
        ]
        self.by_timetable = defaultdict(list)
        for lesson in self.lessons:
            self.by_timetable[lesson.timetable_id].append(lesson)

    # ------------------------------------------------------------------ #
    #  Data helpers                                                      #
    # ------------------------------------------------------------------ #
    def _load_lessons(self):
        from .models import Lesson
        return Lesson.objects.filter(
            timetable__in=self.timetables
        ).select_related('subject', 'teacher', 'timetable').all()

    def _teacher_name(self, teacher_id):
        teacher = next((l.teacher for l in self.lessons if l.teacher_id == teacher_id), None)
        if teacher is not None:
            try:
                return teacher.user.full_name
            except AttributeError:
                pass
        return f'#{teacher_id}'

    def grid(self):
        """The shared week template (periods + days) of the solve."""
        for tt in self.timetables:
            if tt.id in self.target_ids:
                return tt.period_times(), tt.days()
        return self.timetables[0].period_times(), self.timetables[0].days()

    def grid_mismatch_errors(self):
        """In school-wide mode all classes must share the same week template."""
        periods, days = self.grid()
        bad = []
        for tt in self.timetables:
            if tt.period_times() != periods or tt.days() != days:
                bad.append(tt.class_obj.name)
        return bad

    def _unavailability_by_teacher(self):
        """Map teacher_id -> {day: [(start, end), ...]} from availability windows."""
        from .models import TeacherUnavailability
        result = defaultdict(lambda: defaultdict(list))
        windows = TeacherUnavailability.objects.filter(
            teacher__in=[l.teacher for l in self.lessons if l.teacher]
        )
        for window in windows:
            result[window.teacher_id][window.day_of_week].append(
                (_to_time(window.start_time), _to_time(window.end_time))
            )
        return result

    def _fixed_slots(self):
        """
        Slots that must stay exactly as they are:
          - every locked slot (all modes)
          - in repair mode, every slot of non-target classes (they are the
            rest of the school the repair must fit around)
        Returns (by_lesson_keys, teacher_blocks).
        by_lesson_keys: {lesson_id: [(day, period_idx), ...]} for fixing x=1
        teacher_blocks: {(teacher_id, day): [(start, end), ...]} to block cells
        """
        from .models import TimeSlot
        by_lesson = defaultdict(list)
        blocks = defaultdict(list)
        periods, _ = self.grid()
        slots = TimeSlot.objects.filter(timetable__in=self.timetables).select_related('lesson')
        for slot in slots:
            if slot.is_locked:
                if slot.lesson_id is not None:
                    by_lesson[slot.lesson_id].append((slot.day_of_week, _period_index(periods, slot)))
                else:
                    by_lesson[(slot.subject_id, slot.teacher_id)].append(
                        (slot.day_of_week, _period_index(periods, slot))
                    )
            if slot.timetable_id not in self.target_ids or slot.is_locked:
                blocks[(slot.teacher_id, slot.day_of_week)].append(
                    (slot.start_time, slot.end_time)
                )
        return by_lesson, blocks

    # ------------------------------------------------------------------ #
    #  Pre-checks that fail fast with an honest explanation              #
    # ------------------------------------------------------------------ #
    def capacity_check(self):
        errors = []
        periods, days = self.grid()
        D, P = len(days), len(periods)
        slot_capacity = D * P

        for tt in self.timetables:
            if tt.id not in self.target_ids:
                continue
            units = sum(l.periods_per_week for l in self.by_timetable.get(tt.id, []))
            if units > slot_capacity:
                errors.append(
                    f'{tt.class_obj.name} needs {units} lesson periods per week but the week '
                    f'only has {slot_capacity}. Reduce weekly hours or add periods/days.'
                )

        by_teacher = defaultdict(int)
        for lesson in self.lessons:
            by_teacher[lesson.teacher_id] += lesson.periods_per_week
        unavailable = self._unavailability_by_teacher()
        _, blocks = self._fixed_slots()
        for teacher_id, units in by_teacher.items():
            if self.repair_mode:
                allowed = 0
                for day in days:
                    for period in periods:
                        p_start = _to_time(period['start'])
                        p_end = _to_time(period['end'])
                        blocked = any(
                            _overlaps(p_start, p_end, s, e)
                            for s, e in blocks.get((teacher_id, day), [])
                        ) or any(
                            _overlaps(p_start, p_end, s, e)
                            for s, e in unavailable.get(teacher_id, {}).get(day, [])
                        )
                        if not blocked:
                            allowed += 1
                if units > allowed:
                    errors.append(
                        f'Teacher {self._teacher_name(teacher_id)} needs {units} lesson periods '
                        f'but only {allowed} cells are free after their existing lessons in other '
                        f'classes and unavailability windows.'
                    )
            else:
                if units > slot_capacity:
                    errors.append(
                        f'Teacher {self._teacher_name(teacher_id)} is assigned {units} lesson '
                        f'periods but the week only has {slot_capacity}. Reduce their load or '
                        f'split the subject across teachers.'
                    )
                allowed = 0
                for day in days:
                    for period in periods:
                        p_start = _to_time(period['start'])
                        p_end = _to_time(period['end'])
                        if not any(_overlaps(p_start, p_end, s, e) for s, e in unavailable.get(teacher_id, {}).get(day, [])):
                            allowed += 1
                if units > allowed:
                    errors.append(
                        f'Teacher {self._teacher_name(teacher_id)} needs {units} lesson periods '
                        f'but only has {allowed} free after their unavailability windows. Free up '
                        f'a day or redistribute lessons.'
                    )
        return errors

    # ------------------------------------------------------------------ #
    #  Model builder                                                     #
    # ------------------------------------------------------------------ #
    def _build_model(self, relax=False):
        model = cp_model.CpModel()
        periods, days = self.grid()
        D, P = days, len(periods)
        target_lessons = [l for l in self.lessons if l.timetable_id in self.target_ids]
        if not target_lessons:
            raise ValueError('No lessons to schedule.')

        x = {}
        for lesson in target_lessons:
            for d in D:
                for p in range(P):
                    x[(lesson.id, d, p)] = model.NewBoolVar(f'x_{lesson.id}_{d}_{p}')

        # --- Hard: one lesson per slot per class ----------------------- #
        for tt_id, lessons in self.by_timetable.items():
            if tt_id not in self.target_ids:
                continue
            for d in D:
                for p in range(P):
                    units = [x[(l.id, d, p)] for l in lessons if l.id in x]
                    if not relax and units:
                        model.Add(sum(units) <= 1)

        # --- Hard: teacher NEVER double-booked (global across classes) -- #
        by_teacher = defaultdict(list)
        for lesson in target_lessons:
            by_teacher[lesson.teacher_id].append(lesson)
        for teacher_id, lessons in by_teacher.items():
            for d in D:
                for p in range(P):
                    units = [x[(l.id, d, p)] for l in lessons]
                    if not relax and units:
                        model.Add(sum(units) <= 1)

        # --- Hard: weekly volume fully scheduled ----------------------- #
        for lesson in target_lessons:
            n = lesson.periods_per_week
            total = sum(x[(lesson.id, d, p)] for d in D for p in range(P))
            if relax:
                model.Add(total <= n)
            else:
                model.Add(total == n)

        # --- Hard: double periods are 2 consecutive units -------------- #
        adjacent = [
            p for p in range(P - 1)
            if _to_time(periods[p]['end']) == _to_time(periods[p + 1]['start'])
        ]
        s = {}
        for lesson in target_lessons:
            if not lesson.is_double:
                continue
            for d in D:
                for p in adjacent:
                    s[(lesson.id, d, p)] = model.NewBoolVar(f's_{lesson.id}_{d}_{p}')
                for p in range(P):
                    terms = []
                    if p in adjacent:
                        terms.append(s[(lesson.id, d, p)])
                    if p - 1 in adjacent:
                        terms.append(s[(lesson.id, d, p - 1)])
                    if terms:
                        model.Add(x[(lesson.id, d, p)] == sum(terms))
                    else:
                        model.Add(x[(lesson.id, d, p)] == 0)

        # --- Hard: teacher unavailability windows ---------------------- #
        unavailable = self._unavailability_by_teacher()
        for teacher_id, windows in unavailable.items():
            for day, win_list in windows.items():
                if day not in D:
                    continue
                for p, period in enumerate(periods):
                    p_start = _to_time(period['start'])
                    p_end = _to_time(period['end'])
                    if any(_overlaps(p_start, p_end, w0, w1) for w0, w1 in win_list):
                        for lesson in target_lessons:
                            if lesson.teacher_id == teacher_id:
                                model.Add(x[(lesson.id, day, p)] == 0)

        # --- Hard: fixed cells from other classes (repair mode) -------- #
        _, blocks = self._fixed_slots()
        for (teacher_id, day), win_list in blocks.items():
            if day not in D:
                continue
            for p, period in enumerate(periods):
                p_start = _to_time(period['start'])
                p_end = _to_time(period['end'])
                if any(_overlaps(p_start, p_end, w0, w1) for w0, w1 in win_list):
                    for lesson in target_lessons:
                        if lesson.teacher_id == teacher_id:
                            model.Add(x[(lesson.id, day, p)] == 0)

        # --- Hard: locked slots stay fixed ----------------------------- #
        by_lesson, _ = self._fixed_slots()
        fixed_lesson_ids = {l.id for l in target_lessons}
        for lesson_id, positions in by_lesson.items():
            if lesson_id not in fixed_lesson_ids:
                continue
            for day, p in positions:
                if p is None or day not in D or p >= P:
                    continue
                model.Add(x[(lesson_id, day, p)] == 1)

        self._locked_slot_conflicts()

        # --- Relaxation accounting ------------------------------------- #
        clash_vars = {'class': [], 'teacher': []}
        if relax:
            for tt_id, lessons in self.by_timetable.items():
                if tt_id not in self.target_ids:
                    continue
                for d in D:
                    for p in range(P):
                        units = [x[(l.id, d, p)] for l in lessons if l.id in x]
                        if not units:
                            continue
                        over = model.NewIntVar(0, len(units), f'class_over_{tt_id}_{d}_{p}')
                        model.Add(sum(units) - 1 <= over)
                        clash_vars['class'].append(over)
            for teacher_id, lessons in by_teacher.items():
                for d in D:
                    for p in range(P):
                        units = [x[(l.id, d, p)] for l in lessons]
                        over = model.NewIntVar(0, len(units), f'teach_over_{teacher_id}_{d}_{p}')
                        model.Add(sum(units) - 1 <= over)
                        clash_vars['teacher'].append(over)
            missing = []
            for lesson in target_lessons:
                miss = model.NewIntVar(0, lesson.periods_per_week, f'missing_{lesson.id}')
                model.Add(
                    lesson.periods_per_week - sum(x[(lesson.id, d, p)] for d in D for p in range(P)) <= miss
                )
                missing.append(miss)

        # --- Soft: objective terms ------------------------------------- #
        penalties = []

        # 1. No subject 3+ times in one day (per lesson)
        if not relax:
            for lesson in target_lessons:
                for d in D:
                    count = sum(x[(lesson.id, d, p)] for p in range(P))
                    excess = model.NewIntVar(0, P, f'excess_{lesson.id}_{d}')
                    model.Add(count - 2 <= excess)
                    penalties.append((excess, 8))

        # 1b. Balanced class weeks
        if not relax:
            for tt_id, lessons in self.by_timetable.items():
                if tt_id not in self.target_ids:
                    continue
                units = sum(l.periods_per_week for l in lessons)
                ideal = -(-units // len(D))
                for d in D:
                    count = sum(x[(l.id, d, p)] for l in lessons for p in range(P))
                    excess = model.NewIntVar(0, P, f'day_excess_{tt_id}_{d}')
                    model.Add(count - ideal <= excess)
                    penalties.append((excess, 6))

        # 2. Compact class days
        if not relax:
            for tt_id, lessons in self.by_timetable.items():
                if tt_id not in self.target_ids:
                    continue
                for d in D:
                    lo = model.NewIntVar(0, P + 1, f'clas_lo_{tt_id}_{d}')
                    hi = model.NewIntVar(0, P + 1, f'clas_hi_{tt_id}_{d}')
                    span = model.NewIntVar(0, P + 1, f'clas_span_{tt_id}_{d}')
                    for lesson in lessons:
                        for p in range(P):
                            xv = x[(lesson.id, d, p)]
                            model.Add(lo <= p + 1 + (P + 1) * (1 - xv))
                            model.Add(hi >= (p + 1) * xv)
                    model.Add(span >= hi - lo)
                    penalties.append((span, 5))

        # 3. Teacher compactness + working days (global across classes)
        if not relax:
            for teacher_id, lessons in by_teacher.items():
                for d in D:
                    has = model.NewBoolVar(f'has_{teacher_id}_{d}')
                    lo = model.NewIntVar(0, P + 1, f't_lo_{teacher_id}_{d}')
                    hi = model.NewIntVar(0, P + 1, f't_hi_{teacher_id}_{d}')
                    span = model.NewIntVar(0, P + 1, f't_span_{teacher_id}_{d}')
                    for lesson in lessons:
                        for p in range(P):
                            xv = x[(lesson.id, d, p)]
                            model.Add(has >= xv)
                            model.Add(lo <= p + 1 + (P + 1) * (1 - xv))
                            model.Add(hi >= (p + 1) * xv)
                    model.Add(span >= hi - lo)
                    penalties.append((span, 10))
                    penalties.append((has, 20))

        # 4. Core subjects (coeff >= 3) not in the last 3 periods
        if not relax:
            for lesson in target_lessons:
                try:
                    if lesson.subject.default_coefficient < 3:
                        continue
                except Exception:
                    continue
                for d in D:
                    for p in range(max(0, P - 3), P):
                        penalties.append((x[(lesson.id, d, p)], 1))

        if relax:
            huge = 10_000
            objective_terms = []
            for var in clash_vars['class']:
                objective_terms.append(var * huge)
            for var in clash_vars['teacher']:
                objective_terms.append(var * huge)
            for var in missing:
                objective_terms.append(var * 1000)
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
                    'All classes must share the same school week to guarantee teacher '
                    'clash-freedom, but these classes have different periods/days: '
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
        class_over = sum(solver_r.Value(v) for v in clash_vars['class'])
        teacher_over = sum(solver_r.Value(v) for v in clash_vars['teacher'])
        missing = sum(solver_r.Value(v) for v in missing_vars)

        if class_over == 0 and teacher_over == 0 and missing == 0:
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
        if class_over:
            lines.append(f'- {class_over} slot(s) would need 2+ lessons at once for a class.')
        if teacher_over:
            lines.append(f'- {teacher_over} slot(s) would double-book a teacher.')
        lines.append('Hint: reduce weekly hours, add periods/days, free teacher availability, '
                     'or redistribute subjects across teachers.')
        return {
            'ok': False,
            'status': 'infeasible',
            'message': '\n'.join(lines),
            'diagnostics': {
                'unplaced_periods': missing,
                'class_overbooked_slots': class_over,
                'teacher_overbooked_slots': teacher_over,
            },
        }

    # ------------------------------------------------------------------ #
    #  Materialise the solution into TimeSlot rows                       #
    # ------------------------------------------------------------------ #
    def _materialise(self, solver):
        from django.db import transaction

        periods, days = self.grid()
        D, P = days, len(periods)
        target_ids = self.target_ids

        placements = []
        for lesson in self.lessons:
            if lesson.timetable_id not in target_ids:
                continue
            for d in D:
                for p in range(P):
                    if solver.Value(self.x[(lesson.id, d, p)]):
                        placements.append((lesson, d, p))
        placements.sort(key=lambda t: (t[1], t[2], t[0].subject.name))

        from .models import TimeSlot
        locked_by_tt = defaultdict(set)
        for slot in TimeSlot.objects.filter(timetable__in=self.timetables, is_locked=True):
            locked_by_tt[slot.timetable_id].add(slot.id)

        kept_keys = set()
        for tt in self.timetables:
            if tt.id not in target_ids:
                continue
            for slot in tt.slots.filter(is_locked=True):
                p = _period_index(periods, slot)
                if p is None:
                    continue
                if slot.lesson_id:
                    kept_keys.add((slot.lesson_id, slot.day_of_week, p))
                else:
                    kept_keys.add((slot.subject_id, slot.teacher_id, slot.day_of_week, p))

        by_tt = defaultdict(list)
        for lesson, d, p in placements:
            if (lesson.id, d, p) in kept_keys or \
               (lesson.subject_id, lesson.teacher_id, d, p) in kept_keys:
                continue
            period = periods[p]
            by_tt[lesson.timetable_id].append((lesson, d, p, period))

        with transaction.atomic():
            results = []
            for tt in self.timetables:
                if tt.id not in target_ids:
                    continue
                tt.slots.exclude(id__in=locked_by_tt.get(tt.id, set())).delete()
                created = []
                for lesson, d, p, period in by_tt.get(tt.id, []):
                    created.append(tt.slots.create(
                        day_of_week=d,
                        start_time=_to_time(period['start']),
                        end_time=_to_time(period['end']),
                        subject=lesson.subject,
                        teacher=lesson.teacher,
                        classroom=lesson.note or '',
                        lesson=lesson,
                    ))
                tt.generation_status = tt.GenerationStatus.GENERATED
                tt.generation_message = (
                    f'Scheduled {len(created)} lesson periods. Optimised globally across '
                    f'all classes — teachers have no clashes, gaps and working days minimised.'
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


def suggest_lessons_for(timetable):
    """
    Build lesson cards for a class from each subject's weekly hours.
    Returns (created_count, total_periods, doubles, errors).
    """
    from apps.academic.models import ClassSubject
    from apps.staff.models import TeachingAssignment
    from .models import Lesson

    class_subjects = list(
        ClassSubject.objects.filter(
            academic_class=timetable.class_obj, weekly_hours__gt=0
        ).select_related('subject').order_by('subject__name')
    )
    if not class_subjects:
        return 0, 0, 0, (
            f'{timetable.class_obj.name}: no weekly hours set yet. Set "weekly hours" per '
            f'subject before suggesting lessons.'
        )

    missing_teachers = []
    suggestions = []
    for cs in class_subjects:
        assignment = (
            TeachingAssignment.objects.filter(
                academic_class=timetable.class_obj, subject=cs.subject
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                subject=cs.subject
            ).select_related('teacher').first()
        )
        if assignment is None:
            missing_teachers.append(cs.subject.name)
            continue
        hours = cs.weekly_hours
        double = cs.is_double if cs.is_double is not None else cs.subject.is_double_preferred
        if double and hours >= 2:
            suggestions.append({
                'subject': cs.subject,
                'teacher': assignment.teacher,
                'periods_per_week': (hours // 2) * 2,
                'is_double': True,
                'note': '',
            })
            if hours % 2:
                suggestions.append({
                    'subject': cs.subject,
                    'teacher': assignment.teacher,
                    'periods_per_week': 1,
                    'is_double': False,
                    'note': '',
                })
        else:
            suggestions.append({
                'subject': cs.subject,
                'teacher': assignment.teacher,
                'periods_per_week': hours,
                'is_double': False,
                'note': '',
            })

    if missing_teachers:
        return 0, 0, 0, (
            f'{timetable.class_obj.name}: no teacher assigned yet for '
            + ', '.join(missing_teachers) + '. Create teaching assignments first.'
        )

    timetable.lessons.all().delete()
    for item in suggestions:
        Lesson.objects.create(timetable=timetable, **item)

    total = sum(l['periods_per_week'] for l in suggestions)
    doubles = sum((l['periods_per_week'] // 2) for l in suggestions if l['is_double'])
    return len(suggestions), total, doubles, None


def validate_timetable(timetable):
    """
    Manual-edit checker: the same rules the generator enforces, applied to
    whatever is currently on the grid. Returns a list of issues.
    """
    slots = list(timetable.slots.select_related('subject', 'teacher', 'lesson').all())
    issues = []
    by_teacher = defaultdict(list)
    by_room = defaultdict(list)
    for slot in slots:
        by_teacher[slot.teacher_id].append(slot)
        if slot.classroom.strip():
            by_room[slot.classroom.strip().lower()].append(slot)

    def overlap(a, b):
        return a.day_of_week == b.day_of_week and _overlaps(
            a.start_time, a.end_time, b.start_time, b.end_time
        )

    for teacher_id, teacher_slots in by_teacher.items():
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

    for room, room_slots in by_room.items():
        for i, a in enumerate(room_slots):
            for b in room_slots[i + 1:]:
                if overlap(a, b):
                    issues.append({
                        'severity': 'error',
                        'type': 'room_clash',
                        'message': (
                            f'Classroom "{a.classroom}" double-booked on '
                            f'{a.get_day_of_week_display()} at {a.start_time.strftime("%H:%M")}.'
                        ),
                    })

    lessons = list(timetable.lessons.select_related('subject', 'teacher').all())
    if lessons:
        scheduled = defaultdict(int)
        for slot in slots:
            if slot.lesson_id is not None:
                scheduled[slot.lesson_id] += 1
            else:
                for lesson in lessons:
                    if lesson.subject_id == slot.subject_id and lesson.teacher_id == slot.teacher_id:
                        scheduled[lesson.id] += 1
                        break
        for lesson in lessons:
            if scheduled[lesson.id] != lesson.periods_per_week:
                issues.append({
                    'severity': 'warning',
                    'type': 'volume_mismatch',
                    'message': (
                        f'{lesson.subject.name}: scheduled {scheduled[lesson.id]} of '
                        f'{lesson.periods_per_week} required weekly periods.'
                    ),
                })

        for lesson in lessons:
            if not lesson.is_double:
                continue
            lesson_slots = [s for s in slots if s.lesson_id == lesson.id]
            period_times = timetable.period_times()
            for day in timetable.days():
                day_slots = sorted(
                    (s for s in lesson_slots if s.day_of_week == day),
                    key=lambda s: s.start_time,
                )
                if len(day_slots) % 2 != 0:
                    issues.append({
                        'severity': 'warning',
                        'type': 'double_split',
                        'message': (
                            f'Double period {lesson.subject.name} has {len(day_slots)} '
                            f'period(s) on {day_slots[0].get_day_of_week_display()} — '
                            f'it must run as full consecutive pairs.'
                        ),
                    })
                for i in range(0, len(day_slots) - 1, 2):
                    a, b = day_slots[i], day_slots[i + 1]
                    pa = _period_index(period_times, a)
                    pb = _period_index(period_times, b)
                    if pa is None or pb is None or pb != pa + 1:
                        issues.append({
                            'severity': 'warning',
                            'type': 'double_split',
                            'message': (
                                f'Double period {lesson.subject.name} is split on '
                                f'{a.get_day_of_week_display()} — the 2 periods must be '
                                f'consecutive (not separated by a break).'
                            ),
                        })

    return issues
