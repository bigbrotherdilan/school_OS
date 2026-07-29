"""
Report Card Generation Views — School OS
Endpoints for single and batch PDF report card generation.
"""
import io
import zipfile
from decimal import Decimal
from django.utils import timezone

from django.db import transaction
from django.http import FileResponse, HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academic.models import AcademicYear, Term
from apps.assessments.models import Exam, ExamResult
from apps.authentication.permissions import IsSchoolAdmin, IsSchoolMember
from apps.students.models import Student
from apps.tenants.models import Tenant

from .models import SchoolPerformanceReport, StudentReportCard, ReportCardTemplate
from .serializers import SchoolPerformanceReportSerializer, ReportCardTemplateSerializer
from .utils import generate_batch_report_cards, generate_report_card_pdf, _get_pass_mark


def _get_subject_scores(student, term, tenant):
    """Build subject score data for a student in a given term."""
    term_ids = [term]
    child_sequences = term.sequences.filter(type='sequence')
    if child_sequences.exists():
        term_ids.extend(child_sequences)
    exams = Exam.objects.filter(tenant=tenant, term__in=term_ids)
    results = ExamResult.objects.filter(
        exam__in=exams,
        student=student,
    ).select_related('subject', 'exam')

    # Group by subject and calculate weighted score
    subject_data = {}
    for r in results:
        if r.subject.id not in subject_data:
            subject_data[r.subject.id] = {
                'subject_name': r.subject.name,
                'coefficient': r.subject.default_coefficient,
                'scores': [],
                'max_scores': [],
                'weight': Decimal('0'),
            }
        weight = r.exam.weight
        if r.score is not None:
            subject_data[r.subject.id]['scores'].append(r.score)
            subject_data[r.subject.id]['max_scores'].append(
                Decimal('100') if tenant.education_type == 'anglophone' else Decimal('20')
            )
            subject_data[r.subject.id]['weight'] += weight

    education_type = tenant.education_type
    max_scale = Decimal('100') if education_type == 'anglophone' else Decimal('20')

    subject_scores = []
    for subj_id, data in subject_data.items():
        if data['scores']:
            # Weighted average of all exams for this subject
            total_weight = sum(
                Exam.objects.get(id=e_id).weight
                for e_id in [r.exam_id for r in results if r.subject_id == subj_id]
            )
            if total_weight > 0:
                avg_score = sum(data['scores']) / len(data['scores'])
            else:
                avg_score = sum(data['scores']) / len(data['scores'])

            score_val = avg_score
            max_val = data['max_scores'][0] if data['max_scores'] else max_scale

            # Normalize to the correct scale
            if max_val != max_scale:
                score_val = (score_val / max_val) * max_scale

            grade, grade_label = _get_grade_simple(score_val, max_scale, education_type)
        else:
            score_val = None
            grade = 'N/A'
            grade_label = 'No marks'

        subject_scores.append({
            'subject_name': data['subject_name'],
            'coefficient': data['coefficient'],
            'score': round(score_val, 2) if score_val is not None else None,
            'max_score': max_scale,
            'grade': grade,
            'grade_label': grade_label,
            'remarks': grade_label,
        })

    # Sort by subject name
    subject_scores.sort(key=lambda x: x['subject_name'])
    return subject_scores


def _get_grade_simple(score, max_scale, education_type):
    if score is None:
        return 'N/A', 'N/A'
    percentage = (float(score) / float(max_scale)) * 100

    if education_type == 'francophone':
        if percentage >= 90:
            return 'TB', 'Très Bien'
        elif percentage >= 75:
            return 'B', 'Bien'
        elif percentage >= 60:
            return 'AB', 'Assez Bien'
        elif percentage >= 50:
            return 'P', 'Passable'
        elif percentage >= 40:
            return 'I', 'Insuffisant'
        else:
            return 'F', 'Faible'
    else:
        if percentage >= 80:
            return 'A', 'Excellent'
        elif percentage >= 70:
            return 'B', 'Good'
        elif percentage >= 60:
            return 'C', 'Satisfactory'
        elif percentage >= 50:
            return 'D', 'Pass'
        else:
            return 'F', 'Fail'


class ReportCardViewSet(viewsets.ViewSet):
    """Generate and manage student report cards."""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def _get_tenant(self, request):
        tenant = getattr(request, 'tenant', None)
        if tenant:
            return tenant
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return None
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return None

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_single(self, request):
        """Generate a PDF report card for a single student."""
        tenant = self._get_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant not found.'}, status=status.HTTP_400_BAD_REQUEST)

        student_id = request.data.get('student_id')
        term_id = request.data.get('term_id')
        academic_year_id = request.data.get('academic_year_id')
        template_id = request.data.get('template_id')
        style_overrides = request.data.get('style_overrides')

        if not all([student_id, term_id, academic_year_id]):
            return Response(
                {'detail': 'student_id, term_id, and academic_year_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Load template if provided
        template = None
        if template_id:
            try:
                template = ReportCardTemplate.objects.get(id=template_id, tenant=tenant)
            except ReportCardTemplate.DoesNotExist:
                pass

        try:
            student = Student.objects.get(id=student_id, tenant=tenant)
            term = Term.objects.get(id=term_id, academic_year_id=academic_year_id)
            academic_year = AcademicYear.objects.get(id=academic_year_id, tenant=tenant)
        except (Student.DoesNotExist, Term.DoesNotExist, AcademicYear.DoesNotExist) as e:
            return Response({'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)

        # Build subject scores from exam results
        subject_scores = _get_subject_scores(student, term, tenant)

        # Check if results exist
        if not subject_scores:
            return Response(
                {'detail': 'No exam results found for this student in the selected term.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Compute class stats for rank / class average
        classmates = Student.objects.filter(
            tenant=tenant,
            current_class=student.current_class,
            status__in=['active', 'registered'],
        ).exclude(id=student.id)
        pass_mark, max_scale = _get_pass_mark(tenant.education_type)
        all_avgs = []
        my_avg = None
        for subj in subject_scores:
            c = Decimal(str(subj.get('coefficient', 1)))
            sc = subj.get('score')
            if sc is not None:
                if my_avg is None:
                    my_avg = Decimal('0')
                    my_tc = Decimal('0')
                my_avg += Decimal(str(sc)) * c
                my_tc += c
        my_avg = (my_avg / my_tc) if my_avg is not None and my_tc > 0 else Decimal('0')
        all_avgs.append(float(my_avg))

        for classmate in classmates:
            cs = _get_subject_scores(classmate, term, tenant)
            if cs:
                cm_avg = Decimal('0')
                cm_tc = Decimal('0')
                for subj in cs:
                    c = Decimal(str(subj.get('coefficient', 1)))
                    sc = subj.get('score')
                    if sc is not None:
                        cm_avg += Decimal(str(sc)) * c
                        cm_tc += c
                cm_avg = (cm_avg / cm_tc) if cm_tc > 0 else Decimal('0')
                all_avgs.append(float(cm_avg))

        all_avgs.sort(reverse=True)
        class_size = len(all_avgs)
        class_avg = sum(all_avgs) / class_size if class_size > 0 else None
        rank = (all_avgs.index(float(my_avg)) + 1) if class_size > 0 else None

        # Generate PDF with style
        pdf_bytes = generate_report_card_pdf(
            student=student,
            tenant=tenant,
            academic_year=academic_year,
            term=term,
            subject_scores=subject_scores,
            class_average=Decimal(str(round(class_avg, 2))) if class_avg is not None else None,
            rank=rank,
            class_size=class_size,
            template=template,
            style_overrides=style_overrides,
        )

        # Save to database
        # Convert Decimal values to float for JSON serialization
        def serialize_scores(scores):
            serialized = []
            for s in scores:
                serialized.append({
                    k: (float(v) if isinstance(v, Decimal) else v)
                    for k, v in s.items()
                })
            return serialized

        report_card, _ = StudentReportCard.objects.update_or_create(
            tenant=tenant,
            student=student,
            academic_year=academic_year,
            term=term,
            defaults={
                'generated_by': request.user,
                'data_snapshot': {
                    'subject_scores': serialize_scores(subject_scores),
                    'education_type': tenant.education_type,
                },
            },
        )

        # Save PDF file
        from django.core.files.base import ContentFile
        safe_admission = student.admission_number.replace('/', '-')
        filename = f'report_card_{safe_admission}_{term.name.replace(" ", "_")}.pdf'
        report_card.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)

        # Return PDF as download
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['post'], url_path='batch-generate')
    def batch_generate(self, request):
        """Generate PDF report cards for all students in a class."""
        tenant = self._get_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant not found.'}, status=status.HTTP_400_BAD_REQUEST)

        class_id = request.data.get('class_id')
        term_id = request.data.get('term_id')
        academic_year_id = request.data.get('academic_year_id')
        template_id = request.data.get('template_id')
        style_overrides = request.data.get('style_overrides')

        if not all([class_id, term_id, academic_year_id]):
            return Response(
                {'detail': 'class_id, term_id, and academic_year_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Load template if provided
        template = None
        if template_id:
            try:
                template = ReportCardTemplate.objects.get(id=template_id, tenant=tenant)
            except ReportCardTemplate.DoesNotExist:
                pass

        try:
            term = Term.objects.get(id=term_id, academic_year_id=academic_year_id)
            academic_year = AcademicYear.objects.get(id=academic_year_id, tenant=tenant)
            students = Student.objects.filter(
                tenant=tenant,
                current_class_id=class_id,
                status__in=['active', 'registered'],
            )
        except (Term.DoesNotExist, AcademicYear.DoesNotExist) as e:
            return Response({'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if not students.exists():
            return Response(
                {'detail': 'No active students found in this class.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Build student data for batch generation
        students_data = []
        for student in students:
            subject_scores = _get_subject_scores(student, term, tenant)
            if subject_scores:
                students_data.append({
                    'student': student,
                    'subject_scores': subject_scores,
                })

        if not students_data:
            return Response(
                {'detail': 'No students with exam results found in this class.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Compute class stats (rank, class average)
        max_scale = Decimal('100') if tenant.education_type == 'anglophone' else Decimal('20')
        class_stats_map = {}
        student_avgs = []
        for entry in students_data:
            s = entry['student']
            scores = entry['subject_scores']
            t_c = Decimal('0')
            w_s = Decimal('0')
            for subj in scores:
                c = Decimal(str(subj.get('coefficient', 1)))
                sc = subj.get('score')
                if sc is not None:
                    t_c += c
                    w_s += Decimal(str(sc)) * c
            avg = (w_s / t_c) if t_c > 0 else Decimal('0')
            student_avgs.append((s.id, float(avg)))
        student_avgs.sort(key=lambda x: x[1], reverse=True)
        class_size = len(student_avgs)
        class_avg = sum(a for _, a in student_avgs) / class_size if class_size > 0 else None
        for rank_pos, (sid, _) in enumerate(student_avgs, 1):
            class_stats_map[sid] = {
                'class_average': Decimal(str(round(class_avg, 2))) if class_avg is not None else None,
                'rank': rank_pos,
                'class_size': class_size,
            }

        # Generate all PDFs
        batch_results = generate_batch_report_cards(
            students_data=students_data,
            tenant=tenant,
            academic_year=academic_year,
            term=term,
            class_stats_map=class_stats_map,
            template=template,
            style_overrides=style_overrides,
        )

        # Save to DB and create ZIP
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for result in batch_results:
                pdf_bytes = result['pdf_bytes']
                filename = result['filename']

                # Save to database
                student = Student.objects.get(id=result['student_id'])
                # Convert Decimal values to float for JSON serialization
                raw_scores = result['subject_scores']
                serialized_scores = [
                    {k: (float(v) if isinstance(v, Decimal) else v) for k, v in s.items()}
                    for s in raw_scores
                ]
                report_card, _ = StudentReportCard.objects.update_or_create(
                    tenant=tenant,
                    student=student,
                    academic_year=academic_year,
                    term=term,
                    defaults={
                        'generated_by': request.user,
                        'data_snapshot': {'subject_scores': serialized_scores},
                    },
                )
                from django.core.files.base import ContentFile
                report_card.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)

                # Add to ZIP
                zf.writestr(filename, pdf_bytes)

        zip_buffer.seek(0)
        zip_filename = f'report_cards_class_{class_id}_{term.name.replace(" ", "_")}.zip'
        response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='list')
    def list_report_cards(self, request):
        """List generated report cards, optionally filtered by class/student/term."""
        tenant = self._get_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant not found.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = StudentReportCard.objects.filter(tenant=tenant)

        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        class_id = request.query_params.get('class_id')
        if class_id:
            qs = qs.filter(student__current_class_id=class_id)

        term_id = request.query_params.get('term_id')
        if term_id:
            qs = qs.filter(term_id=term_id)

        qs = qs.select_related('student', 'term', 'academic_year').order_by('-generated_at')[:100]

        data = [{
            'id': str(r.id),
            'student_id': str(r.student.id),
            'student_name': r.student.full_name,
            'admission_number': r.student.admission_number,
            'class_name': r.student.current_class.name if r.student.current_class else 'N/A',
            'term_name': r.term.name,
            'academic_year_name': r.academic_year.name,
            'generated_at': r.generated_at.isoformat(),
            'generated_by': r.generated_by.full_name if r.generated_by else 'System',
            'pdf_url': r.pdf_file.url if r.pdf_file else None,
            'is_archived': r.is_archived,
        } for r in qs]

        return Response(data)

    @action(detail=False, methods=['get'], url_path='download')
    def download_report_card(self, request):
        """Download a specific report card PDF by ID."""
        report_id = request.query_params.get('id')
        if not report_id:
            return Response({'detail': 'Report card ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        tenant = self._get_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant not found.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            report_card = StudentReportCard.objects.get(id=report_id, tenant=tenant)
        except StudentReportCard.DoesNotExist:
            return Response({'detail': 'Report card not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not report_card.pdf_file:
            return Response({'detail': 'PDF file not found. Please regenerate.'}, status=status.HTTP_404_NOT_FOUND)

        return FileResponse(
            report_card.pdf_file.open('rb'),
            content_type='application/pdf',
            filename=f'report_card_{report_card.student.admission_number}.pdf',
        )


class SchoolPerformanceReportViewSet(viewsets.ModelViewSet):
    serializer_class = SchoolPerformanceReportSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return SchoolPerformanceReport.objects.filter(tenant_id=tenant_id)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_report(self, request):
        """Generate an institutional performance report."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            tenant_id = getattr(request, 'tenant_id', None)
            if not tenant_id:
                return Response({'detail': 'Tenant not found.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                tenant = Tenant.objects.get(id=tenant_id)
            except Tenant.DoesNotExist:
                return Response({'detail': 'Tenant not found.'}, status=status.HTTP_404_NOT_FOUND)

        report_type = request.data.get('report_type', 'comprehensive')
        term_id = request.data.get('term_id')
        academic_year_id = request.data.get('academic_year_id')

        if not academic_year_id:
            return Response({'detail': 'academic_year_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            academic_year = AcademicYear.objects.get(id=academic_year_id, tenant=tenant)
        except AcademicYear.DoesNotExist:
            return Response({'detail': 'Academic year not found.'}, status=status.HTTP_404_NOT_FOUND)

        term = None
        if term_id:
            try:
                term = Term.objects.get(id=term_id, academic_year=academic_year)
            except Term.DoesNotExist:
                return Response({'detail': 'Term not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Build snapshot data
        snapshot = {'generated_at': str(timezone.now())}
        if term:
            snapshot['term'] = term.name
        snapshot['academic_year'] = academic_year.name

        title = f'{academic_year.name} - {dict(SchoolPerformanceReport.ReportType.choices).get(report_type, "Report")}'
        if term:
            title = f'{term.name} - {title}'

        report = SchoolPerformanceReport.objects.create(
            tenant=tenant,
            academic_year=academic_year,
            term=term,
            report_type=report_type,
            title=title,
            generated_by=request.user,
            data_snapshot=snapshot,
        )

        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReportCardTemplateViewSet(viewsets.ModelViewSet):
    """CRUD for report card visual templates."""
    serializer_class = ReportCardTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = ReportCardTemplate.objects.all()
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)
