import json
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from datetime import datetime
from django.utils import timezone
from django.db.models import Q, Count

from .models import (
    Timetable, TimeSlot, Lesson, TeacherUnavailability, StudentGroup, Room, TeacherAllocation,
)
from .serializers import (
    TimetableSerializer, TimetableListSerializer, TimeSlotSerializer, LessonSerializer,
    TeacherUnavailabilitySerializer, StudentGroupSerializer, RoomSerializer,
    TeacherAllocationSerializer,
)
from .solver import SchoolSolver, suggest_lessons_for, validate_timetable, _slot_group_overlap
from apps.authentication.permissions import IsSchoolMember
from apps.academic.models import Term, Class, AcademicYear, Subject
from apps.staff.models import Teacher, TeachingAssignment


def _same_year_timetables(request, academic_year_id, exclude_id=None, exclude_ids=None):
    """All timetables of the tenant for a given academic year (used for global clash-freedom)."""
    qs = Timetable.objects.filter(
        tenant_id=request.tenant_id,
        academic_year_id=academic_year_id,
    ).select_related('class_obj', 'academic_year')
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)
    elif exclude_id:
        qs = qs.exclude(id=exclude_id)
    return list(qs)


def _parse_week(payload):
    """
    Validate an optional school-week payload: {periods: [{start, end}],
    working_days: [...], day_periods: {day: [periods]}, blocked_slots: [...]}.
    Returns (periods, working_days, day_periods, blocked_slots). None values
    mean "not provided".
    """
    periods = None
    working_days = None
    day_periods = None
    blocked_slots = None

    def _valid_period_list(raw, label):
        if not isinstance(raw, list) or len(raw) < 2:
            raise ValidationError(f'{label} needs at least 2 periods.')
        out = []
        for item in raw:
            try:
                start = item['start']
                end = item['end']
            except (KeyError, TypeError):
                raise ValidationError(f'{label}: each period needs a start and an end time (HH:MM-HH:MM).')
            try:
                datetime.strptime(start, '%H:%M')
                datetime.strptime(end, '%H:%M')
            except (TypeError, ValueError):
                raise ValidationError(f'{label}: invalid period time "{start}-{end}" — use HH:MM.')
            if start >= end:
                raise ValidationError(f'{label}: period "{start}-{end}" must end after it starts.')
            out.append({'start': start, 'end': end})
        return out

    if 'periods' in payload and payload['periods'] is not None:
        periods = _valid_period_list(payload['periods'], 'The school week')
    if 'working_days' in payload and payload['working_days'] is not None:
        raw = payload['working_days']
        if not isinstance(raw, list) or not raw:
            raise ValidationError('Select at least one working day.')
        working_days = [int(d) for d in raw]
        if not all(1 <= d <= 6 for d in working_days):
            raise ValidationError('Working days must be between 1 (Monday) and 6 (Saturday).')
    if 'day_periods' in payload and payload['day_periods'] is not None:
        raw = payload['day_periods']
        if not isinstance(raw, dict):
            raise ValidationError('day_periods must be a map of day → period list.')
        day_periods = {}
        for day_key, day_list in raw.items():
            day = int(day_key)
            if not 1 <= day <= 7:
                raise ValidationError(f'day_periods: day {day} must be between 1 and 7.')
            day_periods[str(day)] = _valid_period_list(day_list, f'day_periods[{day}]')
    if 'blocked_slots' in payload and payload['blocked_slots'] is not None:
        raw = payload['blocked_slots']
        if not isinstance(raw, list):
            raise ValidationError('blocked_slots must be a list of {day, start, end, label}.')
        blocked_slots = []
        for item in raw:
            try:
                day = int(item['day'])
                start = item['start']
                end = item['end']
            except (KeyError, TypeError, ValueError):
                raise ValidationError('Each blocked slot needs day, start and end (HH:MM).')
            try:
                datetime.strptime(start, '%H:%M')
                datetime.strptime(end, '%H:%M')
            except (TypeError, ValueError):
                raise ValidationError(f'blocked slot "{start}-{end}" must use HH:MM times.')
            if start >= end:
                raise ValidationError(f'blocked slot "{start}-{end}" must end after it starts.')
            blocked_slots.append({
                'day': day,
                'start': start,
                'end': end,
                'label': (item.get('label') or 'break').strip()[:50],
            })
    return periods, working_days, day_periods, blocked_slots


def _sync_lesson_teachers(timetable):
    """
    Update the teacher on existing lesson cards from the current
    TeachingAssignments, so new or changed assignments are reflected even
    when lessons already exist (the cards are only rebuilt when empty).
    Returns the number of lessons whose teacher changed.
    """
    from apps.staff.models import TeachingAssignment
    updated = 0
    lessons = timetable.lessons.select_related('subject', 'student_group').all()
    for lesson in lessons:
        assignment = (
            TeachingAssignment.objects.filter(
                academic_class=timetable.class_obj, subject=lesson.subject,
                student_group=lesson.student_group,
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                subject=lesson.subject, student_group=lesson.student_group,
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                academic_class=timetable.class_obj, subject=lesson.subject,
            ).select_related('teacher').first()
            or TeachingAssignment.objects.filter(
                subject=lesson.subject
            ).select_related('teacher').first()
        )
        new_teacher = assignment.teacher if assignment else None
        new_teacher_id = new_teacher.id if new_teacher else None
        if lesson.teacher_id != new_teacher_id:
            lesson.teacher = new_teacher
            lesson.save(update_fields=['teacher'])
            updated += 1
    return updated


class TimetableViewSet(viewsets.ModelViewSet):
    serializer_class = TimetableSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_serializer_class(self):
        if self.action == 'list':
            return TimetableListSerializer
        return TimetableSerializer

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return Timetable.objects.filter(
            tenant_id=tenant_id,
        ).select_related(
            'class_obj', 'class_obj__stream', 'academic_year', 'term', 'approved_by',
        ).annotate(
            slot_count=Count('slots'),
            lesson_count=Count('lessons'),
        ).order_by('class_obj__name')

    def perform_create(self, serializer):
        year_id = self.request.data.get('academic_year')
        year = AcademicYear.objects.filter(
            id=year_id, academic_year__tenant_id=self.request.tenant_id
        ).first() if hasattr(AcademicYear.objects, 'academic_year__tenant_id') else AcademicYear.objects.filter(
            id=year_id, tenant_id=self.request.tenant_id
        ).first()
        if not year:
            raise ValidationError('Select a valid academic year for your school.')
        class_id = self.request.data.get('class_obj')
        if Timetable.objects.filter(
            tenant_id=self.request.tenant_id,
            academic_year_id=year.id,
            class_obj_id=class_id,
        ).exists():
            raise ValidationError('This class already has a timetable for this academic year.')
        serializer.save(tenant_id=self.request.tenant_id, academic_year_id=year.id)

    @action(detail=True, methods=['post'])
    def suggest_lessons(self, request, pk=None):
        """Create the lesson cards from each subject's weekly hours."""
        timetable = self.get_object()
        created, total, doubles, error = suggest_lessons_for(timetable)
        if error:
            raise ValidationError(error)
        return Response({
            'lessons_created': created,
            'total_periods': total,
            'double_periods': doubles,
            'message': (
                f'Created {created} lessons ({total} periods/week'
                + (f', {doubles} double session(s) — the default rule doubles every '
                   f'subject the class week can host; use the is_double toggle to '
                   f'override' if doubles else '')
                + '). Ready to generate.'
            ),
        })

    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        """
        Generate for one class, keeping every other class's slots fixed:
        the repair can never clash with the rest of the school.
        """
        timetable = self.get_object()
        if not timetable.lessons.exists():
            raise ValidationError('No lessons to schedule yet. Run "Suggest lessons" first.')
        others = _same_year_timetables(request, timetable.academic_year_id, exclude_id=timetable.id)
        solver = SchoolSolver(
            [timetable] + others,
            target_ids={timetable.id},
        )
        result = solver.solve()
        return Response(result, status=status.HTTP_200_OK if result['ok'] else status.HTTP_422_UNPROCESSABLE_ENTITY)

    @action(detail=False, methods=['post'])
    def create_for_section(self, request):
        """
        Materialise (get-or-create) one timetable per class of a section/year
        so the workspace can open grids before anything is generated.
        """
        year_id = request.data.get('academic_year')
        if not year_id:
            raise ValidationError('Select an academic year.')
        year = AcademicYear.objects.filter(
            id=year_id, tenant_id=request.tenant_id
        ).first()
        if not year:
            raise ValidationError('Select a valid academic year for your school.')

        stream_id = request.data.get('stream')
        classes = Class.objects.filter(tenant_id=request.tenant_id).select_related('stream')
        if stream_id:
            if str(stream_id).lower() in ['none', 'null', 'unassigned']:
                classes = classes.filter(stream__isnull=True)
            else:
                classes = classes.filter(stream_id=stream_id)
        classes = list(classes.order_by('cycle__order', 'level_order', 'name'))
        if not classes:
            raise ValidationError('No classes found for the selected section.')

        periods, working_days, day_periods, blocked_slots = _parse_week(request.data)

        created = []
        for cls in classes:
            tt, was_created = Timetable.objects.get_or_create(
                tenant_id=request.tenant_id,
                academic_year_id=year.id,
                class_obj_id=cls.id,
                defaults={'is_active': True},
            )
            if periods is not None or working_days is not None or day_periods is not None or blocked_slots is not None:
                update = {}
                if periods is not None:
                    update['periods'] = periods
                if working_days is not None:
                    update['working_days'] = working_days
                if day_periods is not None:
                    update['day_periods'] = day_periods
                if blocked_slots is not None:
                    update['blocked_slots'] = blocked_slots
                Timetable.objects.filter(id=tt.id).update(**update)
            created.append({
                'id': tt.id,
                'class_name': cls.name,
                'class_obj': str(cls.id),
                'academic_year': year.id,
                'section_name': cls.stream.name if cls.stream else '',
                'academic_year_name': year.name,
                'created': was_created,
                'lessons': tt.lessons.count(),
                'slots': tt.slots.count(),
                'generation_status': tt.generation_status,
            })
        return Response({'classes': created, 'count': len(created)})

    @action(detail=False, methods=['post'])
    def generate_school(self, request):
        """
        Two modes, matching how schools actually build timetables:

        - No section: ALL classes of the year solved together in one model,
          guaranteed clash-free school-wide.
        - With section: solve only that section (sequential, the anglophone
          way — few teachers teach across sections). Every other section's
          existing slots are passed in as fixed teacher blocks, so a teacher
          who already teaches in another section is never double-booked here.
        """
        year_id = request.data.get('academic_year')
        if not year_id:
            raise ValidationError('Select an academic year to generate.')
        year = AcademicYear.objects.filter(
            id=year_id, tenant_id=request.tenant_id
        ).first()
        if not year:
            raise ValidationError('Select a valid academic year for your school.')

        stream_id = request.data.get('stream')
        classes = Class.objects.filter(tenant_id=request.tenant_id).select_related('stream')
        if stream_id:
            if str(stream_id).lower() in ['none', 'null', 'unassigned']:
                classes = classes.filter(stream__isnull=True)
            else:
                classes = classes.filter(stream_id=stream_id)
        classes = list(classes.order_by('cycle__order', 'level_order', 'name'))
        if not classes:
            raise ValidationError('No classes found for the selected section.')

        timetables = []
        for cls in classes:
            tt, _ = Timetable.objects.get_or_create(
                tenant_id=request.tenant_id,
                academic_year_id=year.id,
                class_obj_id=cls.id,
                defaults={'is_active': True},
            )
            timetables.append(tt)

        periods, working_days, day_periods, blocked_slots = _parse_week(request.data)
        if periods is not None or working_days is not None or day_periods is not None or blocked_slots is not None:
            for tt in timetables:
                update = {}
                if periods is not None:
                    update['periods'] = periods
                if working_days is not None:
                    update['working_days'] = working_days
                if day_periods is not None:
                    update['day_periods'] = day_periods
                if blocked_slots is not None:
                    update['blocked_slots'] = blocked_slots
                Timetable.objects.filter(id=tt.id).update(**update)
                tt.periods = periods if periods is not None else tt.periods
                tt.working_days = working_days if working_days is not None else tt.working_days
                tt.day_periods = day_periods if day_periods is not None else tt.day_periods
                tt.blocked_slots = blocked_slots if blocked_slots is not None else tt.blocked_slots

        force = bool(request.data.get('force'))
        skipped = []
        ready = []
        for tt in timetables:
            if tt.generation_status == Timetable.GenerationStatus.PUBLISHED and not force:
                skipped.append({
                    'class_name': tt.class_obj.name,
                    'reason': 'already published — unpublish it or regenerate with force to replace it.',
                })
                continue
            if not tt.lessons.exists():
                created, total, doubles, error = suggest_lessons_for(tt)
                if error:
                    skipped.append({'class_name': tt.class_obj.name, 'reason': error})
                    continue
            else:
                # Lessons already exist (possibly with TBD teachers): re-sync
                # their teachers from the current TeachingAssignments so new
                # assignments show up without wiping the lesson cards.
                _sync_lesson_teachers(tt)
            ready.append(tt)

        if not ready:
            reasons = '\n'.join(f'- {s["class_name"]}: {s["reason"]}' for s in skipped)
            raise ValidationError(
                'No class is ready to generate yet.\n' + reasons
            )

        target_ids = {tt.id for tt in ready}
        if stream_id:
            others = _same_year_timetables(request, year.id, exclude_ids=target_ids)
            cross_count = TimeSlot.objects.filter(timetable__in=others).filter(
                Q(is_locked=True) | Q(timetable__generation_status__in=[
                    Timetable.GenerationStatus.APPROVED, Timetable.GenerationStatus.PUBLISHED,
                ])
            ).count()
            solver = SchoolSolver(ready + others, target_ids=target_ids)
            result = solver.solve()
            if result['ok']:
                result['skipped'] = skipped
                result['generated_classes'] = [r['class_name'] for r in result.get('classes', [])]
                section_name = classes[0].stream.name if classes[0].stream else ''
                msg = (
                    f'Scheduled {result["placed_periods"]} lesson periods across '
                    f'{len(target_ids)} class(es) in {section_name}. '
                )
                if cross_count:
                    msg += (
                        f'{cross_count} existing slot(s) from other sections were '
                        f'respected — shared teachers are never double-booked.'
                    )
                else:
                    msg += 'Teachers are clash-free.'
                result['message'] = msg
                result['cross_section_slots_respected'] = cross_count
            return Response(result, status=status.HTTP_200_OK if result['ok'] else status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Whole-year mode: classes may run different bell schedules (e.g. a
        # 9-period anglophone section next to an 8-period francophone one).
        # The solver needs one shared grid per model, so group the ready
        # classes by identical week and solve each group separately. Every
        # other group's committed/locked slots stay fixed, so shared teachers
        # are never double-booked across groups.
        others = _same_year_timetables(request, year.id, exclude_ids=target_ids)
        groups = {}
        for tt in ready:
            sig = json.dumps({d: tt.periods_for_day(d) for d in tt.days()}, sort_keys=True)
            groups.setdefault(sig, []).append(tt)

        results = []
        total_placed = 0
        total_cross = 0
        generated = []
        for sig, group in groups.items():
            group_ids = {tt.id for tt in group}
            other_tts = others + [t for t in ready if t.id not in group_ids]
            cross_count = TimeSlot.objects.filter(timetable__in=other_tts).filter(
                Q(is_locked=True) | Q(timetable__generation_status__in=[
                    Timetable.GenerationStatus.APPROVED, Timetable.GenerationStatus.PUBLISHED,
                ])
            ).count()
            solver = SchoolSolver(group + other_tts, target_ids=group_ids)
            result = solver.solve()
            results.append(result)
            if result['ok']:
                total_placed += result.get('placed_periods', 0)
                generated.extend(r['class_name'] for r in result.get('classes', []))
                total_cross += cross_count

        if all(r['ok'] for r in results):
            msg = f'Scheduled {total_placed} lesson periods across {len(ready)} class(es). '
            if len(groups) > 1:
                msg += (
                    f'{len(groups)} different school weeks were solved separately — '
                    'shared teachers stay clash-free across them.'
                )
            else:
                msg += 'Teachers are clash-free.'
            if total_cross:
                msg += (
                    f' {total_cross} existing committed/locked slot(s) were respected — '
                    'shared teachers are never double-booked.'
                )
            return Response({
                'ok': True,
                'message': msg,
                'generated_classes': generated,
                'placed_periods': total_placed,
                'groups': len(groups),
                'cross_section_slots_respected': total_cross,
                'skipped': skipped,
            }, status=status.HTTP_200_OK)
        bad = next(r for r in results if not r['ok'])
        return Response(bad, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    @action(detail=True, methods=['get'])
    def validate(self, request, pk=None):
        timetable = self.get_object()
        issues = validate_timetable(timetable)
        return Response({
            'valid': not any(i['severity'] == 'error' for i in issues),
            'issues': issues,
            'count': len(issues),
        })

    @action(detail=True, methods=['post'])
    def under_review(self, request, pk=None):
        """
        Mark a generated timetable as UNDER_REVIEW: it is the admin's working
        draft for manual editing. It reserves no school-wide resources yet.
        """
        timetable = self.get_object()
        if timetable.is_committed():
            raise ValidationError(
                'This timetable is committed. Revert it from the school schedule before '
                'editing it again.'
            )
        timetable.generation_status = Timetable.GenerationStatus.UNDER_REVIEW
        timetable.save(update_fields=['generation_status', 'updated_at'])
        return Response({
            'status': timetable.generation_status,
            'message': (
                f'{timetable.class_obj.name} is now UNDER REVIEW. It is the working draft — '
                f'it reserves no school-wide resources yet.'
            ),
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve/commit a timetable to the school schedule (spec §6-7, §24-25).
        Only RED (hard) validation errors block approval; YELLOW availability
        warnings and GRAY unassigned (TBD) slots may be approved. Once
        approved, its teachers and rooms are reserved school-wide and every
        other section generates around it.
        """
        timetable = self.get_object()
        if timetable.is_committed():
            raise ValidationError('This timetable is already committed to the school schedule.')
        issues = validate_timetable(timetable)
        blockers = [i for i in issues if i['severity'] == 'error']
        if blockers:
            raise ValidationError(
                'This timetable has hard clashes that must be fixed before approval:\n'
                + '\n'.join(f'- {i["message"]}' for i in blockers)
            )
        timetable.generation_status = Timetable.GenerationStatus.APPROVED
        timetable.approved_by = request.user
        timetable.approved_at = timezone.now()
        timetable.save(update_fields=[
            'generation_status', 'approved_by', 'approved_at', 'updated_at',
        ])
        return Response({
            'status': timetable.generation_status,
            'message': (
                f'{timetable.class_obj.name} is now APPROVED. Its teachers and rooms are '
                f'reserved school-wide — other sections will schedule around it.'
            ),
        })

    @action(detail=False, methods=['post'])
    def validate_section(self, request):
        """
        Validation report for a whole section (spec §17-18): teacher
        conflicts across all classes, availability, boundaries and weekly
        volume, so the admin sees exactly what is wrong before/after
        generation. Also validates the section AGAINST the committed school
        schedule (validate_section_against_school): a section may never
        reserve a teacher or room an approved timetable already owns.
        """
        from .section_tools import validate_section, validate_section_against_school
        year = self._section_year(request)
        classes = self._section_classes(request, year)
        timetables = list(Timetable.objects.filter(
            tenant_id=request.tenant_id,
            academic_year_id=year.id,
            class_obj__in=classes,
        ).select_related('class_obj', 'academic_year'))
        if not timetables:
            raise ValidationError('No timetables exist yet for this section. Open the workspace first.')
        report = validate_section(timetables)
        school_report = validate_section_against_school(timetables)
        report['school'] = school_report
        report['valid'] = report['valid'] and school_report['valid']
        report['count'] += school_report['count']
        return Response(report)

    @action(detail=False, methods=['post'])
    def section_data(self, request):
        """
        "Load Section Data" preview (plan section 30): classes, teachers,
        subjects, assignments and required lesson volume for the section.
        """
        from .section_tools import section_generation_data
        from apps.staff.models import TeachingAssignment
        from apps.academic.models import ClassSubject
        year = self._section_year(request)
        classes = self._section_classes(request, year)
        class_subjects = ClassSubject.objects.filter(
            academic_class__in=classes, weekly_hours__gt=0
        ).select_related('subject')
        assignments = TeachingAssignment.objects.filter(
            academic_class__in=classes
        ).select_related('teacher', 'subject')
        data = section_generation_data(classes, class_subjects, assignments)
        shared_teachers, _ = self._cross_section_data(request, year, classes)
        data['shared_teachers'] = shared_teachers
        return Response(data)

    @action(detail=False, methods=['post'])
    def check_section(self, request):
        """
        Pre-generation feasibility check (plan section 31): class capacity,
        missing teacher assignment, teacher capacity after availability + other sections.
        """
        from .section_tools import section_feasibility
        year = self._section_year(request)
        classes = self._section_classes(request, year)
        periods, working_days, day_periods, blocked_slots = _parse_week(request.data)
        shared_teachers, existing_blocks = self._cross_section_data(request, year, classes)
        issues = section_feasibility(
            request.tenant_id, classes, periods, working_days,
            day_periods, blocked_slots, existing_blocks,
        )
        shared_teacher_count = len(shared_teachers)
        return Response({
            'ready': not any(i['severity'] == 'error' for i in issues),
            'issues': issues,
            'count': len(issues),
            'shared_teachers': shared_teachers,
            'shared_teacher_count': shared_teacher_count,
        })

    @action(detail=False, methods=['post'])
    def teacher_availability_summary(self, request):
        from apps.staff.models import TeachingAssignment
        from .models import TeacherUnavailability
        year = self._section_year(request)
        classes = self._section_classes(request, year)
        assignments = TeachingAssignment.objects.filter(
            academic_class__in=classes
        ).select_related('teacher__user', 'subject', 'academic_class')
        
        teachers = {}
        for assignment in assignments:
            if assignment.teacher:
                t = assignment.teacher
                if t.id not in teachers:
                    teachers[t.id] = {
                        'id': str(t.id),
                        'name': t.user.full_name if hasattr(t, 'user') else f'Teacher {t.employee_id}',
                        'assignments': [],
                        'windows': []
                    }
                teachers[t.id]['assignments'].append(
                    f"{assignment.subject.name} ({assignment.academic_class.name})"
                )
                
        windows = TeacherUnavailability.objects.filter(
            tenant_id=request.tenant_id,
            teacher_id__in=teachers.keys()
        )
        for w in windows:
            teachers[w.teacher_id]['windows'].append({
                'id': str(w.id),
                'day_of_week': w.day_of_week,
                'start_time': w.start_time.strftime('%H:%M'),
                'end_time': w.end_time.strftime('%H:%M'),
                'reason': w.reason
            })

        periods = list(
            Timetable.objects.filter(
                tenant_id=request.tenant_id,
                academic_year_id=year.id,
                class_obj__in=classes,
                periods__isnull=False,
            ).exclude(periods=[]).values_list('periods', flat=True)
        )
        if not periods:
            periods = [Timetable.DEFAULT_PERIODS]
        day_start = min(p['start'] for p in periods[0])
        day_end = max(p['end'] for p in periods[0])
        for template in periods:
            day_start = min(day_start, min(p['start'] for p in template))
            day_end = max(day_end, max(p['end'] for p in template))

        return Response({
            'teachers': list(teachers.values()),
            'day_start': day_start,
            'day_end': day_end,
        })

    @action(detail=False, methods=['post'])
    def publish(self, request):
        """
        Publish the generated timetables of a section (plan sections 60-61):
        they become the official schedule and cannot be silently overwritten.
        """
        year = self._section_year(request)
        classes = self._section_classes(request, year)
        unpublished = [c.name for c in classes]
        count = Timetable.objects.filter(
            tenant_id=request.tenant_id, academic_year_id=year.id, class_obj__in=classes,
        ).exclude(generation_status__in=[
            Timetable.GenerationStatus.PUBLISHED, Timetable.GenerationStatus.ARCHIVED,
        ]).update(generation_status=Timetable.GenerationStatus.PUBLISHED)
        return Response({
            'published': count,
            'message': f'Published {count} timetable(s) for this section. '
                       f'New generations will only update published classes after explicit approval.',
        })

    @action(detail=False, methods=['post'])
    def unpublish(self, request):
        year = self._section_year(request)
        classes = self._section_classes(request, year)
        count = Timetable.objects.filter(
            tenant_id=request.tenant_id, academic_year_id=year.id, class_obj__in=classes,
        ).filter(generation_status=Timetable.GenerationStatus.PUBLISHED).update(
            generation_status=Timetable.GenerationStatus.GENERATED
        )
        return Response({
            'unpublished': count,
            'message': f'Unpublished {count} timetable(s) for this section.',
        })

    @action(detail=True, methods=['post'])
    def unapprove(self, request, pk=None):
        """
        Reverse an approval: the timetable goes back to GENERATED and releases
        its school-wide reservations of teachers and rooms, so other sections
        may schedule around it again (spec §6-7).
        """
        timetable = self.get_object()
        if timetable.generation_status not in Timetable.COMMITTED_STATUSES:
            raise ValidationError('Only approved/published timetables can be unapproved.')
        was_published = timetable.generation_status == Timetable.GenerationStatus.PUBLISHED
        timetable.generation_status = Timetable.GenerationStatus.GENERATED
        timetable.approved_by = None
        timetable.approved_at = None
        timetable.save(update_fields=[
            'generation_status', 'approved_by', 'approved_at', 'updated_at',
        ])
        return Response({
            'status': timetable.generation_status,
            'message': (
                f'{timetable.class_obj.name} is back to GENERATED. Its teachers and rooms are '
                f'released — other sections can schedule around it again.'
            ),
            'was_published': was_published,
        })

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """
        Export one or more timetables to a single PDF (one page per class).
        GET /timetable/timetables/export_pdf/?ids=<id>,<id>... — all tenant
        timetables when no ids given. Keeps the class-by-class order.
        """
        from django.http import HttpResponse
        from apps.tenants.models import Tenant
        from .pdf_export import generate_timetable_pdf

        ids = [i for i in (request.query_params.get('ids') or '').split(',') if i]
        qs = self.get_queryset().select_related(
            'class_obj', 'class_obj__stream', 'academic_year', 'term'
        ).prefetch_related(
            'slots__subject', 'slots__teacher__user', 'slots__student_group',
            'slots__room', 'lessons__allocations__teacher__user',
        )
        if ids:
            qs = qs.filter(id__in=ids)
        timetables = list(qs)
        if not timetables:
            raise ValidationError('Select at least one timetable to export.')

        tenant = Tenant.objects.get(id=request.tenant_id)
        buffer = generate_timetable_pdf(timetables, tenant)

        year_name = timetables[0].academic_year.name if timetables[0].academic_year_id else 'Timetables'
        filename = f'{tenant.school_name}_Timetables_{year_name}.pdf'.replace(' ', '_')
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _section_year(self, request):
        year_id = request.data.get('academic_year') or request.query_params.get('academic_year')
        if not year_id:
            raise ValidationError('Select an academic year.')
        year = AcademicYear.objects.filter(
            id=year_id, tenant_id=request.tenant_id
        ).first()
        if not year:
            raise ValidationError('Select a valid academic year for your school.')
        return year

    def _section_classes(self, request, year):
        stream_id = request.data.get('stream') or request.query_params.get('stream')
        classes = Class.objects.filter(tenant_id=request.tenant_id).select_related('stream')
        if stream_id:
            if str(stream_id).lower() in ['none', 'null', 'unassigned']:
                classes = classes.filter(stream__isnull=True)
            else:
                classes = classes.filter(stream_id=stream_id)
        classes = list(classes.order_by('cycle__order', 'level_order', 'name'))
        if not classes:
            raise ValidationError('No classes found for the selected section.')
        return classes

    def _cross_section_data(self, request, year, classes):
        """
        Build shared_teachers list and existing_blocks dict for the section.
        existing_blocks: {(teacher_id, day): [(start, end), ...]} — only from
        COMMITTED (approved/published) or LOCKED slots of other sections,
        because drafts and uncommitted timetables reserve no resources
        (spec §6-7).
        """
        from collections import defaultdict
        from .solver import _to_time
        from .models import TimeSlot
        from apps.staff.models import TeachingAssignment

        class_ids = {c.id for c in classes}
        other_tts = Timetable.objects.filter(
            tenant_id=request.tenant_id, academic_year_id=year.id
        ).exclude(class_obj_id__in=class_ids)
        committed_tts = other_tts.filter(generation_status__in=[
            Timetable.GenerationStatus.APPROVED, Timetable.GenerationStatus.PUBLISHED,
        ])
        committed_ids = set(committed_tts.values_list('id', flat=True))

        blocks = defaultdict(list)
        for slot in TimeSlot.objects.filter(timetable__in=other_tts).values(
            'timetable_id', 'is_locked', 'teacher_id', 'day_of_week',
            'start_time', 'end_time',
        ):
            if slot['teacher_id'] is None:
                continue
            if slot['timetable_id'] not in committed_ids and not slot['is_locked']:
                continue  # uncommitted drafts reserve no teacher resource
            blocks[(slot['teacher_id'], slot['day_of_week'])].append(
                (_to_time(slot['start_time']), _to_time(slot['end_time']))
            )

        section_teacher_ids = set(
            TeachingAssignment.objects.filter(
                academic_class__in=classes
            ).values_list('teacher_id', flat=True).distinct()
        )
        other_class_ids = set(
            Class.objects.filter(
                tenant_id=request.tenant_id
            ).exclude(id__in=class_ids).values_list('id', flat=True)
        )
        shared_ids = []
        for tid in section_teacher_ids:
            if other_class_ids and TeachingAssignment.objects.filter(
                teacher_id=tid, academic_class_id__in=list(other_class_ids)
            ).exists():
                shared_ids.append(tid)

        teacher_map = {}
        for ta in TeachingAssignment.objects.filter(teacher_id__in=shared_ids).select_related('teacher'):
            if ta.teacher_id not in teacher_map:
                teacher_map[ta.teacher_id] = ta.teacher

        shared_teachers = []
        for tid in shared_ids:
            teacher = teacher_map.get(tid)
            name = teacher.user.full_name if teacher and hasattr(teacher.user, 'full_name') else f'#{tid}'
            other_count = TeachingAssignment.objects.filter(
                teacher_id=tid, academic_class_id__in=list(other_class_ids)
            ).count() if other_class_ids else 0
            shared_teachers.append({
                'id': str(tid),
                'name': name,
                'other_assignments': other_count,
            })

        return shared_teachers, dict(blocks)


class TimeSlotViewSet(viewsets.ModelViewSet):
    serializer_class = TimeSlotSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = TimeSlot.objects.filter(timetable__tenant_id=tenant_id)
        timetable_id = self.request.query_params.get('timetable')
        if timetable_id:
            qs = qs.filter(timetable_id=timetable_id)
        # Teachers only ever see their own slots on the list endpoint,
        # so "My Timetable" never bleeds into other teachers' schedules.
        teacher = Teacher.objects.filter(
            user=self.request.user, tenant_id=tenant_id
        ).first()
        if teacher is not None:
            # Teachers see their own slots extracted from the committed
            # (approved/published) admin timetables across ALL sections,
            # plus their own locked personal slots — never drafts.
            qs = qs.filter(
                Q(timetable__generation_status__in=Timetable.COMMITTED_STATUSES)
                | Q(is_locked=True),
                teacher=teacher,
            ).select_related(
                'subject', 'subject__cycle', 'teacher__user',
                'timetable__class_obj', 'timetable__class_obj__stream',
                'student_group', 'room',
            ).prefetch_related(
                'teacher__assignments__subject',
                'teacher__assignments__academic_class',
            )
        else:
            qs = qs.select_related('subject', 'teacher__user', 'timetable__class_obj')
        return qs

    @action(detail=False, methods=['get', 'post'])
    def my_slots(self, request):
        """
        Teacher's own schedule, and a way to input it manually when the
        school timetable has nothing assigned yet.

        GET  → all slots where this teacher is assigned.
        POST → create a personal slot {class_id, subject_id, day_of_week,
               start_time, end_time, classroom}. The slot is placed on the
               class's active timetable and locked so regeneration keeps it.
        """
        tenant_id = request.tenant_id
        teacher = Teacher.objects.filter(user=request.user, tenant_id=tenant_id).first()
        if not teacher:
            raise ValidationError('No teacher profile found for your account.')

        if request.method == 'GET':
            slots = TimeSlot.objects.filter(
                timetable__tenant_id=tenant_id, teacher=teacher,
            ).filter(
                Q(timetable__generation_status__in=Timetable.COMMITTED_STATUSES)
                | Q(is_locked=True),
            ).select_related(
                'subject', 'teacher', 'timetable__class_obj', 'room',
            ).order_by(
                'day_of_week', 'start_time'
            )
            return Response(TimeSlotSerializer(slots, many=True).data)

        class_id = request.data.get('class_id')
        subject_id = request.data.get('subject_id')
        try:
            day = int(request.data.get('day_of_week'))
        except (TypeError, ValueError):
            raise ValidationError('Select a valid day.')
        start = request.data.get('start_time')
        end = request.data.get('end_time')
        classroom = (request.data.get('classroom') or '').strip()

        if not class_id or not subject_id:
            raise ValidationError('Select a class and a subject.')
        if day < 1 or day > 7:
            raise ValidationError('Day must be between 1 (Monday) and 7 (Sunday).')
        try:
            datetime.strptime(start, '%H:%M')
            datetime.strptime(end, '%H:%M')
        except (TypeError, ValueError):
            raise ValidationError('Times must be in HH:MM format.')
        if start >= end:
            raise ValidationError('The lesson must end after it starts.')

        assigned = TeachingAssignment.objects.filter(
            teacher=teacher, academic_class_id=class_id, subject_id=subject_id
        ).exists()
        if not assigned:
            raise ValidationError('You are not assigned to teach that subject in that class.')

        class_obj = Class.objects.filter(id=class_id, tenant_id=tenant_id).first()
        if not class_obj:
            raise ValidationError('Invalid class.')
        subject = Subject.objects.filter(id=subject_id, tenant_id=tenant_id).first()
        if not subject:
            raise ValidationError('Invalid subject.')

        year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()
        if not year:
            year = AcademicYear.objects.filter(tenant_id=tenant_id).order_by('-start_date').first()
        if not year:
            raise ValidationError('No academic year exists yet. Ask your administrator to set one up.')

        timetable, _ = Timetable.objects.get_or_create(
            tenant_id=tenant_id,
            academic_year_id=year.id,
            class_obj=class_obj,
            defaults={'is_active': True},
        )
        self._check_conflicts(timetable, day, start, end, teacher.id, classroom)
        slot = TimeSlot.objects.create(
            timetable=timetable,
            day_of_week=day,
            start_time=start,
            end_time=end,
            subject=subject,
            teacher=teacher,
            classroom=classroom,
            is_locked=True,
        )
        return Response(TimeSlotSerializer(slot).data, status=status.HTTP_201_CREATED)

    def _check_conflicts(self, timetable, day, start, end, teacher_id, classroom, group_id=None, room_id=None, exclude_id=None):
        """
        Prevent a teacher, classroom or student group being double-booked at the
        same time. Two slots of the SAME class at the same time are only a
        conflict when their student groups actually share students — parallel
        streams (Arts/History vs Science/Chemistry) are legal.

        Resource ownership (spec §6-7): only the target timetable itself,
        LOCKED slots, and COMMITTED (approved/published) timetables reserve
        teachers and rooms. Drafts and generated-but-uncommitted timetables
        never create false conflicts.
        """
        qs = TimeSlot.objects.filter(
            timetable__tenant_id=self.request.tenant_id,
            day_of_week=day,
        ).exclude(id=exclude_id).select_related('timetable')
        for slot in qs:
            if not (slot.start_time < end and start < slot.end_time):
                continue
            same_tt = timetable is not None and slot.timetable_id == timetable.id
            reserves = same_tt or slot.is_locked or slot.timetable.is_committed()
            if not reserves:
                continue
            # Skip teacher clash check when teacher is TBD (null)
            if teacher_id is not None and slot.teacher_id == teacher_id:
                raise ValidationError(
                    f'Conflict: this teacher already teaches {slot.subject.name} in '
                    f'{slot.timetable.class_obj.name} at {slot.start_time.strftime("%H:%M")} '
                    f'on {slot.get_day_of_week_display()}.'
                )
            if classroom and slot.classroom and slot.classroom.strip().lower() == classroom.strip().lower():
                raise ValidationError(
                    f'Classroom "{classroom}" is already used by {slot.subject.name} '
                    f'({slot.timetable.class_obj.name}) at {slot.start_time.strftime("%H:%M")} '
                    f'on {slot.get_day_of_week_display()}.'
                )
            if room_id is not None and slot.room_id == room_id:
                raise ValidationError(
                    f'Room "{slot.room.name if slot.room_id else room_id}" is already used by '
                    f'{slot.subject.name} at {slot.start_time.strftime("%H:%M")} '
                    f'on {slot.get_day_of_week_display()}.'
                )
            if same_tt:
                if _slot_group_overlap(timetable, group_id, slot.student_group_id):
                    raise ValidationError(
                        f'Conflict: {slot.subject.name}'
                        + (f' ({slot.student_group.name})' if slot.student_group_id else '')
                        + f' already occupies this student group at '
                        f'{slot.start_time.strftime("%H:%M")} on {slot.get_day_of_week_display()}.'
                    )

    def _match_lesson(self, timetable, subject, teacher, group_id=None, lesson_id=None):
        """
        Link a slot to a lesson card when possible. With multi-teacher splits
        (TeacherAllocation) the lesson's own teacher may be NULL — the slot's
        teacher identifies the matching allocation instead.
        """
        if lesson_id:
            lesson = Lesson.objects.filter(id=lesson_id, timetable=timetable).first()
            if lesson is not None:
                return lesson
        lessons = list(timetable.lessons.filter(
            subject=subject, student_group_id=group_id,
        ))
        if teacher is not None:
            for lesson in lessons:
                owns = lesson.teacher_id == teacher.id or (
                    lesson.allocations.filter(teacher=teacher).exists()
                )
                if owns and lesson.slots.count() < lesson.periods_per_week:
                    return lesson
            for lesson in lessons:
                if lesson.teacher_id == teacher.id or lesson.allocations.filter(teacher=teacher).exists():
                    return lesson
        for lesson in lessons:
            if lesson.slots.count() < lesson.periods_per_week:
                return lesson
        return lessons[0] if lessons else None

    def perform_create(self, serializer):
        data = serializer.validated_data
        teacher_obj = data.get('teacher')
        group_obj = data.get('student_group')
        room_obj = data.get('room')
        self._check_conflicts(
            data['timetable'],
            data['day_of_week'],
            data['start_time'],
            data['end_time'],
            teacher_obj.id if teacher_obj else None,
            data.get('classroom', '') or '',
            group_id=group_obj.id if group_obj else None,
            room_id=room_obj.id if room_obj else None,
        )
        lesson = self._match_lesson(
            data['timetable'], data['subject'], teacher_obj,
            group_id=group_obj.id if group_obj else None,
            lesson_id=data.get('lesson'),
        )
        serializer.save(lesson=lesson)

    def perform_update(self, serializer):
        instance = serializer.instance
        data = serializer.validated_data
        teacher_obj = data.get('teacher', instance.teacher)
        group_obj = data.get('student_group', instance.student_group)
        room_obj = data.get('room', instance.room)
        self._check_conflicts(
            instance.timetable,
            data.get('day_of_week', instance.day_of_week),
            data.get('start_time', instance.start_time),
            data.get('end_time', instance.end_time),
            teacher_obj.id if teacher_obj else None,
            data.get('classroom', instance.classroom) or '',
            group_id=group_obj.id if group_obj else None,
            room_id=room_obj.id if room_obj else None,
            exclude_id=instance.id,
        )
        if instance.lesson_id is None and 'lesson' not in data:
            lesson = self._match_lesson(
                instance.timetable,
                data.get('subject', instance.subject),
                teacher_obj,
                group_id=group_obj.id if group_obj else None,
                lesson_id=None,
            )
            serializer.save(lesson=lesson)
        else:
            serializer.save()


class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        qs = Lesson.objects.filter(timetable__tenant_id=self.request.tenant_id)
        timetable_id = self.request.query_params.get('timetable')
        if timetable_id:
            qs = qs.filter(timetable_id=timetable_id)
        return qs

    def perform_create(self, serializer):
        timetable = serializer.validated_data['timetable']
        if timetable.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid timetable.')
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.timetable.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid timetable.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.timetable.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid timetable.')
        instance.delete()


class TeacherUnavailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = TeacherUnavailabilitySerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        qs = TeacherUnavailability.objects.filter(tenant_id=self.request.tenant_id)
        teacher_id = self.request.query_params.get('teacher')
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        return qs

    def perform_create(self, serializer):
        teacher = serializer.validated_data['teacher']
        if str(teacher.tenant_id) != self.request.tenant_id:
            raise ValidationError('Invalid teacher.')
        serializer.save(tenant_id=self.request.tenant_id)


class StudentGroupViewSet(viewsets.ModelViewSet):
    """
    Configurable student groups/streams inside a class (Arts, Science,
    Commercial...). Subjects can target a group; parallel groups may run
    different subjects at the same time without clashing.
    """
    serializer_class = StudentGroupSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        qs = StudentGroup.objects.filter(tenant_id=self.request.tenant_id)
        class_id = self.request.query_params.get('class')
        if class_id:
            qs = qs.filter(academic_class_id=class_id)
        return qs

    def perform_create(self, serializer):
        cls = serializer.validated_data['academic_class']
        if str(cls.tenant_id) != self.request.tenant_id:
            raise ValidationError('Invalid class.')
        serializer.save(tenant_id=self.request.tenant_id)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid group.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid group.')
        instance.delete()


class RoomViewSet(viewsets.ModelViewSet):
    """
    Physical rooms/resources (classrooms, labs, workshops). Rooms are never
    double-booked: same room + same time across classes is a conflict.
    """
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        return Room.objects.filter(tenant_id=self.request.tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid room.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid room.')
        instance.delete()


class TeacherAllocationViewSet(viewsets.ModelViewSet):
    """
    Period-level teacher splits of a lesson (spec §11-13): each allocation is
    one teacher teaching `periods` periods/week of the subject. The sum of a
    lesson's allocations must equal its weekly volume; a NULL teacher is an
    explicit UNASSIGNED placeholder (TBD) that reserves no real resource.
    """
    serializer_class = TeacherAllocationSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        qs = TeacherAllocation.objects.filter(
            lesson__timetable__tenant_id=self.request.tenant_id
        ).select_related('teacher')
        lesson_id = self.request.query_params.get('lesson')
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        return qs

    def perform_create(self, serializer):
        lesson = serializer.validated_data['lesson']
        if lesson.timetable.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid lesson.')
        if serializer.validated_data.get('teacher') is not None:
            teacher = serializer.validated_data['teacher']
            if teacher.tenant_id != self.request.tenant_id:
                raise ValidationError('Invalid teacher.')
        if serializer.validated_data.get('periods', 0) <= 0:
            raise ValidationError('Every allocation needs at least 1 period.')
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.lesson.timetable.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid allocation.')
        if serializer.validated_data.get('teacher') is not None:
            teacher = serializer.validated_data['teacher']
            if teacher.tenant_id != self.request.tenant_id:
                raise ValidationError('Invalid teacher.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.lesson.timetable.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid allocation.')
        instance.delete()
