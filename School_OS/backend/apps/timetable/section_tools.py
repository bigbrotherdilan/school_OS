"""
Section-level timetable tooling: generation summary, feasibility check and
validation report (timetable.md sections 30-37).

These functions work on a whole section (several classes) so the admin can:

  * preview what the generator will load before running it,
  * see exactly why a section cannot be generated yet, and
  * validate the generated grid the same way the solver does.

Conflict detection is student-group aware: two slots of the same class only
clash when their groups actually share students (parallel streams are valid).
"""
from collections import defaultdict

from .solver import _to_time, _period_index, _overlaps, _slot_group_overlap


def _teacher_name(teacher):
    try:
        return teacher.user.full_name
    except AttributeError:
        return f'#{teacher.id}'


def section_generation_data(classes, class_subjects, assignments):
    """
    Build the "Load Section Data" preview (plan section 30):
    classes, teachers, subjects, assignments, required lessons, available slots.

    classes       - list of academic.Class of the section
    class_subjects- iterable of ClassSubject rows for those classes
    assignments   - iterable of TeachingAssignment rows for those classes
    """
    classes = list(classes)
    class_subjects = list(class_subjects)
    assignments = list(assignments)

    teachers = {}
    for assignment in assignments:
        if assignment.teacher_id not in teachers:
            teachers[assignment.teacher_id] = assignment.teacher

    subjects = {}
    for cs in class_subjects:
        if cs.subject_id not in subjects:
            subjects[cs.subject_id] = cs.subject

    by_class = defaultdict(lambda: {'hours': 0, 'subjects': 0, 'teachers': set()})
    for cs in class_subjects:
        info = by_class[cs.academic_class_id]
        info['hours'] += cs.weekly_hours or 0
        info['subjects'] += 1
        for assignment in assignments:
            if assignment.academic_class_id == cs.academic_class_id and assignment.subject_id == cs.subject_id:
                info['teachers'].add(assignment.teacher_id)

    return {
        'classes': len(classes),
        'teachers': len(teachers),
        'subjects': len(subjects),
        'assignments': len(assignments),
        'required_lessons': sum(cs.weekly_hours or 0 for cs in class_subjects),
        'per_class': [
            {
                'class_name': cls.name,
                'weekly_hours': by_class[cls.id]['hours'],
                'subject_count': by_class[cls.id]['subjects'],
                'assigned_teachers': len(by_class[cls.id]['teachers']),
            }
            for cls in classes
        ],
        'teacher_list': [
            {
                'id': str(t.id),
                'name': _teacher_name(t),
                'assignments': sum(1 for a in assignments if a.teacher_id == t.id),
            }
            for t in teachers.values()
        ],
    }


def _day_grid(periods, working_days, day_periods=None):
    """{day: [periods]} template, honouring per-day (half-day) overrides."""
    day_periods = day_periods or {}
    return {
        d: day_periods.get(str(d), day_periods.get(d)) or periods
        for d in working_days
    }


def section_feasibility(tenant_id, classes, periods=None, working_days=None,
                        day_periods=None, blocked_slots=None, existing_blocks=None):
    """
    Pre-generation feasibility check (plan section 31). Returns a list of
    explainable issues so the admin can fix the data before generating.

    * class/group capacity: required weekly hours <= available teaching slots
    * teacher capacity: required periods <= available free cells (availability + other sections)
    * teacher availability: a lesson has at least one possible slot

    existing_blocks: dict {(teacher_id, day): [(start,end), ...]} from other sections' slots.
    """
    from .models import Timetable, TeacherUnavailability

    issues = []
    periods = periods or Timetable.DEFAULT_PERIODS
    working_days = working_days or Timetable.DEFAULT_WORKING_DAYS
    grid = _day_grid(periods, working_days, day_periods)
    slots_per_week = sum(len(grid[d]) for d in grid)

    availability = defaultdict(lambda: defaultdict(list))
    for window in TeacherUnavailability.objects.filter(teacher__tenant_id=tenant_id):
        availability[window.teacher_id][window.day_of_week].append(
            (_to_time(window.start_time), _to_time(window.end_time))
        )

    blocked = defaultdict(list)
    for block in blocked_slots or []:
        try:
            blocked[int(block['day'])].append(
                (_to_time(block['start']), _to_time(block['end']))
            )
        except (KeyError, TypeError, ValueError):
            continue

    from apps.staff.models import TeachingAssignment
    assignments = list(TeachingAssignment.objects.filter(
        academic_class__in=classes
    ).select_related('teacher', 'subject', 'academic_class'))

    by_teacher = defaultdict(int)
    for cls in classes:
        class_subjects = list(
            cls.class_subjects.filter(weekly_hours__gt=0).select_related('subject', 'student_group')
        )
        cohort_hours = sum(cs.weekly_hours or 0 for cs in class_subjects if cs.student_group_id is None)
        groups = {}
        for cs in class_subjects:
            if cs.student_group_id is not None:
                groups.setdefault(cs.student_group_id, 0)
                groups[cs.student_group_id] += cs.weekly_hours or 0
        checks = {'full cohort': cohort_hours}
        for cs in class_subjects:
            if cs.student_group_id is not None:
                checks[f'group {cs.student_group.name}'] = (
                    cohort_hours + groups[cs.student_group_id]
                )
        for label, total in checks.items():
            if total > slots_per_week:
                issues.append({
                    'severity': 'error',
                    'class_name': cls.name,
                    'message': (
                        f'{cls.name} ({label}) requires {total} lesson periods per week but '
                        f'the week only has {slots_per_week} teaching slots '
                        f'({len(working_days)} days, half-days included). Reduce weekly hours '
                        f'or add periods/days.'
                    ),
                })

    matched = set()
    for cls in classes:
        for cs in cls.class_subjects.filter(weekly_hours__gt=0).select_related('subject', 'student_group'):
            assignment = next(
                (a for a in assignments
                 if a.academic_class_id == cls.id and a.subject_id == cs.subject_id
                 and a.student_group_id == cs.student_group_id),
                None,
            ) or next(
                (a for a in assignments
                 if a.academic_class_id == cls.id and a.subject_id == cs.subject_id),
                None,
            )
            if assignment is None:
                issues.append({
                    'severity': 'warning',
                    'class_name': cls.name,
                    'message': (
                        f'{cls.name}: subject {cs.subject.name}'
                        + (f' ({cs.student_group.name})' if cs.student_group_id else '')
                        + f' has {cs.weekly_hours} weekly hours but no teacher is assigned '
                        f'to teach it. Timetable will be generated with TBD teacher.'
                    ),
                })
                continue
            matched.add(assignment.id)
            by_teacher[assignment.teacher_id] += cs.weekly_hours or 0

    for teacher_id, units in by_teacher.items():
        free_cells = 0
        blocked_other = 0
        blocked_unavail = 0
        blocked_school = 0
        for day, day_periods in grid.items():
            for period in day_periods:
                p_start = _to_time(period['start'])
                p_end = _to_time(period['end'])
                blocked_by_other = existing_blocks and any(
                    _overlaps(p_start, p_end, s, e)
                    for s, e in existing_blocks.get((teacher_id, day), [])
                )
                blocked_by_unavail = any(
                    _overlaps(p_start, p_end, s, e)
                    for s, e in availability[teacher_id].get(day, [])
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
                    free_cells += 1
        if units > free_cells:
            teacher = next((a.teacher for a in assignments if a.teacher_id == teacher_id), None)
            name = _teacher_name(teacher) if teacher else f'#{teacher_id}'
            parts = []
            if blocked_other:
                parts.append(f'{blocked_other} slot(s) taken by lessons they already teach in other sections')
            if blocked_unavail:
                parts.append(f'{blocked_unavail} slot(s) blocked by unavailability')
            if blocked_school:
                parts.append(f'{blocked_school} slot(s) blocked by breaks/assembly')
            issues.append({
                'severity': 'error',
                'class_name': '',
                'message': (
                    f'{name} must teach {units} lesson periods in this section but only '
                    f'{free_cells} cells are free after {" and ".join(parts)}. Free up a '
                    f'day, reduce workload, or redistribute across teachers.'
                ),
            })

    return issues


def validate_section(timetables):
    """
    Full section validation report (plan sections 36-37). Checks the same hard
    constraints the solver enforces, over every class of the section together:
    teacher conflicts (incl. cross-class), student-group conflicts, availability,
    half-day/break/boundary guards, double-period integrity and weekly volume.
    """
    from .models import TeacherUnavailability, TimeSlot

    issues = []
    timetables = list(timetables)
    periods = timetables[0].period_times() if timetables else []
    working_days = timetables[0].days() if timetables else []

    slots = list(TimeSlot.objects.filter(
        timetable__in=timetables
    ).select_related('subject', 'teacher', 'lesson', 'timetable__class_obj', 'student_group', 'room'))

    by_teacher = defaultdict(list)
    for slot in slots:
        if slot.teacher_id:
            by_teacher[slot.teacher_id].append(slot)

    def overlap(a, b):
        return a.day_of_week == b.day_of_week and _overlaps(
            a.start_time, a.end_time, b.start_time, b.end_time
        )

    # Teacher conflicts: no teacher teaches two classes at the same time.
    for teacher_id, teacher_slots in by_teacher.items():
        for i, a in enumerate(teacher_slots):
            for b in teacher_slots[i + 1:]:
                if overlap(a, b):
                    issues.append({
                        'severity': 'error',
                        'type': 'teacher_clash',
                        'message': (
                            f'{a.teacher.user.full_name if hasattr(a.teacher, "user") else teacher_id} '
                            f'teaches {a.subject.name} in {a.timetable.class_obj.name} and '
                            f'{b.subject.name} in {b.timetable.class_obj.name} both on '
                            f'{a.get_day_of_week_display()} at {a.start_time.strftime("%H:%M")}.'
                        ),
                    })

    # Student-group conflicts: same class, same time, overlapping groups.
    by_class_slot = defaultdict(list)
    for slot in slots:
        by_class_slot[(slot.timetable_id, slot.day_of_week, slot.start_time, slot.end_time)].append(slot)
    for (tt_id, day, start, end), slots_at in by_class_slot.items():
        if len(slots_at) < 2:
            continue
        tt = next(t for t in timetables if t.id == tt_id)
        for i, a in enumerate(slots_at):
            for b in slots_at[i + 1:]:
                if _slot_group_overlap(tt, a.student_group_id, b.student_group_id):
                    group_a = a.student_group.name if a.student_group_id else 'full cohort'
                    group_b = b.student_group.name if b.student_group_id else 'full cohort'
                    issues.append({
                        'severity': 'error',
                        'type': 'student_clash',
                        'message': (
                            f'{a.subject.name} ({group_a}) and {b.subject.name} ({group_b}) '
                            f'in {a.timetable.class_obj.name} both on '
                            f'{a.get_day_of_week_display()} at {a.start_time.strftime("%H:%M")} '
                            f'— the same students would have to attend both.'
                        ),
                    })

    # Availability violations.
    availability = defaultdict(lambda: defaultdict(list))
    for window in TeacherUnavailability.objects.filter(teacher__in=[s.teacher for s in slots if s.teacher]):
        availability[window.teacher_id][window.day_of_week].append(
            (_to_time(window.start_time), _to_time(window.end_time))
        )
    for slot in slots:
        if not slot.teacher_id:
            continue
        blocked = any(
            _overlaps(slot.start_time, slot.end_time, s, e)
            for s, e in availability[slot.teacher_id].get(slot.day_of_week, [])
        )
        if blocked:
            issues.append({
                'severity': 'error',
                'type': 'availability',
                'message': (
                    f'{slot.subject.name} in {slot.timetable.class_obj.name} is scheduled '
                    f'on {slot.get_day_of_week_display()} at {slot.start_time.strftime("%H:%M")} '
                    f'— inside a teacher unavailability window.'
                ),
            })

    # Room double-booking (rooms and free-text classrooms).
    by_room = defaultdict(list)
    for slot in slots:
        if slot.room_id:
            by_room[f'room:{slot.room_id}'].append(slot)
        elif slot.classroom.strip():
            by_room[f'text:{slot.classroom.strip().lower()}'].append(slot)
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

    # School boundary + half-day + break guard: every slot must line up with
    # the configured grid of its day and never sit inside a blocked period.
    for tt in timetables:
        for slot in slots:
            if slot.timetable_id != tt.id:
                continue
            if slot.day_of_week not in tt.days():
                issues.append({
                    'severity': 'error',
                    'type': 'boundary',
                    'message': (
                        f'{slot.subject.name} in {tt.class_obj.name} is on '
                        f'{slot.get_day_of_week_display()}, a non-working day.'
                    ),
                })
                continue
            day_periods = tt.periods_for_day(slot.day_of_week)
            if _period_index(day_periods, slot) is None:
                issues.append({
                    'severity': 'error',
                    'type': 'boundary',
                    'message': (
                        f'{slot.subject.name} in {tt.class_obj.name} starts at '
                        f'{slot.start_time.strftime("%H:%M")} on '
                        f'{slot.get_day_of_week_display()} — outside that day\'s configured '
                        f'period grid (a break, lunch or half-day limit).'
                    ),
                })
            for block in tt.blocked_for_day(slot.day_of_week):
                if _overlaps(
                    slot.start_time, slot.end_time,
                    _to_time(block['start']), _to_time(block['end']),
                ):
                    issues.append({
                        'severity': 'error',
                        'type': 'blocked_period',
                        'message': (
                            f'{slot.subject.name} in {tt.class_obj.name} on '
                            f'{slot.get_day_of_week_display()} at '
                            f'{slot.start_time.strftime("%H:%M")} sits inside a blocked '
                            f'period ("{block.get("label") or "break"}").'
                        ),
                    })

    for tt in timetables:
        for lesson in tt.lessons.select_related('subject', 'teacher', 'student_group').all():
            scheduled = sum(1 for s in slots if s.lesson_id == lesson.id)
            if scheduled != lesson.periods_per_week:
                issues.append({
                    'severity': 'error',
                    'type': 'volume',
                    'class_name': tt.class_obj.name,
                    'message': (
                        f'{tt.class_obj.name}: {lesson.subject.name}'
                        + (f' ({lesson.student_group.name})' if lesson.student_group_id else '')
                        + f' must run {lesson.periods_per_week} period(s)/week but '
                        f'{scheduled} are scheduled.'
                    ),
                })
            allocs = list(lesson.allocations.all())
            if allocs and sum(a.periods for a in allocs) != lesson.periods_per_week:
                issues.append({
                    'severity': 'error',
                    'type': 'allocation_volume',
                    'class_name': tt.class_obj.name,
                    'message': (
                        f'{tt.class_obj.name}: {lesson.subject.name}'
                        + (f' ({lesson.student_group.name})' if lesson.student_group_id else '')
                        + f' is split across {len(allocs)} teachers for '
                        f'{sum(a.periods for a in allocs)} periods/week, but the subject '
                        f'requires {lesson.periods_per_week}. The allocations must sum to '
                        f'the required weekly volume.'
                    ),
                })
            if not lesson.is_double:
                continue
            lesson_slots = [s for s in slots if s.lesson_id == lesson.id]
            expected_pairs = lesson.periods_per_week // 2
            expected_singles = lesson.periods_per_week % 2
            counted_pairs = 0
            counted_singles = 0
            for day in tt.days():
                day_list = sorted(
                    (s for s in lesson_slots if s.day_of_week == day),
                    key=lambda s: s.start_time,
                )
                i = 0
                while i < len(day_list):
                    a = day_list[i]
                    b = day_list[i + 1] if i + 1 < len(day_list) else None
                    pa = _period_index(tt.periods_for_day(day), a)
                    pb = _period_index(tt.periods_for_day(day), b) if b else None
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
                    'class_name': tt.class_obj.name,
                    'message': (
                        f'{tt.class_obj.name}: {lesson.subject.name}'
                        + (f' ({lesson.student_group.name})' if lesson.student_group_id else '')
                        + f' requires {expected_pairs} double session(s) and {expected_singles} '
                        f'single(s) ({lesson.periods_per_week} periods/week), but '
                        f'{counted_pairs} double(s) and {counted_singles} single(s) were found. '
                        f'A double is two consecutive periods on the same day — two periods on '
                        f'different days are never a double.'
                    ),
                })

    grouped = defaultdict(list)
    for issue in issues:
        grouped[issue.get('class_name') or 'Every class'].append(issue)
    return {
        'valid': not any(i['severity'] == 'error' for i in issues),
        'count': len(issues),
        'by_class': dict(grouped),
        'issues': issues,
    }


def validate_section_against_school(timetables):
    """
    School-level validation (spec §17-18, 20): every slot of the section is
    checked against the COMMITTED school schedule (APPROVED/PUBLISHED
    timetables of the same tenant + academic year, excluding this section).

    Only committed timetables own resources school-wide: drafts and generated
    but uncommitted timetables never clash. Red issues mean the section cannot
    reserve a teacher or room an approved timetable already owns.

    Returns a report dict shaped exactly like validate_section().
    """
    from .models import TimeSlot
    from .solver import _cross_section_clashes, committed_slots

    timetables = list(timetables)
    if not timetables:
        return {'valid': True, 'count': 0, 'by_class': {}, 'issues': []}

    section_ids = {t.id for t in timetables}
    root = timetables[0]
    committed = [s for s in committed_slots(root) if s.timetable_id not in section_ids]
    slots = list(TimeSlot.objects.filter(
        timetable__in=timetables
    ).select_related('subject', 'teacher', 'lesson', 'timetable__class_obj',
                     'student_group', 'room'))

    issues = []
    for slot in slots:
        for clash in _cross_section_clashes(slot, committed):
            clash = dict(clash)
            clash['class_name'] = slot.timetable.class_obj.name
            issues.append(clash)

    grouped = defaultdict(list)
    for issue in issues:
        grouped[issue.get('class_name') or 'Every class'].append(issue)
    return {
        'valid': not any(i['severity'] == 'error' for i in issues),
        'count': len(issues),
        'by_class': dict(grouped),
        'issues': issues,
    }
