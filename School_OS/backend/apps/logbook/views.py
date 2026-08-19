import hashlib
import time
from django.utils import timezone
from django.db.models import Count, Max, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import SchemeOfWork, LogbookEntry, CurriculumModule, CurriculumLesson
from .serializers import (
    SchemeOfWorkSerializer, LogbookEntrySerializer,
    CurriculumModuleSerializer, CurriculumLessonSerializer
)
from ..authentication.permissions import IsSchoolMember, IsSchoolAdmin
from ..staff.models import Teacher, TeachingAssignment
from ..academic.models import AcademicYear, Term, Subject, Class

class CurriculumModuleViewSet(viewsets.ModelViewSet):
    serializer_class = CurriculumModuleSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def _school_subject_ids(self, tenant_id):
        """Subjects added to the school = linked to a section or a class."""
        return set(
            Subject.objects.filter(
                tenant_id=tenant_id,
                section_subjects__section__tenant_id=tenant_id,
            ).values_list('id', flat=True)
        ) | set(
            Subject.objects.filter(
                tenant_id=tenant_id,
                class_subjects__academic_class__tenant_id=tenant_id,
            ).values_list('id', flat=True)
        )

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        subject_id = self.request.query_params.get('subject')
        class_id = self.request.query_params.get('class')
        qs = CurriculumModule.objects.filter(tenant_id=tenant_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if class_id:
            qs = qs.filter(academic_class_id=class_id)

        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                assigned_subjects = TeachingAssignment.objects.filter(teacher=teacher).values_list('subject_id', flat=True)
                assigned_classes = TeachingAssignment.objects.filter(teacher=teacher).values_list('academic_class_id', flat=True)
                qs = qs.filter(
                    subject_id__in=assigned_subjects,
                    academic_class_id__in=assigned_classes,
                )
            else:
                qs = qs.none()

        return qs

    def perform_create(self, serializer):
        tenant_id = self.request.tenant_id
        subject = serializer.validated_data.get('subject')
        academic_class = serializer.validated_data.get('academic_class')
        if subject is None or subject.tenant_id != tenant_id:
            raise PermissionDenied('This subject does not belong to your school.')
        if academic_class is None or academic_class.tenant_id != tenant_id:
            raise PermissionDenied('This class does not belong to your school.')
        if subject.id not in self._school_subject_ids(tenant_id):
            raise PermissionDenied(
                f'{subject.name} is not added to your school yet. '
                'Assign it to a section or class first (School Setup → Subjects).'
            )
        teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
        serializer.save(tenant_id=tenant_id, created_by=teacher)

    @action(detail=False, methods=['get'])
    def school_coverage(self, request):
        """
        Yearly curriculum coverage across the school, one row per class + subject.
        A class+subject without modules is shown at 0%. Admins see every subject
        added to the school; teachers see only the subjects they teach.
        """
        tenant_id = request.tenant_id
        is_admin = request.user.role_mappings.filter(
            tenant_id=tenant_id, role__in=['admin', 'super_admin']
        ).exists()

        school_subjects = Subject.objects.filter(
            tenant_id=tenant_id,
            section_subjects__section__tenant_id=tenant_id,
        ).distinct() | Subject.objects.filter(
            tenant_id=tenant_id,
            class_subjects__academic_class__tenant_id=tenant_id,
        ).distinct()

        classes = Class.objects.filter(tenant_id=tenant_id)

        if not is_admin:
            teacher = Teacher.objects.filter(user=request.user, tenant_id=tenant_id).first()
            if teacher is None:
                return Response({'results': []})
            assignments = TeachingAssignment.objects.filter(teacher=teacher)
            school_subjects = school_subjects.filter(
                id__in=assignments.values_list('subject_id', flat=True)
            )
            classes = classes.filter(
                id__in=assignments.values_list('academic_class_id', flat=True)
            )

        module_rows = (
            CurriculumModule.objects.filter(tenant_id=tenant_id)
            .values('subject_id', 'subject__name', 'subject__code', 'academic_class_id')
            .annotate(total_modules=Count('id'))
            .order_by('subject__name')
        )
        max_order_by_class_subject = (
            CurriculumModule.objects.filter(tenant_id=tenant_id)
            .values('subject_id', 'academic_class_id')
            .annotate(max_order=Max('order'))
        )

        lesson_stats = (
            CurriculumLesson.objects.filter(module__tenant_id=tenant_id)
            .values('module__subject_id', 'module__academic_class_id')
            .annotate(
                total_lessons=Count('id'),
                completed_lessons=Count('id', filter=Q(is_completed=True)),
            )
        )

        by_class_subject = {
            (row['academic_class_id'], row['subject_id']): row for row in module_rows
        }
        lesson_by_class_subject = {
            (row['module__academic_class_id'], row['module__subject_id']): row for row in lesson_stats
        }
        max_order_map = {
            (row['academic_class_id'], row['subject_id']): row['max_order']
            for row in max_order_by_class_subject
        }

        results = []
        total_lessons = total_completed = total_modules = 0
        class_names = {c.id: c.name for c in classes}
        for subject in school_subjects:
            for class_obj in classes:
                key = (class_obj.id, subject.id)
                mrow = by_class_subject.get(key, {})
                lrow = lesson_by_class_subject.get(key, {})
                lessons = lrow.get('total_lessons', 0)
                completed = lrow.get('completed_lessons', 0)
                total_lessons += lessons
                total_completed += completed
                total_modules += mrow.get('total_modules', 0)
                results.append({
                    'class_id': class_obj.id,
                    'class_name': class_names[class_obj.id],
                    'subject_id': subject.id,
                    'subject_name': subject.name,
                    'subject_code': subject.code,
                    'total_modules': mrow.get('total_modules', 0),
                    'total_lessons': lessons,
                    'completed_lessons': completed,
                    'progress': round((completed / lessons) * 100) if lessons else 0,
                    'next_module_order': max_order_map.get(key, 0) + 1,
                })

        results.sort(key=lambda r: (r['class_name'], r['subject_name']))

        return Response({
            'results': results,
            'total_class_subjects': len(results),
            'total_modules': total_modules,
            'total_lessons': total_lessons,
            'total_completed': total_completed,
            'overall_progress': round((total_completed / total_lessons) * 100) if total_lessons else 0,
        })

    @action(detail=False, methods=['post'], url_path='copy-scheme')
    def copy_scheme(self, request):
        """
        Copy an existing scheme (modules + lessons) from one class to another
        for the same subject — e.g. share the Form 1 scheme across Form 1A/B/C.

        Body: {"subject": <id>, "source_class": <id>, "target_class": <id>}
        If the target already has modules for this subject, pass
        "overwrite": true to replace them, otherwise it fails with a conflict.
        Copies never share instances: each class keeps its own modules/lessons,
        so per-class coverage stays independent.
        """
        tenant_id = request.tenant_id
        subject = Subject.objects.filter(tenant_id=tenant_id, id=request.data.get('subject')).first()
        source_class = Class.objects.filter(tenant_id=tenant_id, id=request.data.get('source_class')).first()
        target_class = Class.objects.filter(tenant_id=tenant_id, id=request.data.get('target_class')).first()

        if subject is None or source_class is None or target_class is None:
            raise PermissionDenied('Subject, source class and target class must belong to your school.')

        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher is None:
                raise PermissionDenied('You are not allowed to copy schemes.')
            assignments = TeachingAssignment.objects.filter(teacher=teacher)
            if target_class.id not in assignments.values_list('academic_class_id', flat=True):
                raise PermissionDenied('You can only assign schemes to classes you teach.')

        source_modules = list(
            CurriculumModule.objects
            .filter(tenant_id=tenant_id, academic_class=source_class, subject=subject)
            .prefetch_related('lessons')
            .order_by('order')
        )
        if not source_modules:
            raise ValidationError(
                f'{source_class.name} has no scheme for {subject.name} yet — build one there first.'
            )

        existing = CurriculumModule.objects.filter(
            tenant_id=tenant_id, academic_class=target_class, subject=subject
        )
        if existing.exists() and not request.data.get('overwrite'):
            raise ValidationError(
                f'{target_class.name} already has a scheme for {subject.name}. '
                'Pass overwrite=true to replace it.'
            )
        if existing.exists() and request.data.get('overwrite'):
            CurriculumLesson.objects.filter(module__in=existing).delete()
            existing.delete()

        modules_copied = lessons_copied = 0
        copier = Teacher.objects.filter(user=request.user, tenant_id=tenant_id).first()
        for source in source_modules:
            module = CurriculumModule.objects.create(
                tenant_id=tenant_id,
                academic_class=target_class,
                subject=subject,
                name=source.name,
                order=source.order,
                created_by=copier,
            )
            modules_copied += 1
            for lesson in source.lessons.all().order_by('order'):
                CurriculumLesson.objects.create(
                    module=module,
                    title=lesson.title,
                    content_brief=lesson.content_brief,
                    order=lesson.order,
                )
                lessons_copied += 1

        return Response({
            'detail': (
                f'Assigned the {subject.name} scheme from {source_class.name} '
                f'to {target_class.name} ({modules_copied} modules, {lessons_copied} lessons).'
            ),
            'modules_copied': modules_copied,
            'lessons_copied': lessons_copied,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def coverage_summary(self, request):
        """
        Aggregated curriculum coverage stats for the Analytics tab.
        Returns per-module and overall progress.
        """
        subject_id = request.query_params.get('subject')
        qs = self.get_queryset()
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        modules_data = []
        total_lessons = 0
        total_completed = 0

        for module in qs.prefetch_related('lessons'):
            lessons = module.lessons.all()
            lesson_count = lessons.count()
            completed_count = lessons.filter(is_completed=True).count()
            total_lessons += lesson_count
            total_completed += completed_count

            modules_data.append({
                'id': str(module.id),
                'name': module.name,
                'order': module.order,
                'total_lessons': lesson_count,
                'completed_lessons': completed_count,
                'progress': round((completed_count / lesson_count) * 100) if lesson_count > 0 else 0,
            })

        overall_progress = round((total_completed / total_lessons) * 100) if total_lessons > 0 else 0

        return Response({
            'overall_progress': overall_progress,
            'total_modules': len(modules_data),
            'total_lessons': total_lessons,
            'total_completed': total_completed,
            'modules': modules_data,
        })

    @action(detail=False, methods=['get'])
    def teacher_compliance(self, request):
        """
        Admin-only: per-teacher curriculum compliance report.
        Shows which teachers have/haven't created modules and their coverage.
        """
        tenant_id = request.tenant_id
        is_admin = request.user.role_mappings.filter(
            tenant_id=tenant_id, role__in=['admin', 'super_admin']
        ).exists()
        if not is_admin:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        active_year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()
        if not active_year:
            return Response({'results': []})

        assignments = TeachingAssignment.objects.filter(
            teacher__tenant_id=tenant_id,
            academic_year=active_year,
        ).select_related('teacher__user', 'subject', 'academic_class')

        teacher_map = {}
        for a in assignments:
            t = a.teacher
            if t.id not in teacher_map:
                teacher_map[t.id] = {
                    'teacher_id': str(t.id),
                    'teacher_name': t.user.full_name if t.user else str(t.id),
                    'assigned_classes': [],
                    'assigned_subjects': [],
                    'modules_created': 0,
                    'total_lessons': 0,
                    'completed_lessons': 0,
                    'last_activity': None,
                }
            info = teacher_map[t.id]
            class_name = a.academic_class.name if a.academic_class else 'N/A'
            subject_name = a.subject.name if a.subject else 'N/A'
            if class_name not in info['assigned_classes']:
                info['assigned_classes'].append(class_name)
            if subject_name not in info['assigned_subjects']:
                info['assigned_subjects'].append(subject_name)

        # Aggregate module/lesson data per teacher
        module_data = (
            CurriculumModule.objects.filter(
                tenant_id=tenant_id,
                created_by__isnull=False,
            )
            .values(
                'created_by__id',
                'created_by__user__first_name',
                'created_by__user__last_name',
            )
            .annotate(
                modules_created=Count('id'),
            )
        )
        for row in module_data:
            tid = row['created_by__id']
            if tid in teacher_map:
                teacher_map[tid]['modules_created'] = row['modules_created']

        lesson_data = (
            CurriculumLesson.objects.filter(
                module__tenant_id=tenant_id,
                completed_by__isnull=False,
            )
            .values('completed_by__id')
            .annotate(
                total_lessons=Count('id'),
                completed_lessons=Count('id', filter=Q(is_completed=True)),
                last_activity=Max('completed_at'),
            )
        )
        for row in lesson_data:
            tid = row['completed_by__id']
            if tid in teacher_map:
                teacher_map[tid]['total_lessons'] = row['total_lessons']
                teacher_map[tid]['completed_lessons'] = row['completed_lessons']
                teacher_map[tid]['last_activity'] = row['last_activity']

        results = []
        for info in teacher_map.values():
            total = info['total_lessons']
            completed = info['completed_lessons']
            coverage = round((completed / total) * 100) if total > 0 else 0
            if info['modules_created'] == 0 and total == 0:
                status_label = 'non_compliant'
            elif coverage < 30:
                status_label = 'needs_attention'
            else:
                status_label = 'compliant'
            results.append({
                **info,
                'coverage_pct': coverage,
                'status': status_label,
            })

        results.sort(key=lambda r: r['coverage_pct'])

        return Response({'results': results})

class CurriculumLessonViewSet(viewsets.ModelViewSet):
    serializer_class = CurriculumLessonSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = CurriculumLesson.objects.filter(module__tenant_id=tenant_id)
        
        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                assignments = TeachingAssignment.objects.filter(teacher=teacher)
                qs = qs.filter(
                    module__subject_id__in=assignments.values_list('subject_id', flat=True),
                    module__academic_class_id__in=assignments.values_list('academic_class_id', flat=True),
                )
            else:
                qs = qs.none()
                
        return qs

    def perform_create(self, serializer):
        module = serializer.validated_data.get('module')
        if module is None or module.tenant_id != self.request.tenant_id:
            raise PermissionDenied('This module does not belong to your school.')
        serializer.save()

    @action(detail=True, methods=['post'])
    def toggle_complete(self, request, pk=None):
        """
        Toggle a lesson's completion status.
        When marking complete, auto-creates a linked LogbookEntry.
        """
        lesson = self.get_object()
        lesson.is_completed = not lesson.is_completed
        if lesson.is_completed:
            lesson.completed_by = request.user
            lesson.completed_at = timezone.now()
        else:
            lesson.completed_by = None
            lesson.completed_at = None
        lesson.save()

        # Auto-link to logbook when marking complete
        if lesson.is_completed:
            tenant_id = request.tenant_id
            teacher = Teacher.objects.filter(
                user=request.user, tenant_id=tenant_id
            ).first()

            if teacher:
                # Create or find today's logbook entry for this context
                today = timezone.now().date()
                entry, created = LogbookEntry.objects.get_or_create(
                    tenant_id=tenant_id,
                    teacher=teacher,
                    date=today,
                    defaults={
                        'work_covered': f'Completed: {lesson.title}',
                    }
                )
                # Link this lesson to the logbook entry
                entry.lessons_covered.add(lesson)
                if not created:
                    # Append to existing work_covered
                    if lesson.title not in entry.work_covered:
                        entry.work_covered += f'\n• {lesson.title}'
                        entry.save()
        else:
            # If un-completing, remove from any logbook entries
            for entry in lesson.logged_in.all():
                entry.lessons_covered.remove(lesson)

        serializer = self.get_serializer(lesson)
        return Response({
            'lesson': serializer.data,
            'is_completed': lesson.is_completed,
        })

class SchemeOfWorkViewSet(viewsets.ModelViewSet):
    """
    The year-long lesson plan, one row per class + subject + term + week.

    Admins (Studies Office) author the plan (create/edit/delete/generate/import).
    Teachers read their assigned plan, mark weeks taught (the "Done" click = their
    signature of record) and add teaching notes.
    """
    permission_classes = [IsAuthenticated, IsSchoolMember]
    filterset_fields = ['subject', 'class_obj', 'term', 'academic_year', 'status', 'week_number']

    def get_permissions(self):
        if self.action in ('create', 'destroy', 'generate', 'import_schemes'):
            return [IsAuthenticated(), IsSchoolAdmin()]
        return super().get_permissions()

    def get_serializer_class(self):
        from .serializers import SchemeOfWorkAdminSerializer, SchemeOfWorkTeacherSerializer
        if self.request.user.role_mappings.filter(
            tenant_id=self.request.tenant_id, role__in=['admin', 'super_admin']
        ).exists():
            return SchemeOfWorkAdminSerializer
        return SchemeOfWorkTeacherSerializer

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = SchemeOfWork.objects.filter(tenant_id=tenant_id)

        # Permission filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                assignments = TeachingAssignment.objects.filter(teacher=teacher)
                qs = qs.filter(
                    subject_id__in=assignments.values_list('subject_id', flat=True),
                    class_obj_id__in=assignments.values_list('academic_class_id', flat=True),
                    academic_year_id__in=assignments.values_list('academic_year_id', flat=True),
                )
            else:
                qs = qs.none()

        # Query-param filters (subject/class/term/academic_year/status/week_number)
        for field in ('subject', 'class_obj', 'term', 'academic_year', 'status', 'week_number'):
            value = self.request.query_params.get(field)
            if value:
                qs = qs.filter(**{f'{field}': value})
        return qs

    def _resolve_context(self, request, data):
        """Resolve and validate subject/class/term/year from request data."""
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from django.shortcuts import get_object_or_404

        tenant_id = request.tenant_id

        def fetch(model, value, label, extra_filter=None):
            if not value:
                raise DRFValidationError({label: 'This field is required.'})
            if extra_filter is not None:
                queryset = model.objects.filter(**extra_filter)
            else:
                queryset = model.objects.filter(tenant_id=tenant_id)
            try:
                return get_object_or_404(queryset, id=value)
            except (ValueError, TypeError):
                raise DRFValidationError({label: 'Must belong to this school.'})

        subject = fetch(Subject, data.get('subject'), 'subject')
        class_obj = fetch(Class, data.get('class_obj'), 'class_obj')
        term = fetch(Term, data.get('term'), 'term', {'academic_year__tenant_id': tenant_id})
        year = data.get('academic_year')
        if year:
            year = fetch(AcademicYear, year, 'academic_year')
        else:
            year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()
            if year is None:
                raise DRFValidationError('No active academic year configured.')
        return subject, class_obj, term, year

    def perform_create(self, serializer):
        request = self.request
        subject, class_obj, term, year = self._resolve_context(request, serializer.initial_data)

        week_number = serializer.validated_data.get('week_number', 1)
        obj, _ = SchemeOfWork.objects.update_or_create(
            tenant_id=request.tenant_id,
            academic_year=year,
            term=term,
            subject=subject,
            class_obj=class_obj,
            week_number=week_number,
            defaults={
                'topic': serializer.validated_data.get('topic', ''),
                'objectives': serializer.validated_data.get('objectives', ''),
                'expected_outcome': serializer.validated_data.get('expected_outcome', ''),
                'essential_knowledge': serializer.validated_data.get('essential_knowledge', ''),
                'homework': serializer.validated_data.get('homework', ''),
                'notes': serializer.validated_data.get('notes', ''),
            },
        )
        serializer.instance = obj

    def _guard_teacher_assignment(self, scheme):
        """Return the Teacher profile if the request user is assigned to this
        scheme's class + subject + academic year, else None."""
        teacher = Teacher.objects.filter(user=self.request.user, tenant_id=self.request.tenant_id).first()
        if teacher is None:
            return None
        assigned = TeachingAssignment.objects.filter(
            teacher=teacher,
            subject=scheme.subject,
            academic_class=scheme.class_obj,
            academic_year=scheme.academic_year,
        ).exists()
        return teacher if assigned else None

    def perform_update(self, serializer):
        scheme = self.get_object()
        is_admin = self.request.user.role_mappings.filter(
            tenant_id=self.request.tenant_id, role__in=['admin', 'super_admin']
        ).exists()

        if is_admin:
            content_fields = ['topic', 'objectives', 'expected_outcome', 'essential_knowledge', 'homework', 'notes']
            changed = False
            for field in content_fields:
                if field in serializer.validated_data:
                    setattr(scheme, field, serializer.validated_data[field])
                    changed = True
            if changed:
                scheme.save(update_fields=content_fields)
            serializer.instance = scheme
            return

        # Teacher: notes only, and only on their own assignment
        if self._guard_teacher_assignment(scheme) is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only update your own lesson plans.')
        if 'notes' in serializer.validated_data:
            scheme.notes = serializer.validated_data['notes']
            scheme.save(update_fields=['notes'])
        serializer.instance = scheme

    @action(detail=True, methods=['post'])
    def mark_taught(self, request, pk=None):
        """Teacher clicks Done: records the week as taught (their signature). Admins may record on a teacher's behalf."""
        scheme = self.get_object()
        is_admin = request.user.role_mappings.filter(
            tenant_id=request.tenant_id, role__in=['admin', 'super_admin']
        ).exists()
        teacher = self._guard_teacher_assignment(scheme)
        if teacher is None and not is_admin:
            return Response(
                {'detail': 'You are not assigned to teach this class and subject.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if teacher is None and is_admin:
            teacher = Teacher.objects.filter(user=request.user, tenant_id=request.tenant_id).first()
        scheme.status = SchemeOfWork.Status.TAUGHT
        scheme.taught_by = teacher
        scheme.taught_at = timezone.now()
        scheme.save(update_fields=['status', 'taught_by', 'taught_at'])
        return Response(self.get_serializer(scheme).data)

    @action(detail=True, methods=['post'])
    def mark_planned(self, request, pk=None):
        """Undo a Done click (assigned teacher or admin)."""
        scheme = self.get_object()
        is_admin = request.user.role_mappings.filter(
            tenant_id=request.tenant_id, role__in=['admin', 'super_admin']
        ).exists()
        if not is_admin and self._guard_teacher_assignment(scheme) is None:
            return Response(
                {'detail': 'You are not assigned to teach this class and subject.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        scheme.status = SchemeOfWork.Status.PLANNED
        scheme.taught_by = None
        scheme.taught_at = None
        scheme.save(update_fields=['status', 'taught_by', 'taught_at'])
        return Response(self.get_serializer(scheme).data)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        """Fill weeks 1..N with placeholder rows so the plan exists from the start."""
        subject, class_obj, term, year = self._resolve_context(request, request.data)
        try:
            weeks = int(request.data.get('weeks', 14))
        except (TypeError, ValueError):
            weeks = 14
        weeks = max(1, min(weeks, 20))

        created = updated = 0
        for week in range(1, weeks + 1):
            _, was_created = SchemeOfWork.objects.update_or_create(
                tenant_id=request.tenant_id,
                academic_year=year,
                term=term,
                subject=subject,
                class_obj=class_obj,
                week_number=week,
                defaults={
                    'topic': request.data.get('topic_prefix') or f'Week {week} — Topic',
                },
            )
            created += 1 if was_created else 0
            updated += 0 if was_created else 1

        return Response({
            'created': created,
            'existing': updated,
            'weeks': weeks,
            'class_name': class_obj.name,
            'subject_name': subject.name,
            'term_name': term.name,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='import')
    def import_schemes(self, request):
        """
        Bulk-fill the plan from CSV text pasted/uploaded by the admin.
        Columns: week_number,topic,objectives,expected_outcome,essential_knowledge,homework
        """
        import csv
        import io
        from rest_framework.exceptions import ValidationError as DRFValidationError

        subject, class_obj, term, year = self._resolve_context(request, request.data)
        csv_text = request.data.get('csv_text', '')
        if not csv_text or not csv_text.strip():
            raise DRFValidationError({'csv_text': 'This field is required.'})

        reader = csv.reader(io.StringIO(csv_text.strip()))
        rows = list(reader)
        if not rows:
            raise DRFValidationError({'csv_text': 'File is empty.'})

        # Skip a header row if present
        first = rows[0]
        if first and first[0].strip().lower() in ('week_number', 'week', 'week no', 'weekno'):
            rows = rows[1:]

        created = updated = 0
        errors = []
        for line_no, row in enumerate(rows, start=2):
            if not any(cell.strip() for cell in row):
                continue
            row = [c.strip() for c in row] + [''] * 6
            try:
                week_number = int(row[0])
            except ValueError:
                errors.append(f'Line {line_no}: invalid week number "{row[0]}".')
                continue
            topic = row[1]
            if not topic:
                errors.append(f'Line {line_no}: topic is required.')
                continue
            obj, was_created = SchemeOfWork.objects.update_or_create(
                tenant_id=request.tenant_id,
                academic_year=year,
                term=term,
                subject=subject,
                class_obj=class_obj,
                week_number=week_number,
                defaults={
                    'topic': topic,
                    'objectives': row[2],
                    'expected_outcome': row[3],
                    'essential_knowledge': row[4],
                    'homework': row[5],
                },
            )
            created += 1 if was_created else 0
            updated += 0 if was_created else 1

        return Response({
            'created': created,
            'updated': updated,
            'errors': errors,
            'class_name': class_obj.name,
            'subject_name': subject.name,
            'term_name': term.name,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def coverage(self, request):
        """
        Work coverage summary grouped by class + subject for the selected
        term/year (or the active year / current term by default).
        Teachers only see their own assignments.
        """
        tenant_id = request.tenant_id
        qs = SchemeOfWork.objects.filter(tenant_id=tenant_id)

        is_admin = request.user.role_mappings.filter(
            tenant_id=tenant_id, role__in=['admin', 'super_admin']
        ).exists()
        if not is_admin:
            teacher = Teacher.objects.filter(user=request.user, tenant_id=tenant_id).first()
            if teacher:
                assignments = TeachingAssignment.objects.filter(teacher=teacher)
                qs = qs.filter(
                    subject_id__in=assignments.values_list('subject_id', flat=True),
                    class_obj_id__in=assignments.values_list('academic_class_id', flat=True),
                    academic_year_id__in=assignments.values_list('academic_year_id', flat=True),
                )
            else:
                qs = qs.none()

        year_id = request.query_params.get('academic_year')
        term_id = request.query_params.get('term')
        if year_id:
            qs = qs.filter(academic_year_id=year_id)
        else:
            active = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()
            if active:
                qs = qs.filter(academic_year=active)

        if term_id:
            qs = qs.filter(term_id=term_id)
        else:
            qs = qs.filter(term=Term.objects.filter(
                academic_year__tenant_id=tenant_id,
            ).order_by('academic_year__name', 'order_number').first()) if Term.objects.filter(
                academic_year__tenant_id=tenant_id,
            ).exists() else qs

        groups = qs.values(
            'class_obj', 'class_obj__name', 'subject', 'subject__name', 'subject__code',
        ).annotate(
            total_weeks=Count('id'),
            taught_weeks=Count('id', filter=Q(status=SchemeOfWork.Status.TAUGHT)),
        ).order_by('class_obj__name', 'subject__name')

        # Attach the teacher who signed the latest taught week per group
        teacher_by_group = {}
        taught = qs.filter(status=SchemeOfWork.Status.TAUGHT, taught_by__isnull=False)
        for row in taught.select_related('taught_by__user', 'class_obj', 'subject'):
            key = (row.class_obj_id, row.subject_id)
            if key not in teacher_by_group:
                teacher_by_group[key] = row.taught_by.user.full_name if row.taught_by.user else None

        summary = []
        for g in groups:
            key = (g['class_obj'], g['subject'])
            summary.append({
                'class_id': g['class_obj'],
                'class_name': g['class_obj__name'],
                'subject_id': g['subject'],
                'subject_name': g['subject__name'],
                'subject_code': g['subject__code'],
                'total_weeks': g['total_weeks'],
                'taught_weeks': g['taught_weeks'],
                'remaining_weeks': g['total_weeks'] - g['taught_weeks'],
                'progress': round((g['taught_weeks'] / g['total_weeks']) * 100) if g['total_weeks'] else 0,
                'teacher_name': teacher_by_group.get(key),
            })

        return Response({'results': summary})


class LogbookEntryViewSet(viewsets.ModelViewSet):
    serializer_class = LogbookEntrySerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = LogbookEntry.objects.filter(tenant_id=tenant_id)
        
        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                qs = qs.filter(teacher=teacher)
            else:
                qs = qs.none()
                
        return qs

    def perform_create(self, serializer):
        tenant_id = self.request.tenant_id
        teacher = Teacher.objects.filter(
            user=self.request.user, tenant_id=tenant_id
        ).first()
        serializer.save(
            tenant_id=tenant_id,
            teacher=teacher,
        )

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """
        Phase 7: Digital Signature. 
        Locks the record and generates a signature hash.
        """
        entry = self.get_object()
        if entry.is_locked:
            return Response({'error': 'Already signed and locked.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Simple representational hash for demo
        raw_sig = f"{entry.id}-{entry.teacher.id}-{time.time()}"
        entry.signature_hash = hashlib.sha256(raw_sig.encode()).hexdigest()
        entry.is_locked = True
        entry.signed_at = time.now() if hasattr(time, 'now') else None # Use django utils instead
        
        from django.utils import timezone
        entry.signed_at = timezone.now()
        entry.save()
        
        return Response({
            'status': 'signed',
            'signature': entry.signature_hash,
            'signed_at': entry.signed_at
        })
