"""
Per-slot manual-editing state (spec §15-16, 22): the colour every grid cell
should render on the timetable grid.

    red    - hard clash: must be fixed before the timetable can be committed
             (student clash, teacher double-book, room double-book, cross-
             section committed resource clash, boundary/blocked-period error,
             volume/allocation errors)
    yellow - availability warning: overridable, the teacher approved it anyway
    gray   - unassigned teacher (TBD / Teacher X): reserves no real resource
    green  - valid

Precedence: red > yellow > gray > green.
"""
from collections import defaultdict

from .solver import (
    _overlaps, _period_index, _slot_group_overlap, _to_time,
    _cross_section_clashes, committed_slots,
)


def slot_conflicts(slot, timetable):
    """
    Compute the manual-edit state of one TimeSlot within its timetable.

    Returns {'level': 'red'|'yellow'|'gray'|'green',
             'conflicts': [{'severity', 'type', 'message'}]}
    """
    conflicts = []

    # --- hard: boundary + blocked period ------------------------------ #
    if slot.day_of_week not in timetable.days():
        conflicts.append({
            'severity': 'error',
            'type': 'boundary',
            'message': (
                f'{slot.subject.name} is on {slot.get_day_of_week_display()}, '
                f'a non-working day.'
            ),
        })
    else:
        day_periods = timetable.periods_for_day(slot.day_of_week)
        if _period_index(day_periods, slot) is None:
            conflicts.append({
                'severity': 'error',
                'type': 'boundary',
                'message': (
                    f'{slot.subject.name} starts at {slot.start_time.strftime("%H:%M")} '
                    f'on {slot.get_day_of_week_display()} — outside that day\'s '
                    f'configured period grid (a break, lunch or half-day limit).'
                ),
            })
        for block in timetable.blocked_for_day(slot.day_of_week):
            if _overlaps(slot.start_time, slot.end_time,
                         _to_time(block['start']), _to_time(block['end'])):
                conflicts.append({
                    'severity': 'error',
                    'type': 'blocked_period',
                    'message': (
                        f'{slot.subject.name} on {slot.get_day_of_week_display()} at '
                        f'{slot.start_time.strftime("%H:%M")} sits inside a blocked period '
                        f'("{block.get("label") or "break"}").'
                    ),
                })

    # --- hard: clashes within this timetable --------------------------- #
    peers = list(timetable.slots.exclude(pk=slot.pk).select_related(
        'subject', 'teacher', 'student_group', 'room'
    ))

    def same_cell(other):
        return other.day_of_week == slot.day_of_week and _overlaps(
            slot.start_time, slot.end_time, other.start_time, other.end_time
        )

    if slot.teacher_id:
        for other in peers:
            if same_cell(other) and slot.teacher_id == other.teacher_id:
                conflicts.append({
                    'severity': 'error',
                    'type': 'teacher_clash',
                    'message': (
                        f'{slot.subject.name} and {other.subject.name} both at '
                        f'{slot.get_day_of_week_display()} '
                        f'{slot.start_time.strftime("%H:%M")} — same teacher.'
                    ),
                })
                break

    for other in peers:
        if same_cell(other) and _slot_group_overlap(
            timetable, slot.student_group_id, other.student_group_id
        ):
            group_a = slot.student_group.name if slot.student_group_id else 'full cohort'
            group_b = other.student_group.name if other.student_group_id else 'full cohort'
            conflicts.append({
                'severity': 'error',
                'type': 'student_clash',
                'message': (
                    f'{slot.subject.name} ({group_a}) and {other.subject.name} '
                    f'({group_b}) both at {slot.get_day_of_week_display()} '
                    f'{slot.start_time.strftime("%H:%M")} — the same students would '
                    f'have to attend both.'
                ),
            })
            break

    room_key = None
    if slot.room_id:
        room_key = f'room:{slot.room_id}'
    elif slot.classroom.strip():
        room_key = f'text:{slot.classroom.strip().lower()}'
    if room_key:
        for other in peers:
            other_key = None
            if other.room_id:
                other_key = f'room:{other.room_id}'
            elif other.classroom.strip():
                other_key = f'text:{other.classroom.strip().lower()}'
            if same_cell(other) and other_key and other_key == room_key:
                label = slot.room.name if slot.room_id else slot.classroom
                conflicts.append({
                    'severity': 'error',
                    'type': 'room_clash',
                    'message': (
                        f'Room "{label}" double-booked on '
                        f'{slot.get_day_of_week_display()} at '
                        f'{slot.start_time.strftime("%H:%M")}.'
                    ),
                })
                break

    # --- red: cross-section committed school resources ----------------- #
    for clash in _cross_section_clashes(slot, committed_slots(timetable, exclude_timetable=timetable)):
        conflicts.append(clash)

    # --- yellow: teacher availability window (overridable) ------------- #
    from .models import TeacherUnavailability
    if slot.teacher_id:
        for window in TeacherUnavailability.objects.filter(
            teacher_id=slot.teacher_id, day_of_week=slot.day_of_week
        ):
            if _overlaps(slot.start_time, slot.end_time,
                         _to_time(window.start_time), _to_time(window.end_time)):
                name = slot.teacher.user.full_name if getattr(slot.teacher, 'user', None) else slot.teacher_id
                conflicts.append({
                    'severity': 'warning',
                    'type': 'availability',
                    'message': (
                        f'{slot.subject.name} on {slot.get_day_of_week_display()} '
                        f'{slot.start_time.strftime("%H:%M")} falls inside '
                        f'{name}\'s unavailability window. Overridable, but verify '
                        f'the teacher agreed.'
                    ),
                })
                break

    if not slot.teacher_id:
        conflicts.append({
            'severity': 'info',
            'type': 'unassigned',
            'message': (
                f'{slot.subject.name} on {slot.get_day_of_week_display()} '
                f'{slot.start_time.strftime("%H:%M")} has no teacher assigned (TBD). '
                f'It reserves no real teacher resource.'
            ),
        })

    if any(c['severity'] == 'error' for c in conflicts):
        level = 'red'
    elif any(c['severity'] == 'warning' for c in conflicts):
        level = 'yellow'
    elif not slot.teacher_id:
        level = 'gray'
    else:
        level = 'green'

    return {'level': level, 'conflicts': conflicts}


def timetable_cell_states(timetable):
    """
    Precompute {slot_id: {'level', 'conflicts'}} for an entire timetable in
    one pass (avoids N+1 unavailability queries from slot_conflicts).
    """
    from .models import TeacherUnavailability

    slots = list(timetable.slots.select_related(
        'subject', 'teacher', 'student_group', 'room', 'lesson'
    ).all())
    by_teacher = defaultdict(list)
    for s in slots:
        if s.teacher_id:
            by_teacher[s.teacher_id].append(s)

    # availability lookup: teacher_id -> {day: [(start, end)]}
    availability = defaultdict(lambda: defaultdict(list))
    for window in TeacherUnavailability.objects.filter(
        teacher_id__in=list(by_teacher.keys())
    ):
        availability[window.teacher_id][window.day_of_week].append(
            (_to_time(window.start_time), _to_time(window.end_time))
        )

    committed = committed_slots(timetable, exclude_timetable=timetable)

    def same_cell(a, b):
        return a.day_of_week == b.day_of_week and _overlaps(
            a.start_time, a.end_time, b.start_time, b.end_time
        )

    room_key = lambda s: (f'room:{s.room_id}' if s.room_id
                          else (f'text:{s.classroom.strip().lower()}'
                                if s.classroom.strip() else None))

    states = {}
    for slot in slots:
        conflicts = []

        # boundary + blocked
        if slot.day_of_week not in timetable.days():
            conflicts.append({
                'severity': 'error', 'type': 'boundary',
                'message': f'{slot.subject.name} is on a non-working day '
                           f'({slot.get_day_of_week_display()}).',
            })
        else:
            day_periods = timetable.periods_for_day(slot.day_of_week)
            if _period_index(day_periods, slot) is None:
                conflicts.append({
                    'severity': 'error', 'type': 'boundary',
                    'message': f'{slot.subject.name} starts at '
                               f'{slot.start_time.strftime("%H:%M")} on '
                               f'{slot.get_day_of_week_display()} — outside the '
                               f'configured period grid (break, lunch or half-day limit).',
                })
            for block in timetable.blocked_for_day(slot.day_of_week):
                if _overlaps(slot.start_time, slot.end_time,
                             _to_time(block['start']), _to_time(block['end'])):
                    conflicts.append({
                        'severity': 'error', 'type': 'blocked_period',
                        'message': f'{slot.subject.name} sits inside a blocked period '
                                   f'("{block.get("label") or "break"}").',
                    })

        # teacher clash within timetable
        if slot.teacher_id:
            for other in by_teacher.get(slot.teacher_id, []):
                if other.pk != slot.pk and same_cell(slot, other):
                    conflicts.append({
                        'severity': 'error', 'type': 'teacher_clash',
                        'message': f'{slot.subject.name} and {other.subject.name} both at '
                                   f'{slot.get_day_of_week_display()} '
                                   f'{slot.start_time.strftime("%H:%M")} — same teacher.',
                    })
                    break

        # student clash within timetable
        for other in slots:
            if other.pk == slot.pk or not same_cell(slot, other):
                continue
            if _slot_group_overlap(timetable, slot.student_group_id, other.student_group_id):
                group_a = slot.student_group.name if slot.student_group_id else 'full cohort'
                group_b = other.student_group.name if other.student_group_id else 'full cohort'
                conflicts.append({
                    'severity': 'error', 'type': 'student_clash',
                    'message': f'{slot.subject.name} ({group_a}) and {other.subject.name} '
                               f'({group_b}) both at {slot.get_day_of_week_display()} '
                               f'{slot.start_time.strftime("%H:%M")} — the same students '
                               f'would have to attend both.',
                })
                break

        # room clash within timetable
        key = room_key(slot)
        if key:
            for other in slots:
                if other.pk == slot.pk or not same_cell(slot, other):
                    continue
                other_key = room_key(other)
                if other_key and other_key == key:
                    label = slot.room.name if slot.room_id else slot.classroom
                    conflicts.append({
                        'severity': 'error', 'type': 'room_clash',
                        'message': f'Room "{label}" double-booked on '
                                   f'{slot.get_day_of_week_display()} at '
                                   f'{slot.start_time.strftime("%H:%M")}.',
                    })
                    break

        # cross-section committed resources
        for clash in _cross_section_clashes(slot, committed):
            conflicts.append(clash)

        # availability (yellow)
        if slot.teacher_id:
            for s, e in availability[slot.teacher_id].get(slot.day_of_week, []):
                if _overlaps(slot.start_time, slot.end_time, s, e):
                    name = slot.teacher.user.full_name if getattr(slot.teacher, 'user', None) \
                        else slot.teacher_id
                    conflicts.append({
                        'severity': 'warning', 'type': 'availability',
                        'message': f'{slot.subject.name} on {slot.get_day_of_week_display()} '
                                   f'{slot.start_time.strftime("%H:%M")} falls inside '
                                   f'{name}\'s unavailability window. Overridable.',
                    })
                    break

        if not slot.teacher_id:
            conflicts.append({
                'severity': 'info', 'type': 'unassigned',
                'message': f'{slot.subject.name} has no teacher assigned (TBD). It '
                           f'reserves no real teacher resource.',
            })

        if any(c['severity'] == 'error' for c in conflicts):
            level = 'red'
        elif any(c['severity'] == 'warning' for c in conflicts):
            level = 'yellow'
        elif not slot.teacher_id:
            level = 'gray'
        else:
            level = 'green'

        states[str(slot.pk)] = {'level': level, 'conflicts': conflicts}

    return states
