from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from datetime import datetime

from .models import Timetable, TimeSlot, Lesson, TeacherUnavailability
from .serializers import TimetableSerializer, TimeSlotSerializer, LessonSerializer, TeacherUnavailabilitySerializer
from .solver import SchoolSolver, suggest_lessons_for, validate_timetable
from apps.authentication.permissions import IsSchoolMember
from apps.academic.models import Term, Class


def _same_term_timetables(request, term, exclude_id=None, exclude_ids=None):
    """All timetables of the tenant for a given term (used for global clash-freedom)."""
    qs = Timetable.objects.filter(
        tenant_id=request.tenant_id,
        term_id=term.id,
    ).select_related('class_obj', 'term', 'academic_year')
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)
    elif exclude_id:
        qs = qs.exclude(id=exclude_id)
    return list(qs)


def _parse_week(payload):
    """
    Validate an optional school-week payload: {periods: [{start, end}], working_days: [...]}.
    Returns (periods, working_days) or raises ValidationError. None values mean "not provided".
    """
    periods = None
    working_days = None
    if 'periods' in payload and payload['periods'] is not None:
        raw = payload['periods']
        if not isinstance(raw, list) or len(raw) < 2:
            raise ValidationError('The school week needs at least 2 periods.')
        periods = []
        for item in raw:
            try:
                start = item['start']
                end = item['end']
            except (KeyError, TypeError):
                raise ValidationError('Each period needs a start and an end time (HH:MM-HH:MM).')
            try:
                datetime.strptime(start, '%H:%M')
                datetime.strptime(end, '%H:%M')
            except (TypeError, ValueError):
                raise ValidationError(f'Invalid period time "{start}-{end}" — use HH:MM.')
            if start >= end:
                raise ValidationError(f'Period "{start}-{end}" must end after it starts.')
            periods.append({'start': start, 'end': end})
    if 'working_days' in payload and payload['working_days'] is not None:
        raw = payload['working_days']
        if not isinstance(raw, list) or not raw:
            raise ValidationError('Select at least one working day.')
        working_days = [int(d) for d in raw]
        if not all(1 <= d <= 6 for d in working_days):
            raise ValidationError('Working days must be between 1 (Monday) and 6 (Saturday).')
    return periods, working_days


class TimetableViewSet(viewsets.ModelViewSet):
    serializer_class = TimetableSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return Timetable.objects.filter(tenant_id=tenant_id).order_by('class_obj__name')

    def perform_create(self, serializer):
        term_id = self.request.data.get('term')
        term = Term.objects.filter(
            id=term_id, academic_year__tenant_id=self.request.tenant_id
        ).first()
        if not term:
            raise ValidationError('Select a valid term for your school.')
        class_id = self.request.data.get('class_obj')
        if Timetable.objects.filter(
            tenant_id=self.request.tenant_id,
            academic_year_id=term.academic_year_id,
            term_id=term.id,
            class_obj_id=class_id,
        ).exists():
            raise ValidationError('This class already has a timetable for this term.')
        serializer.save(tenant_id=self.request.tenant_id, academic_year_id=term.academic_year_id)

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
                + (f', {doubles} double period(s) for sciences/practicals' if doubles else '')
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
        others = _same_term_timetables(request, timetable.term, exclude_id=timetable.id)
        solver = SchoolSolver(
            [timetable] + others,
            target_ids={timetable.id},
        )
        result = solver.solve()
        return Response(result, status=status.HTTP_200_OK if result['ok'] else status.HTTP_422_UNPROCESSABLE_ENTITY)

    @action(detail=False, methods=['post'])
    def create_for_section(self, request):
        """
        Materialise (get-or-create) one timetable per class of a section/term
        so the workspace can open grids before anything is generated.
        """
        term_id = request.data.get('term')
        if not term_id:
            raise ValidationError('Select a term.')
        term = Term.objects.filter(
            id=term_id, academic_year__tenant_id=request.tenant_id
        ).first()
        if not term:
            raise ValidationError('Select a valid term for your school.')

        stream_id = request.data.get('stream')
        classes = Class.objects.filter(tenant_id=request.tenant_id).select_related('stream')
        if stream_id:
            classes = classes.filter(stream_id=stream_id)
        classes = list(classes.order_by('cycle__order', 'level_order', 'name'))
        if not classes:
            raise ValidationError('No classes found for the selected section.')

        created = []
        for cls in classes:
            tt, was_created = Timetable.objects.get_or_create(
                tenant_id=request.tenant_id,
                academic_year_id=term.academic_year_id,
                term_id=term.id,
                class_obj_id=cls.id,
                defaults={'is_active': True},
            )
            created.append({
                'id': tt.id,
                'class_name': cls.name,
                'class_obj': str(cls.id),
                'term': term.id,
                'section_name': cls.stream.name if cls.stream else '',
                'term_name': term.name,
                'academic_year_name': term.academic_year.name,
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

        - No section: ALL classes of the term solved together in one model,
          guaranteed clash-free school-wide.
        - With section: solve only that section (sequential, the anglophone
          way — few teachers teach across sections). Every other section's
          existing slots are passed in as fixed teacher blocks, so a teacher
          who already teaches in another section is never double-booked here.
        """
        term_id = request.data.get('term')
        if not term_id:
            raise ValidationError('Select a term to generate.')
        term = Term.objects.filter(
            id=term_id, academic_year__tenant_id=request.tenant_id
        ).first()
        if not term:
            raise ValidationError('Select a valid term for your school.')

        stream_id = request.data.get('stream')
        classes = Class.objects.filter(tenant_id=request.tenant_id).select_related('stream')
        if stream_id:
            classes = classes.filter(stream_id=stream_id)
        classes = list(classes.order_by('cycle__order', 'level_order', 'name'))
        if not classes:
            raise ValidationError('No classes found for the selected section.')

        timetables = []
        for cls in classes:
            tt, _ = Timetable.objects.get_or_create(
                tenant_id=request.tenant_id,
                academic_year_id=term.academic_year_id,
                term_id=term.id,
                class_obj_id=cls.id,
                defaults={'is_active': True},
            )
            timetables.append(tt)

        periods, working_days = _parse_week(request.data)
        if periods is not None or working_days is not None:
            for tt in timetables:
                update = {}
                if periods is not None:
                    update['periods'] = periods
                if working_days is not None:
                    update['working_days'] = working_days
                Timetable.objects.filter(id=tt.id).update(**update)
                tt.periods = periods if periods is not None else tt.periods
                tt.working_days = working_days if working_days is not None else tt.working_days

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
            ready.append(tt)

        if not ready:
            reasons = '\n'.join(f'- {s["class_name"]}: {s["reason"]}' for s in skipped)
            raise ValidationError(
                'No class is ready to generate yet.\n' + reasons
            )

        target_ids = {tt.id for tt in ready}
        if stream_id:
            others = _same_term_timetables(request, term, exclude_ids=target_ids)
            cross_count = TimeSlot.objects.filter(timetable__in=others).count()
            solver = SchoolSolver(ready + others, target_ids=target_ids)
        else:
            others = []
            cross_count = 0
            solver = SchoolSolver(ready, target_ids=target_ids)

        result = solver.solve()
        if result['ok']:
            result['skipped'] = skipped
            result['generated_classes'] = [r['class_name'] for r in result.get('classes', [])]
            if stream_id:
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

    @action(detail=True, methods=['get'])
    def validate(self, request, pk=None):
        timetable = self.get_object()
        issues = validate_timetable(timetable)
        return Response({
            'valid': not any(i['severity'] == 'error' for i in issues),
            'issues': issues,
            'count': len(issues),
        })

    @action(detail=False, methods=['post'])
    def validate_section(self, request):
        """
        Validation report for a whole section (plan section 36): teacher
        conflicts across all classes, availability, boundaries and weekly
        volume, so the admin sees exactly what is wrong before/after generation.
        """
        from .section_tools import validate_section
        term = self._section_term(request)
        classes = self._section_classes(request, term)
        timetables = list(Timetable.objects.filter(
            tenant_id=request.tenant_id,
            term_id=term.id,
            class_obj__in=classes,
        ).select_related('class_obj', 'term'))
        if not timetables:
            raise ValidationError('No timetables exist yet for this section. Open the workspace first.')
        return Response(validate_section(timetables))

    @action(detail=False, methods=['post'])
    def section_data(self, request):
        """
        "Load Section Data" preview (plan section 30): classes, teachers,
        subjects, assignments and required lesson volume for the section.
        """
        from .section_tools import section_generation_data
        from apps.staff.models import TeachingAssignment
        from apps.academic.models import ClassSubject
        term = self._section_term(request)
        classes = self._section_classes(request, term)
        class_subjects = ClassSubject.objects.filter(
            academic_class__in=classes, weekly_hours__gt=0
        ).select_related('subject')
        assignments = TeachingAssignment.objects.filter(
            academic_class__in=classes
        ).select_related('teacher', 'subject')
        data = section_generation_data(classes, class_subjects, assignments)
        shared_teachers, _ = self._cross_section_data(request, term, classes)
        data['shared_teachers'] = shared_teachers
        return Response(data)

    @action(detail=False, methods=['post'])
    def check_section(self, request):
        """
        Pre-generation feasibility check (plan section 31): class capacity,
        missing teacher assignment, teacher capacity after availability + other sections.
        """
        from .section_tools import section_feasibility
        term = self._section_term(request)
        classes = self._section_classes(request, term)
        periods, working_days = _parse_week(request.data)
        shared_teachers, existing_blocks = self._cross_section_data(request, term, classes)
        issues = section_feasibility(request.tenant_id, classes, periods, working_days, existing_blocks)
        shared_teacher_count = len(shared_teachers)
        return Response({
            'ready': not any(i['severity'] == 'error' for i in issues),
            'issues': issues,
            'count': len(issues),
            'shared_teachers': shared_teachers,
            'shared_teacher_count': shared_teacher_count,
        })

    @action(detail=False, methods=['post'])
    def publish(self, request):
        """
        Publish the generated timetables of a section (plan sections 60-61):
        they become the official schedule and cannot be silently overwritten.
        """
        term = self._section_term(request)
        classes = self._section_classes(request, term)
        unpublished = [c.name for c in classes]
        count = Timetable.objects.filter(
            tenant_id=request.tenant_id, term_id=term.id, class_obj__in=classes,
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
        term = self._section_term(request)
        classes = self._section_classes(request, term)
        count = Timetable.objects.filter(
            tenant_id=request.tenant_id, term_id=term.id, class_obj__in=classes,
        ).filter(generation_status=Timetable.GenerationStatus.PUBLISHED).update(
            generation_status=Timetable.GenerationStatus.GENERATED
        )
        return Response({
            'unpublished': count,
            'message': f'Unpublished {count} timetable(s) for this section.',
        })

    def _section_term(self, request):
        term_id = request.data.get('term') or request.query_params.get('term')
        if not term_id:
            raise ValidationError('Select a term.')
        term = Term.objects.filter(
            id=term_id, academic_year__tenant_id=request.tenant_id
        ).first()
        if not term:
            raise ValidationError('Select a valid term for your school.')
        return term

    def _section_classes(self, request, term):
        stream_id = request.data.get('stream') or request.query_params.get('stream')
        classes = Class.objects.filter(tenant_id=request.tenant_id).select_related('stream')
        if stream_id:
            classes = classes.filter(stream_id=stream_id)
        classes = list(classes.order_by('cycle__order', 'level_order', 'name'))
        if not classes:
            raise ValidationError('No classes found for the selected section.')
        return classes

    def _cross_section_data(self, request, term, classes):
        """
        Build shared_teachers list and existing_blocks dict for the section.
        existing_blocks: {(teacher_id, day): [(start, end), ...]} from other sections' slots.
        """
        from collections import defaultdict
        from .solver import _to_time
        from .models import TimeSlot
        from apps.staff.models import TeachingAssignment

        class_ids = {c.id for c in classes}
        other_tts = Timetable.objects.filter(
            tenant_id=request.tenant_id, term_id=term.id
        ).exclude(class_obj_id__in=class_ids)
        blocks = defaultdict(list)
        for slot in TimeSlot.objects.filter(timetable__in=other_tts).values(
            'teacher_id', 'day_of_week', 'start_time', 'end_time'
        ):
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
        return qs

    def _check_conflicts(self, timetable, day, start, end, teacher_id, classroom, exclude_id=None):
        """Prevent a teacher, classroom or class being double-booked at the same time."""
        qs = TimeSlot.objects.filter(
            timetable__tenant_id=self.request.tenant_id,
            day_of_week=day,
        ).exclude(id=exclude_id)
        for slot in qs:
            if slot.start_time < end and start < slot.end_time:
                if slot.teacher_id == teacher_id:
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
                if timetable is not None and slot.timetable_id == timetable.id:
                    raise ValidationError(
                        f'Conflict: {slot.subject.name} already occupies this class '
                        f'({slot.timetable.class_obj.name}) at {slot.start_time.strftime("%H:%M")} '
                        f'on {slot.get_day_of_week_display()}.'
                    )

    def _match_lesson(self, timetable, subject, teacher, lesson_id=None):
        """Link a slot to a lesson card when possible (subject + teacher match)."""
        if lesson_id:
            lesson = Lesson.objects.filter(id=lesson_id, timetable=timetable).first()
            if lesson is not None:
                return lesson
        lessons = list(timetable.lessons.filter(subject=subject, teacher=teacher))
        if not lessons:
            return None
        for lesson in lessons:
            if lesson.slots.count() < lesson.periods_per_week:
                return lesson
        return lessons[0]

    def perform_create(self, serializer):
        data = serializer.validated_data
        self._check_conflicts(
            data['timetable'],
            data['day_of_week'],
            data['start_time'],
            data['end_time'],
            data['teacher'].id,
            data.get('classroom', '') or '',
        )
        lesson = self._match_lesson(
            data['timetable'], data['subject'], data['teacher'],
            data.get('lesson'),
        )
        serializer.save(lesson=lesson)

    def perform_update(self, serializer):
        instance = serializer.instance
        data = serializer.validated_data
        self._check_conflicts(
            instance.timetable,
            data.get('day_of_week', instance.day_of_week),
            data.get('start_time', instance.start_time),
            data.get('end_time', instance.end_time),
            data.get('teacher', instance.teacher).id,
            data.get('classroom', instance.classroom) or '',
            exclude_id=instance.id,
        )
        if instance.lesson_id is None and 'lesson' not in data:
            lesson = self._match_lesson(
                instance.timetable,
                data.get('subject', instance.subject),
                data.get('teacher', instance.teacher),
                None,
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
        if teacher.tenant_id != self.request.tenant_id:
            raise ValidationError('Invalid teacher.')
        serializer.save(tenant_id=self.request.tenant_id)
