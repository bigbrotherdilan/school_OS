"""
Assessments Views — School OS
Manages mark entry windows, exams, and exam results with
sequence-gated mark entry and bulk operations.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import MarkEntryWindow, Exam, ExamResult
from .serializers import MarkEntryWindowSerializer, ExamSerializer, ExamResultSerializer
from apps.authentication.permissions import IsSchoolMember, IsSchoolAdmin, IsAdminOrTeacher
from apps.notifications.utils import announce_mark_window_opened, announce_mark_window_closed


class MarkEntryWindowViewSet(viewsets.ModelViewSet):
    """
    Manages the mark-entry windows that admins open/close per sequence.
    Teachers can read the status; only admins can modify.
    """
    serializer_class = MarkEntryWindowSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'check_status']:
            return [IsAuthenticated(), IsSchoolMember()]
        return [IsAuthenticated(), IsSchoolAdmin()]

    def get_queryset(self):
        tenant_id = getattr(self.request, 'tenant_id', None)
        qs = MarkEntryWindow.objects.filter(tenant_id=tenant_id)  # type: ignore
        sequence_id = self.request.query_params.get('sequence')
        if sequence_id:
            qs = qs.filter(sequence_id=sequence_id)
        is_open = self.request.query_params.get('is_open')
        if is_open is not None:
            qs = qs.filter(is_open=is_open.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)

    @action(detail=True, methods=['post'], url_path='toggle')
    def toggle(self, request, pk=None):
        """
        POST /assessments/mark-windows/<id>/toggle/
        Toggles the is_open state of a mark entry window.
        """
        window = self.get_object()
        window.is_open = not window.is_open
        window.save(update_fields=['is_open'])

        if window.is_open:
            announce_mark_window_opened(window, created_by=request.user)
        else:
            announce_mark_window_closed(window, created_by=request.user)

        return Response({
            'id': str(window.id),
            'is_open': window.is_open,
            'detail': f'Window {"opened" if window.is_open else "closed"} successfully.',
        })

    @action(detail=True, methods=['post'], url_path='toggle-share')
    def toggle_share(self, request, pk=None):
        """
        POST /assessments/mark-windows/<id>/toggle-share/
        Toggles the share_results state — controls whether parents can see marks.
        """
        window = self.get_object()
        window.share_results = not window.share_results
        window.save(update_fields=['share_results'])

        return Response({
            'id': str(window.id),
            'share_results': window.share_results,
            'detail': f'Results {"shared" if window.share_results else "hidden"} for parents.',
        })

    @action(detail=False, methods=['get'], url_path='mark-filling-stats')
    def mark_filling_stats(self, request):
        """
        GET /assessments/mark-windows/mark-filling-stats/
        Returns mark filling statistics per sequence — filtered by academic_year, term, subject, class, and open status.
        """
        tenant_id = getattr(request, 'tenant_id', None)
        from apps.academic.models import Sequence, Term, AcademicYear  # type: ignore
        from apps.staff.models import TeachingAssignment  # type: ignore
        from django.db.models import Count, Q, Avg, F

        year_id = request.query_params.get('academic_year')
        term_id = request.query_params.get('term')
        subject_id = request.query_params.get('subject')
        class_id = request.query_params.get('class')
        only_open_param = request.query_params.get('only_open', 'true')
        only_open = only_open_param.lower() == 'true'

        if year_id:
            active_year = AcademicYear.objects.filter(tenant_id=tenant_id, id=year_id).first()  # type: ignore
        else:
            active_year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()  # type: ignore

        if not active_year:
            return Response({'detail': 'No active academic year.'}, status=status.HTTP_404_NOT_FOUND)

        terms_qs = Term.objects.filter(academic_year=active_year).order_by('order_number')  # type: ignore
        if term_id:
            terms_qs = terms_qs.filter(id=term_id)

        result = []

        for term in terms_qs:
            term_data = {'term_id': term.id, 'term_name': term.name, 'sequences': []}
            term_exams = Exam.objects.filter(tenant_id=tenant_id, term=term)  # type: ignore

            for seq in term.sequences.all().order_by('order_number'):
                window = MarkEntryWindow.objects.filter(  # type: ignore
                    tenant_id=tenant_id, sequence=seq
                ).first()

                is_open = window.is_open if window else False
                if only_open and not is_open:
                    continue

                teachers_qs = TeachingAssignment.objects.filter(  # type: ignore
                    tenant_id=tenant_id,
                    academic_class__isnull=False,
                ).select_related('teacher', 'academic_class', 'subject')

                if subject_id:
                    teachers_qs = teachers_qs.filter(subject_id=subject_id)
                if class_id:
                    teachers_qs = teachers_qs.filter(academic_class_id=class_id)

                filled = []
                not_filled = []
                assignment_set = set()

                for ta in teachers_qs:
                    assignment_key = (ta.teacher_id, ta.subject_id, ta.academic_class_id)
                    if assignment_key in assignment_set:
                        continue
                    assignment_set.add(assignment_key)

                    has_results = ExamResult.objects.filter(  # type: ignore
                        exam__tenant_id=tenant_id,
                        exam__term=term,
                        subject=ta.subject,
                        student__current_class=ta.academic_class,
                        sequence=seq,
                        score__isnull=False,
                    ).exists()

                    teacher_info = {
                        'id': f"{ta.teacher_id}_{ta.subject_id}_{ta.academic_class_id}",
                        'teacher_id': str(ta.teacher_id),
                        'name': ta.teacher.user.full_name if hasattr(ta.teacher, 'user') and ta.teacher.user else str(ta.teacher),
                        'subject': ta.subject.name,
                        'subject_id': ta.subject_id,
                        'class_name': ta.academic_class.name,
                        'class_id': ta.academic_class_id,
                    }
                    if has_results:
                        filled.append(teacher_info)
                    else:
                        not_filled.append(teacher_info)

                perf_qs = ExamResult.objects.filter(  # type: ignore
                    exam__in=term_exams,
                    sequence=seq,
                    score__isnull=False,
                )
                if subject_id:
                    perf_qs = perf_qs.filter(subject_id=subject_id)
                if class_id:
                    perf_qs = perf_qs.filter(student__current_class_id=class_id)

                perf = perf_qs.aggregate(
                    avg_score=Avg('score'),
                    total_results=Count('id'),
                )

                term_data['sequences'].append({
                    'sequence_id': seq.id,
                    'sequence_name': seq.name,
                    'is_open': is_open,
                    'total_teachers': len(filled) + len(not_filled),
                    'filled_count': len(filled),
                    'not_filled_count': len(not_filled),
                    'filled_teachers': filled,
                    'not_filled_teachers': not_filled,
                    'avg_score': round(float(perf['avg_score']), 2) if perf['avg_score'] else None,
                    'total_results': perf['total_results'],
                })

            if term_data['sequences']:
                result.append(term_data)

        return Response(result)

    @action(detail=False, methods=['post'], url_path='notify-pending-teachers')
    def notify_pending_teachers(self, request):
        """
        POST /assessments/mark-windows/notify-pending-teachers/
        Sends an urgent announcement to all teachers who haven't filled marks
        for any currently open sequence.
        Body (optional): { term_id, sequence_id, class_id }
        """
        tenant_id = getattr(request, 'tenant_id', None)
        from apps.academic.models import Sequence, Term, AcademicYear  # type: ignore
        from apps.staff.models import TeachingAssignment  # type: ignore
        from apps.notifications.utils import announce_to_teachers
        from apps.tenants.models import Tenant  # type: ignore

        term_id = request.data.get('term_id') or request.query_params.get('term')
        sequence_id = request.data.get('sequence_id') or request.query_params.get('sequence')
        class_id = request.data.get('class_id') or request.query_params.get('class')

        tenant = Tenant.objects.filter(id=tenant_id).first()  # type: ignore
        active_year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()  # type: ignore
        if not active_year or not tenant:
            return Response({'detail': 'No active year or tenant found.'}, status=status.HTTP_404_NOT_FOUND)

        # Collect all open sequences matching filters
        open_windows = MarkEntryWindow.objects.filter(  # type: ignore
            tenant_id=tenant_id, is_open=True
        ).select_related('sequence', 'sequence__term')

        if term_id:
            open_windows = open_windows.filter(sequence__term_id=term_id)
        if sequence_id:
            open_windows = open_windows.filter(sequence_id=sequence_id)

        notified_sequence_names = []
        total_notified = 0

        for window in open_windows:
            seq = window.sequence
            teachers_qs = TeachingAssignment.objects.filter(  # type: ignore
                tenant_id=tenant_id,
                academic_class__isnull=False,
            ).select_related('teacher', 'academic_class', 'subject')

            if class_id:
                teachers_qs = teachers_qs.filter(academic_class_id=class_id)

            unfilled_names = []
            for ta in teachers_qs:
                has_results = ExamResult.objects.filter(  # type: ignore
                    exam__tenant_id=tenant_id,
                    exam__term=seq.term,
                    subject=ta.subject,
                    student__current_class=ta.academic_class,
                    sequence=seq,
                    score__isnull=False,
                ).exists()
                if not has_results:
                    unfilled_names.append(
                        ta.teacher.user.full_name if hasattr(ta.teacher, 'user') and ta.teacher.user else str(ta.teacher)
                    )

            if unfilled_names:
                seq_label = f"{seq.name} ({seq.term.name})"
                announce_to_teachers(
                    tenant=tenant,
                    title=f"\u26a0\ufe0f Action Required: Submit Marks for {seq_label}",
                    body=(
                        f"This is an urgent reminder to submit your marks for {seq_label} immediately. "
                        f"Report cards cannot be generated until all marks are submitted. "
                        f"Please log in to the teacher portal and fill in your student marks now."
                    ),
                    is_urgent=True,
                    created_by=request.user,
                )
                notified_sequence_names.append(seq_label)
                total_notified += len(unfilled_names)

        if not notified_sequence_names:
            return Response({'detail': 'No pending teachers found. All marks are submitted!'})

        return Response({
            'detail': f'Urgent reminder sent to teachers for: {", ".join(notified_sequence_names)}.',
            'sequences_notified': notified_sequence_names,
            'estimated_teachers': total_notified,
        })


    @action(detail=False, methods=['get'], url_path='check-status')
    def check_status(self, request):
        """
        GET /assessments/mark-windows/check-status/?sequence=<id>
        Quick check if a specific sequence is open for mark entry.
        """
        sequence_id = request.query_params.get('sequence')
        if not sequence_id:
            return Response(
                {'detail': 'sequence query param is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        tenant_id = getattr(request, 'tenant_id', None)
        window = MarkEntryWindow.objects.filter(  # type: ignore
            tenant_id=tenant_id, sequence_id=sequence_id
        ).first()

        if not window:
            return Response({
                'is_open': False,
                'message': 'No mark entry window configured for this sequence.'
            })

        return Response({
            'is_open': window.is_open,
            'start_date': window.start_date,
            'end_date': window.end_date,
            'message': 'Marks entry is open.' if window.is_open else 'Marks entry is closed for this sequence.',
        })


class ExamViewSet(viewsets.ModelViewSet):
    """
    CRUD for term exams within a tenant.
    Filterable by term, academic_year, and sequence (resolves to term).
    Auto-creates a default exam per term when none exists.
    """
    serializer_class = ExamSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)

    def get_queryset(self):
        tenant_id = getattr(self.request, 'tenant_id', None)
        if not tenant_id and hasattr(self.request.user, 'tenant_id'):
            tenant_id = self.request.user.tenant_id

        qs = Exam.objects.all()  # type: ignore
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        term_id = self.request.query_params.get('term')
        if term_id:
            qs = qs.filter(term_id=term_id)

        year_id = self.request.query_params.get('academic_year')
        if year_id:
            qs = qs.filter(academic_year_id=year_id)

        sequence_id = self.request.query_params.get('sequence')
        if sequence_id:
            from apps.academic.models import Sequence  # type: ignore
            try:
                seq = Sequence.objects.select_related('term').get(id=sequence_id)  # type: ignore
                qs = qs.filter(term_id=seq.term_id)
            except Sequence.DoesNotExist:  # type: ignore
                qs = qs.none()

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id and hasattr(request.user, 'tenant_id'):
            tenant_id = request.user.tenant_id

        sequence_id = request.query_params.get('sequence')

        existing = response.data.get('results', []) if isinstance(response.data, dict) else response.data
        if sequence_id and len(existing) == 0:
            from apps.academic.models import Sequence  # type: ignore
            try:
                seq = Sequence.objects.select_related('term__academic_year').get(id=sequence_id)  # type: ignore
                term = seq.term
                target_tenant_id = tenant_id or term.academic_year.tenant_id

                Exam.objects.get_or_create(  # type: ignore
                    tenant_id=target_tenant_id,
                    term_id=term.id,
                    defaults={
                        'academic_year_id': term.academic_year_id,
                        'name': f'{seq.name} Assessment',
                        'exam_type': 'termly',
                        'weight': 100.0,
                        'is_published': True,
                    }
                )
                return super().list(request, *args, **kwargs)
            except Sequence.DoesNotExist:  # type: ignore
                pass

        return response

    @action(detail=False, methods=['post'], url_path='ensure-for-term')
    def ensure_for_term(self, request):
        """
        POST /assessments/exams/ensure-for-term/
        Body: { "term_id": <int>, "academic_year_id": <int> }
        Creates a default term exam if one doesn't exist for the given term.
        """
        term_id = request.data.get('term_id')
        academic_year_id = request.data.get('academic_year_id')
        if not term_id or not academic_year_id:
            return Response(
                {'detail': 'term_id and academic_year_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        tenant_id = getattr(request, 'tenant_id', None)
        from apps.academic.models import Term  # type: ignore
        try:
            term = Term.objects.get(id=term_id, academic_year_id=academic_year_id)  # type: ignore
        except Term.DoesNotExist:  # type: ignore
            return Response({'detail': 'Term not found.'}, status=status.HTTP_404_NOT_FOUND)

        exam, created = Exam.objects.get_or_create(  # type: ignore
            tenant_id=tenant_id,
            term_id=term_id,
            defaults={
                'academic_year_id': academic_year_id,
                'name': f'{term.name} Exam',
                'exam_type': 'termly',
                'weight': 33.33,
                'is_published': True,
            }
        )
        return Response({
            'id': str(exam.id),
            'name': exam.name,
            'created': created,
        })


class ExamResultViewSet(viewsets.ModelViewSet):
    """
    CRUD and bulk-update for student exam results.
    Supports filtering by exam, student, and subject.
    """
    serializer_class = ExamResultSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated(), IsSchoolMember()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def get_queryset(self):
        tenant_id = getattr(self.request, 'tenant_id', None)
        qs = ExamResult.objects.filter(exam__tenant_id=tenant_id)  # type: ignore

        exam_id = self.request.query_params.get('exam')
        if exam_id:
            qs = qs.filter(exam_id=exam_id)

        subject_id = self.request.query_params.get('subject')
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        class_id = self.request.query_params.get('class')
        if class_id:
            qs = qs.filter(student__current_class_id=class_id)

        sequence_id = self.request.query_params.get('sequence')
        if sequence_id:
            qs = qs.filter(sequence_id=sequence_id)

        return qs

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        """
        POST /assessments/results/bulk-update/
        Body: { "results": [ { "exam": "<uuid>", "student": "<uuid>", "subject": "<id>", "score": 85 }, ... ] }
        """
        results_data = request.data.get('results', [])
        if not results_data:
            return Response(
                {'detail': 'No results provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tenant_id = getattr(request, 'tenant_id', None)

        # Validate mark entry window is open for the given sequence
        first_exam_id = results_data[0].get('exam')
        first_sequence_id = results_data[0].get('sequence')
        if first_exam_id and first_sequence_id:
            try:
                Exam.objects.get(id=first_exam_id, tenant_id=tenant_id)  # type: ignore
                window = MarkEntryWindow.objects.filter(  # type: ignore
                    tenant_id=tenant_id, sequence_id=first_sequence_id
                ).first()
                if window and not window.is_open:
                    return Response(
                        {'detail': 'Marks entry is closed for this sequence. Contact your administrator.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Exam.DoesNotExist:  # type: ignore
                return Response(
                    {'detail': 'Invalid exam ID.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        created_count = 0
        updated_count = 0
        errors = []

        for entry in results_data:
            exam_id = entry.get('exam')
            student_id = entry.get('student')
            subject_id = entry.get('subject')
            score = entry.get('score')
            sequence_id = entry.get('sequence')

            if not student_id or not subject_id:
                errors.append({'entry': entry, 'error': 'Missing student or subject.'})
                continue

            # If exam_id is missing or looks like a synthetic ID, auto-resolve via sequence_id
            if (not exam_id or str(exam_id).startswith('seq_')) and sequence_id:
                from apps.academic.models import Sequence  # type: ignore
                try:
                    seq = Sequence.objects.select_related('term__academic_year').get(id=sequence_id)  # type: ignore
                    term = seq.term
                    target_tenant_id = tenant_id or term.academic_year.tenant_id
                    exam, _ = Exam.objects.get_or_create(  # type: ignore
                        tenant_id=target_tenant_id,
                        term_id=term.id,
                        defaults={
                            'academic_year_id': term.academic_year_id,
                            'name': f'{seq.name} Assessment',
                            'exam_type': 'termly',
                            'weight': 100.0,
                            'is_published': True,
                        }
                    )
                    exam_id = str(exam.id)
                except Sequence.DoesNotExist:  # type: ignore
                    pass

            if not exam_id:
                errors.append({'entry': entry, 'error': 'Invalid or missing exam.'})
                continue

            try:
                lookup = {
                    'exam_id': exam_id,
                    'student_id': student_id,
                    'subject_id': subject_id,
                }
                if sequence_id:
                    lookup['sequence_id'] = sequence_id
                result, created = ExamResult.objects.update_or_create(  # type: ignore
                    **lookup,
                    defaults={
                        'score': score,
                        'comments': entry.get('comments', ''),
                    }
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            except Exam.DoesNotExist:  # type: ignore
                errors.append({'entry': entry, 'error': 'Exam not found in this tenant.'})
            except Exception as e:
                errors.append({'entry': entry, 'error': str(e)})

        return Response({
            'created': created_count,
            'updated': updated_count,
            'errors': errors,
            'message': f'Processed {created_count + updated_count} results successfully.'
        }, status=status.HTTP_200_OK)
