"""
Section-level timetable tooling: generation summary, feasibility check and
validation report (timetable.md sections 30-37).

These functions work on a whole section (several classes) so the admin can:

  * preview what the generator will load before running it,
  * see exactly why a section cannot be generated yet, and
  * validate the generated grid the same way the solver does.
"""
from collections import defaultdict

from .solver import _to_time, _period_index, _overlaps


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


def section_feasibility(tenant_id, classes, periods=None, working_days=None, existing_blocks=None):
    """
    Pre-generation feasibility check (plan section 31). Returns a list of
    explainable issues so the admin can fix the data before generating.

    * class capacity: required weekly hours <= available teaching slots
    * teacher capacity: required periods <= available free cells (availability + other sections)
    * teacher availability: a lesson has at least one possible slot

    existing_blocks: dict {(teacher_id, day): [(start,end), ...]} from other sections' slots.
    """
    from .models import Timetable, TeacherUnavailability

    issues = []
    periods = periods or Timetable.DEFAULT_PERIODS
    working_days = working_days or Timetable.DEFAULT_WORKING_DAYS
    slots_per_week = len(periods) * len(working_days)

    availability = defaultdict(lambda: defaultdict(list))
    for window in TeacherUnavailability.objects.filter(teacher__tenant_id=tenant_id):
        availability[window.teacher_id][window.day_of_week].append(
            (_to_time(window.start_time), _to_time(window.end_time))
        )

    by_teacher = defaultdict(int)
    classes = list(classes)
    for cls in classes:
        total = 0
        class_subjects = list(cls.class_subjects.filter(weekly_hours__gt=0))
        for cs in class_subjects:
            required = cs.weekly_hours or 0
            total += required
        if total > slots_per_week:
            issues.append({
                'severity': 'error',
                'class_name': cls.name,
                'message': (
                    f'{cls.name} requires {total} lesson periods per week but the week '
                    f'only has {slots_per_week} teaching slots ({len(working_days)} days × '
                    f'{len(periods)} periods). Reduce weekly hours or add periods/days.'
                ),
            })

    from apps.staff.models import TeachingAssignment
    assignments = list(TeachingAssignment.objects.filter(
        academic_class__in=classes
    ).select_related('teacher', 'subject', 'academic_class'))
    by_teacher = defaultdict(int)
    matched = set()
    for cls in classes:
        for cs in cls.class_subjects.filter(weekly_hours__gt=0).select_related('subject'):
            assignment = next(
                (a for a in assignments
                 if a.academic_class_id == cls.id and a.subject_id == cs.subject_id),
                None,
            )
            if assignment is None:
                issues.append({
                    'severity': 'error',
                    'class_name': cls.name,
                    'message': (
                        f'{cls.name}: subject {cs.subject.name} has {cs.weekly_hours} '
                        f'weekly hours but no teacher is assigned to teach it. Create a '
                        f'teaching assignment for this subject.'
                    ),
                })
                continue
            matched.add(assignment.id)
            by_teacher[assignment.teacher_id] += cs.weekly_hours or 0

for teacher_id, units in by_teacher.items():
        free_cells = 0
        blocked_other = 0
        blocked_unavail = 0
        for day in working_days:
            for period in periods:
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
                if blocked_by_other:
                    blocked_other += 1
                elif blocked_by_unavail:
                    blocked_unavail += 1
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
    teacher conflicts (incl. cross-class), class conflicts, availability,
    double-period integrity and weekly volume.
    """
    from .models import TeacherUnavailability, TimeSlot

    issues = []
    timetables = list(timetables)
    periods = timetables[0].period_times() if timetables else []
    working_days = timetables[0].days() if timetables else []

    slots = list(TimeSlot.objects.filter(
        timetable__in=timetables
    ).select_related('subject', 'teacher', 'lesson', 'timetable__class_obj'))

    by_teacher = defaultdict(list)
    for slot in slots:
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

    # Availability violations.
    availability = defaultdict(lambda: defaultdict(list))
    for window in TeacherUnavailability.objects.filter(teacher__in=[s.teacher for s in slots]):
        availability[window.teacher_id][window.day_of_week].append(
            (_to_time(window.start_time), _to_time(window.end_time))
        )
    for slot in slots:
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

    # School boundary + break guard: every slot must line up with a configured period.
    for slot in slots:
        if slot.day_of_week not in working_days:
            issues.append({
                'severity': 'error',
                'type': 'boundary',
                'message': (
                    f'{slot.subject.name} in {slot.timetable.class_obj.name} is on '
                    f'{slot.get_day_of_week_display()}, a non-working day.'
                ),
            })
            continue
        if _period_index(periods, slot) is None:
            issues.append({
                'severity': 'error',
                'type': 'boundary',
                'message': (
                    f'{slot.subject.name} in {slot.timetable.class_obj.name} starts at '
                    f'{slot.start_time.strftime("%H:%M")}, outside the configured school '
                    f'period grid (a break).'
                ),
            })

    for tt in timetables:
        for lesson in tt.lessons.select_related('subject', 'teacher').all():
            scheduled = sum(1 for s in slots if s.lesson_id == lesson.id)
            if scheduled != lesson.periods_per_week:
                issues.append({
                    'severity': 'error',
                    'type': 'volume',
                    'class_name': tt.class_obj.name,
                    'message': (
                        f'{tt.class_obj.name}: {lesson.subject.name} must run '
                        f'{lesson.periods_per_week} period(s)/week but {scheduled} are '
                        f'scheduled.'
                    ),
                })
            if not lesson.is_double:
                continue
            day_slots = defaultdict(list)
            for s in slots:
                if s.lesson_id == lesson.id:
                    day_slots[s.day_of_week].append(s)
            for day, day_list in day_slots.items():
                day_list.sort(key=lambda s: s.start_time)
                if len(day_list) % 2 != 0:
                    issues.append({
                        'severity': 'error',
                        'type': 'double_split',
                        'class_name': tt.class_obj.name,
                        'message': (
                            f'{tt.class_obj.name}: {lesson.subject.name} must run as full '
                            f'consecutive double periods.'
                        ),
                    })
                    continue
                for i in range(0, len(day_list) - 1, 2):
                    a, b = day_list[i], day_list[i + 1]
                    pa = _period_index(periods, a)
                    pb = _period_index(periods, b)
                    if pa is None or pb is None or pb != pa + 1:
                        issues.append({
                            'severity': 'error',
                            'type': 'double_split',
                            'class_name': tt.class_obj.name,
                            'message': (
                                f'{tt.class_obj.name}: {lesson.subject.name} is split on '
                                f'{a.get_day_of_week_display()} — double periods must be '
                                f'consecutive (not separated by a break).'
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