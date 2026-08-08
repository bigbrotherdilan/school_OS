"""
Student Views — School OS
Management of the student directory and enrollment lifecycle.
"""
import csv
import io
import os
import uuid
from datetime import date
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q, Count
from django.db import transaction as db_transaction
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes as perm_decorator
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS, OR
from apps.students.serializers import (
    StudentSerializer, StudentCreateSerializer, ParentStudentLinkSerializer,
    DisciplineRecordSerializer, TransferRequestSerializer, PromotionHistorySerializer
)
from apps.students.models import (
    Student, ParentStudentRelationship, DisciplineRecord, TransferRequest, PromotionHistory
)
from apps.assessments.models import ExamResult
from apps.academic.views import BaseTenantViewSet
from apps.academic.models import AcademicYear, Class, Term, effective_coefficient
from apps.authentication.permissions import IsSchoolAdmin, IsAdminOrTeacher, IsSchoolAdminOrBursar


@api_view(['POST'])
@perm_decorator([IsAuthenticated])
def upload_student_photo(request):
    """
    POST /api/v1/students/upload-photo/
    Upload a student profile photo. Returns the URL to the saved image.
    """
    if 'photo' not in request.FILES:
        return Response({'detail': 'No photo provided.'}, status=status.HTTP_400_BAD_REQUEST)

    photo = request.FILES['photo']
    ext = os.path.splitext(photo.name)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
        return Response({'detail': 'Unsupported file type. Use JPG, PNG, WebP, or GIF.'}, status=status.HTTP_400_BAD_REQUEST)

    if photo.size > 5 * 1024 * 1024:
        return Response({'detail': 'File too large. Maximum size is 5MB.'}, status=status.HTTP_400_BAD_REQUEST)

    upload_dir = os.path.join(settings.MEDIA_ROOT, 'student_photos')
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, 'wb+') as dest:
        for chunk in photo.chunks():
            dest.write(chunk)

    photo_url = f"media/student_photos/{filename}"
    return Response({'photo_url': photo_url}, status=status.HTTP_200_OK)


class StudentViewSet(BaseTenantViewSet):
    """
    API endpoint for student CRUD.
    Includes filtering by class, stream, and status.
    """
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAdminOrTeacher]
    filterset_fields = ['current_class', 'stream', 'status']
    search_fields = ['first_name', 'last_name', 'admission_number']

    def get_permissions(self):
        if self.action in ('list', 'retrieve') and self.request.method in SAFE_METHODS:
            return [OR(IsAdminOrTeacher(), IsSchoolAdminOrBursar())]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentSerializer

    @action(detail=True, methods=['post'], permission_classes=[IsSchoolAdmin])
    def set_status(self, request, pk=None):
        """Manually update student status (e.g., Promote, Graduate)."""
        student = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Student.Status.choices):
            student.status = new_status
            student.save()
            return Response({'status': student.status})
        return Response(
            {'error': 'Invalid status choice.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=['post'], permission_classes=[IsSchoolAdmin])
    def verify(self, request, pk=None):
        """Verify a registered student, making them ACTIVE."""
        student = self.get_object()
        student.status = Student.Status.ACTIVE
        student.save()
        return Response({
            'status': student.status,
            'message': f'Student {student.full_name} has been verified and is now active.'
        })

    def _term_averages(self, student, year=None):
        """
        Cameroon term averages (moyenne trimestrielle):
        - Per subject: mean of the term's sequence scores (official 50/50 rule)
        - Term general average: subject averages weighted by section-effective coefficients
        Returns one entry per term that has marks, ordered by term.
        """
        results = ExamResult.objects.filter(
            student=student, score__isnull=False
        ).select_related('subject', 'sequence__term', 'exam')
        if year is not None:
            results = results.filter(exam__academic_year=year)

        section = student.current_class.stream if student.current_class else student.stream
        terms = {}
        for res in results:
            term_id = res.sequence.term_id if res.sequence else res.exam.term_id
            term_data = terms.setdefault(term_id, {})
            subject_data = term_data.setdefault(res.subject_id, {
                'scores': [],
                'coeff': float(effective_coefficient(section, res.subject) or 1.0),
            })
            subject_data['scores'].append(float(res.score))

        term_meta = {
            t['id']: t for t in
            Term.objects.filter(id__in=list(terms.keys())).values('id', 'name', 'order_number')
        }
        term_list = []
        for term_id, term_data in terms.items():
            wsum = 0.0
            wsum_coeff = 0.0
            for subject_data in term_data.values():
                if subject_data['scores']:
                    avg_score = sum(subject_data['scores']) / len(subject_data['scores'])
                    wsum += avg_score * subject_data['coeff']
                    wsum_coeff += subject_data['coeff']
            if wsum_coeff > 0:
                meta = term_meta.get(term_id, {})
                term_list.append({
                    'term_id': term_id,
                    'term_name': meta.get('name') or f'Term {term_id}',
                    'order_number': meta.get('order_number') or 0,
                    'average': wsum / wsum_coeff,
                })
        term_list.sort(key=lambda t: t['order_number'])
        return term_list

    def _student_average(self, student, year=None):
        """
        Annual average (moyenne annuelle) used for promotion:
        the mean of the term general averages. This is the official basis
        for passing to the next class (passage en classe supérieure).
        Returns None when the student has no marks in any term.
        """
        term_list = self._term_averages(student, year)
        if not term_list:
            return None
        return sum(t['average'] for t in term_list) / len(term_list)

    @staticmethod
    def _next_class(current_class):
        """
        The class one level higher in the same section's ladder.
        Returns None for the last level (e.g. Upper Sixth, Terminale).
        """
        return (
            Class.objects
            .filter(
                tenant=current_class.tenant,
                stream=current_class.stream,
                level_order=current_class.level_order + 1,
            )
            .exclude(id=current_class.id)
            .order_by('name')
            .first()
        )

    @staticmethod
    def _next_year_suggestion(year):
        start_year = year.end_date.year if year.end_date.month >= 8 else year.end_date.year + 1
        start = date(start_year, 9, 1)
        end = date(start_year + 1, 8, 31)
        name = f"{start_year}/{start_year + 1}"
        existing = AcademicYear.objects.filter(tenant_id=year.tenant_id, name=name).first()
        if existing:
            return existing
        next_year = AcademicYear.objects.create(
            tenant_id=year.tenant_id, name=name, start_date=start, end_date=end, is_active=True,
        )
        for i, term_name in enumerate(['First Term', 'Second Term', 'Third Term'], start=1):
            Term.objects.create(academic_year=next_year, name=term_name, order_number=i)
        return next_year

    @action(detail=False, methods=['get'], permission_classes=[IsSchoolAdmin], url_path='promotion-preview')
    def promotion_preview(self, request):
        """
        Calculate averages for all students in a class for a preview.
        Uses the active academic year's results only.
        """
        from_class_id = request.query_params.get('from_class')
        avg_cutoff = float(request.query_params.get('cutoff', 9.5))

        if not from_class_id:
            return Response({'error': 'from_class is required'}, status=400)

        year = AcademicYear.objects.filter(tenant_id=request.tenant_id, is_active=True).first()
        students = self.get_queryset().filter(current_class_id=from_class_id)
        results = []

        for student in students:
            final_avg = self._student_average(student, year)
            term_averages = self._term_averages(student, year)
            results.append({
                'id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'average': round(final_avg, 2) if final_avg is not None else None,
                'terms': [
                    {'term': t['term_name'], 'average': round(t['average'], 2)}
                    for t in term_averages
                ],
                'eligible': final_avg is not None and final_avg >= avg_cutoff,
                'has_marks': final_avg is not None,
            })

        return Response(results)

    @action(detail=False, methods=['get'], permission_classes=[IsSchoolAdmin], url_path='rollover-preview')
    def rollover_preview(self, request):
        """
        Preview the end-of-year rollover: how many students per class will
        move up, repeat, or graduate at the given cutoff.
        """
        cutoff = float(request.query_params.get('cutoff', 10))
        year = AcademicYear.objects.filter(tenant_id=request.tenant_id, is_active=True).first()
        if not year:
            return Response({'error': 'No active academic year found. Create and activate a year first.'}, status=400)

        students = self.get_queryset().filter(current_class__isnull=False)
        per_class = {}
        totals = {'total': 0, 'with_marks': 0, 'promoted': 0, 'repeating': 0, 'graduating': 0}

        for student in students:
            avg = self._student_average(student, year)
            eligible = avg is not None and avg >= cutoff
            next_class = self._next_class(student.current_class)
            totals['total'] += 1
            if avg is not None:
                totals['with_marks'] += 1

            entry = per_class.setdefault(student.current_class_id, {
                'class_id': student.current_class_id,
                'class_name': student.current_class.name,
                'section_name': student.current_class.stream.name if student.current_class.stream else 'General',
                'total': 0,
                'promoted': 0,
                'repeating': 0,
                'graduating': 0,
            })
            entry['total'] += 1
            if eligible and next_class:
                totals['promoted'] += 1
                entry['promoted'] += 1
            elif eligible:
                totals['graduating'] += 1
                entry['graduating'] += 1
            else:
                totals['repeating'] += 1
                entry['repeating'] += 1

        start_year = year.end_date.year if year.end_date.month >= 8 else year.end_date.year + 1
        return Response({
            'year': {'id': year.id, 'name': year.name},
            'cutoff': cutoff,
            'next_year_name': f"{start_year}/{start_year + 1}",
            'totals': totals,
            'per_class': sorted(per_class.values(), key=lambda c: c['section_name']),
        })

    @action(detail=False, methods=['post'], permission_classes=[IsSchoolAdmin], url_path='rollover')
    def rollover(self, request):
        """
        End-of-year rollover. Runs once per year:
        - Creates (or reuses) the next academic year + its 3 terms and activates it
        - Students with average >= cutoff move to the next class in the section ladder
        - Students in the last class of a ladder graduate
        - Everyone else repeats (stays in place)
        All movements are logged in PromotionHistory.
        """
        cutoff = float(request.data.get('cutoff', 10))
        year = AcademicYear.objects.filter(tenant_id=request.tenant_id, is_active=True).first()
        if not year:
            return Response({'error': 'No active academic year found. Create and activate a year first.'}, status=400)

        already_ran = PromotionHistory.objects.filter(
            tenant_id=request.tenant_id, academic_year=year, status=PromotionHistory.Status.PROMOTED
        ).exists()
        if already_ran:
            return Response({
                'error': f'Rollover already ran for {year.name}. Students were already moved. '
                         'Undo the moves manually if something went wrong.'
            }, status=400)

        next_year = self._next_year_suggestion(year)
        stats = {'promoted': 0, 'repeated': 0, 'graduated': 0, 'no_marks': 0}

        with db_transaction.atomic():
            students = Student.objects.filter(
                tenant_id=request.tenant_id, current_class__isnull=False
            )
            for student in students:
                avg = self._student_average(student, year)
                eligible = avg is not None and avg >= cutoff
                next_class = self._next_class(student.current_class) if eligible else None
                from_class = student.current_class

                if eligible and next_class:
                    student.current_class = next_class
                    student.stream = next_class.stream
                    student.status = Student.Status.ACTIVE
                    student.save(update_fields=['current_class', 'stream', 'status'])
                    PromotionHistory.objects.create(
                        tenant_id=request.tenant_id, student=student, from_class=from_class,
                        to_class=next_class, academic_year=year, average_score=avg,
                        status=PromotionHistory.Status.PROMOTED,
                    )
                    stats['promoted'] += 1
                elif eligible:
                    student.status = Student.Status.GRADUATED
                    student.save(update_fields=['status'])
                    PromotionHistory.objects.create(
                        tenant_id=request.tenant_id, student=student, from_class=from_class,
                        to_class=None, academic_year=year, average_score=avg,
                        status=PromotionHistory.Status.PROMOTED,
                    )
                    stats['graduated'] += 1
                else:
                    if avg is None:
                        stats['no_marks'] += 1
                    stats['repeated'] += 1
                    PromotionHistory.objects.create(
                        tenant_id=request.tenant_id, student=student, from_class=from_class,
                        to_class=from_class, academic_year=year, average_score=avg,
                        status=PromotionHistory.Status.REPEATED,
                    )

        return Response({
            'message': f'Rollover complete. {year.name} is closed and {next_year.name} is now active.',
            'next_year': {'id': next_year.id, 'name': next_year.name},
            **stats,
        })

    @action(detail=False, methods=['post'], permission_classes=[IsSchoolAdmin], url_path='promote')
    def promote(self, request):
        """
        Per-class promotion for one source class at a time.
        Students with average >= cutoff move to the next class level;
        those in the final level graduate.
        """
        from_class_id = request.data.get('from_class')
        cutoff = float(request.data.get('cutoff', 9.5))
        if not from_class_id:
            return Response({'error': 'from_class is required'}, status=400)

        year = AcademicYear.objects.filter(tenant_id=request.tenant_id, is_active=True).first()
        already_ran = PromotionHistory.objects.filter(
            tenant_id=request.tenant_id, from_class_id=from_class_id,
            academic_year=year, status=PromotionHistory.Status.PROMOTED,
        ).exists()
        if already_ran:
            return Response({
                'error': 'This class was already promoted this year. '
                         'Undo the moves manually if something went wrong.'
            }, status=400)

        students = self.get_queryset().filter(current_class_id=from_class_id)
        stats = {'promoted': 0, 'repeated': 0, 'graduated': 0}

        with db_transaction.atomic():
            for student in students:
                avg = self._student_average(student, year)
                eligible = avg is not None and avg >= cutoff
                next_class = self._next_class(student.current_class) if eligible else None
                from_class = student.current_class

                if eligible and next_class:
                    student.current_class = next_class
                    student.stream = next_class.stream
                    student.status = Student.Status.ACTIVE
                    student.save(update_fields=['current_class', 'stream', 'status'])
                    PromotionHistory.objects.create(
                        tenant_id=request.tenant_id, student=student, from_class=from_class,
                        to_class=next_class, academic_year=year, average_score=avg,
                        status=PromotionHistory.Status.PROMOTED,
                    )
                    stats['promoted'] += 1
                elif eligible:
                    student.status = Student.Status.GRADUATED
                    student.save(update_fields=['status'])
                    PromotionHistory.objects.create(
                        tenant_id=request.tenant_id, student=student, from_class=from_class,
                        to_class=None, academic_year=year, average_score=avg,
                        status=PromotionHistory.Status.PROMOTED,
                    )
                    stats['graduated'] += 1
                else:
                    stats['repeated'] += 1
                    PromotionHistory.objects.create(
                        tenant_id=request.tenant_id, student=student, from_class=from_class,
                        to_class=from_class, academic_year=year, average_score=avg,
                        status=PromotionHistory.Status.REPEATED,
                    )

        return Response({'message': 'Promotion processed for the selected class.', **stats})

    @action(detail=False, methods=['post'], permission_classes=[IsSchoolAdmin], url_path='bulk-import')
    def bulk_import(self, request):
        """
        POST /api/v1/students/students/bulk-import/
        Accepts a CSV file with columns: first_name, last_name, gender, date_of_birth,
        optional: blood_group, emergency_contact, current_class (name or id)
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'detail': 'No file uploaded. Send a CSV file as "file".'}, status=400)

        try:
            decoded = csv_file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(decoded))
        except Exception:
            return Response({'detail': 'Could not read CSV file. Ensure it is UTF-8 encoded.'}, status=400)

        required_cols = {'first_name', 'last_name', 'gender', 'date_of_birth'}
        if not required_cols.issubset(set(reader.fieldnames or [])):
            return Response({
                'detail': f'CSV must have columns: {", ".join(required_cols)}. Found: {", ".join(reader.fieldnames or [])}'
            }, status=400)

        tenant = request.tenant
        created = []
        errors = []
        row_num = 1

        for row in reader:
            row_num += 1
            first_name = row.get('first_name', '').strip()
            last_name = row.get('last_name', '').strip()
            gender = row.get('gender', '').strip().upper()
            dob = row.get('date_of_birth', '').strip()

            if not first_name or not last_name or not gender or not dob:
                errors.append({'row': row_num, 'name': f"{first_name} {last_name}", 'error': 'Missing required fields'})
                continue

            if gender not in ('M', 'F'):
                errors.append({'row': row_num, 'name': f"{first_name} {last_name}", 'error': f'Invalid gender: {gender}. Must be M or F'})
                continue

            try:
                with db_transaction.atomic():
                    # Try to match class by name if provided
                    current_class = None
                    class_name = row.get('current_class', '').strip()
                    if class_name:
                        from apps.academic.models import Class
                        current_class = Class.objects.filter(
                            tenant=tenant, name__iexact=class_name
                        ).first()

                    student = Student.objects.create(
                        tenant=tenant,
                        first_name=first_name,
                        last_name=last_name,
                        gender=gender,
                        date_of_birth=dob,
                        current_class=current_class,
                        blood_group=row.get('blood_group', '').strip(),
                        emergency_contact=row.get('emergency_contact', '').strip(),
                        status=Student.Status.REGISTERED,
                    )

                    created.append({
                        'name': f"{first_name} {last_name}",
                        'admission_number': student.admission_number,
                        'class': current_class.name if current_class else 'Unassigned',
                    })
            except Exception as e:
                errors.append({'row': row_num, 'name': f"{first_name} {last_name}", 'error': str(e)})

        return Response({
            'message': f'Import complete. {len(created)} students created, {len(errors)} errors.',
            'created': created,
            'errors': errors,
        }, status=status.HTTP_201_CREATED)


class ParentStudentLinkViewSet(viewsets.ModelViewSet):
    """
    Management of parent-student mappings.
    """
    queryset = ParentStudentRelationship.objects.all()
    serializer_class = ParentStudentLinkSerializer
    permission_classes = [IsSchoolAdmin]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return self.queryset.filter(student__tenant_id=tenant_id)

    @action(detail=False, methods=['get'], permission_classes=[IsSchoolAdmin])
    def search(self, request):
        """
        GET /api/v1/students/parent-student-links/search/?q=<email or name>
        Find GLOBAL parents (any school) so an admin can link them to a
        student in this school.
        """
        from apps.authentication.models import User, UserRoleMapping

        q = request.query_params.get('q', '').strip()
        if not q:
            return Response([])

        parent_user_ids = UserRoleMapping.objects.filter(
            role='parent', is_active=True,
        ).values_list('user_id', flat=True).distinct()

        users = User.objects.filter(
            id__in=parent_user_ids,
            is_active=True,
        ).filter(
            Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q)
        )[:20]

        linked_counts = {
            r['parent_user_id']: r['count']
            for r in ParentStudentRelationship.objects.filter(
                parent_user_id__in=[u.id for u in users]
            ).values('parent_user_id').annotate(count=Count('id'))
        }

        return Response([
            {
                'id': str(u.id),
                'full_name': u.full_name,
                'email': u.email,
                'phone': u.phone or '',
                'linked_students': linked_counts.get(u.id, 0),
            }
            for u in users
        ])

    @action(detail=False, methods=['post'], permission_classes=[IsSchoolAdmin])
    def link(self, request):
        """
        POST /api/v1/students/parent-student-links/link/
        Link an existing GLOBAL parent to a student in this school.
        Body: {parent_user: <uuid>, student: <uuid>, relationship_type}
        No role mapping is required in this school — parents are global.
        """
        from apps.authentication.models import UserRoleMapping

        parent_user_id = request.data.get('parent_user')
        student_id = request.data.get('student')
        relationship_type = request.data.get('relationship_type', 'guardian')

        if not parent_user_id or not student_id:
            return Response({'detail': 'parent_user and student are required.'}, status=400)

        from apps.students.models import Student

        try:
            student = Student.objects.get(id=student_id, tenant_id=request.tenant_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found in this school.'}, status=404)

        is_parent = UserRoleMapping.objects.filter(
            user_id=parent_user_id, role='parent', is_active=True,
        ).exists()
        if not is_parent:
            return Response({'detail': 'User is not an active parent.'}, status=400)

        if relationship_type not in ('father', 'mother', 'guardian'):
            return Response({'detail': 'relationship_type must be father, mother or guardian.'}, status=400)

        rel, created = ParentStudentRelationship.objects.get_or_create(
            parent_user_id=parent_user_id, student=student,
            defaults={'relationship_type': relationship_type},
        )
        if not created:
            rel.relationship_type = relationship_type
            rel.save(update_fields=['relationship_type'])

        return Response(ParentStudentLinkSerializer(rel).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class DisciplineRecordViewSet(viewsets.ModelViewSet):
    serializer_class = DisciplineRecordSerializer
    permission_classes = [IsAdminOrTeacher]
    filterset_fields = ['student', 'category']

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return DisciplineRecord.objects.none()
        return DisciplineRecord.objects.filter(student__tenant_id=tenant_id)

class TransferRequestViewSet(viewsets.ModelViewSet):
    serializer_class = TransferRequestSerializer
    permission_classes = [IsSchoolAdmin]
    filterset_fields = ['student', 'status']

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return TransferRequest.objects.none()
        return TransferRequest.objects.filter(student__tenant_id=tenant_id)

class PromotionHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = PromotionHistorySerializer
    permission_classes = [IsSchoolAdmin]
    filterset_fields = ['student', 'academic_year', 'status']

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return PromotionHistory.objects.none()
        return PromotionHistory.objects.filter(student__tenant_id=tenant_id)


""" parent"""


from apps.attendance.models import AttendanceRecord
from apps.finance.models import StudentInvoice
from apps.notifications.models import Announcement
from apps.tenants.models import TenantConfig

class ParentDashboardAPIView(APIView):
    """
    Global dashboard endpoint for a Parent.
    Aggregates wards across multiple tenants, along with cross-tenant alerts and grades.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Strict security: Only fetch links explicitly mapped to the logged-in user
        links = ParentStudentRelationship.objects.filter(parent_user=user).select_related(
            'student', 'student__tenant', 'student__current_class'
        )
        
        wards_data = []
        tenant_ids = set()
        student_ids = set()

        for link in links:
            student = link.student
            tenant_ids.add(student.tenant_id)
            student_ids.add(student.id)

            # Get tenant config for grading thresholds
            config = TenantConfig.get_for_tenant(student.tenant)

            # Attendance calculation
            attendance_records = AttendanceRecord.objects.filter(student=student)
            total_records = attendance_records.count()
            present_records = attendance_records.filter(status=AttendanceRecord.Status.PRESENT).count()
            attendance_pct = int((present_records / total_records) * 100) if total_records > 0 else None

            # Recent grade
            recent_exam = ExamResult.objects.filter(
                student=student, exam__is_published=True
            ).select_related('subject').order_by('-exam__term__order_number').first()
            
            recent_grade = None
            if recent_exam:
                score = float(recent_exam.score or 0)
                if score >= float(config.grade_a_threshold):
                    grade_label = "A"
                elif score >= float(config.grade_b_threshold):
                    grade_label = "B"
                elif score >= float(config.grade_c_threshold):
                    grade_label = "C"
                else:
                    grade_label = "D"
                recent_grade = {
                    "subject": recent_exam.subject.name,
                    "score_label": f"Grade {grade_label}"
                }

            wards_data.append({
                "id": str(student.id),
                "first_name": student.first_name,
                "last_name": student.last_name,
                "grade": student.current_class.name if student.current_class else "",
                "campus": student.tenant.school_name,
                "photo_url": student.photo_url or "",
                "attendance_percentage": attendance_pct,
                "recent_grade": recent_grade
            })

        # Fetch Alerts
        alerts = []
        
        # Financial Alerts
        unpaid_invoices = StudentInvoice.objects.filter(
            student_id__in=student_ids, 
            status__in=[StudentInvoice.Status.UNPAID, StudentInvoice.Status.PARTIAL]
        ).select_related('student', 'academic_year')
        
        for inv in unpaid_invoices:
            alerts.append({
                "id": str(inv.id),
                "type": "financial",
                "title": f"Fee Balance Due ({inv.student.first_name})",
                "message": f"Amount: {inv.balance}. Outstanding balance for {inv.academic_year.name}.",
                "amount": float(inv.balance),
                "action_text": "pay_now",
                "date": inv.due_date.isoformat() if inv.due_date else "",
                "student_id": str(inv.student_id),
                "student_first_name": inv.student.first_name,
                "student_last_name": inv.student.last_name
            })

        # General/Event Alerts
        announcements = Announcement.objects.filter(
            tenant_id__in=tenant_ids,
            audience__in=[Announcement.AudienceType.ALL, Announcement.AudienceType.PARENTS],
            published=True
        ).order_by('-created_at')[:5]

        for ann in announcements:
            alert_type = "event" if "event" in ann.title.lower() or "meeting" in ann.title.lower() else "general"
            alerts.append({
                "id": str(ann.id),
                "type": alert_type,
                "title": ann.title,
                "message": ann.body[:100] + ("..." if len(ann.body) > 100 else ""),
                "action_text": "read_details",
                "date": ann.created_at.date().isoformat()
            })

        # Sort alerts by date descending
        alerts.sort(key=lambda x: x["date"], reverse=True)

        # Get tenant config for the first linked tenant (or defaults)
        first_tenant_id = next(iter(tenant_ids), None)
        config = TenantConfig.get_for_tenant(links.first().student.tenant) if links.exists() else None
        
        # Format response
        return Response({
            "parent_name": user.first_name or user.email.split('@')[0],
            "total_enrollment": len(wards_data),
            "fiscal_status": "outstanding" if unpaid_invoices.exists() else "current",
            "wards": wards_data,
            "alerts": alerts,
        })


class ParentFeesView(APIView):
    """
    Read-only endpoint for parents to view invoices for their linked students.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        links = ParentStudentRelationship.objects.filter(parent_user=user).select_related('student')
        student_ids = [link.student_id for link in links]

        if not student_ids:
            return Response([])

        from apps.finance.models import StudentInvoice
        invoices = StudentInvoice.objects.filter(
            student_id__in=student_ids
        ).select_related('student', 'academic_year').order_by('-created_at')

        data = []
        for inv in invoices:
            data.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "total_amount": str(inv.total_amount),
                "amount_paid": str(inv.amount_paid),
                "balance": str(inv.balance),
                "status": inv.status,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "student_name": inv.student.full_name if inv.student else "Unknown",
                "student_id": str(inv.student_id) if inv.student_id else None,
                "academic_year": inv.academic_year.name if inv.academic_year else "",
            })

        return Response(data)


class ParentAnalyticsView(APIView):
    """
    Read-only endpoint for parents to view exam results for a specific student.
    Shows marks where the MarkEntryWindow is CLOSED + share_results=True,
    OR where the exam is published (for legacy/report card compatibility).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student_id = request.query_params.get('student')

        if not student_id:
            return Response({'detail': 'student query parameter is required.'}, status=400)

        if not ParentStudentRelationship.objects.filter(parent_user=user, student_id=student_id).exists():
            return Response({'detail': 'Not authorized to view this student.'}, status=403)

        from apps.assessments.models import ExamResult, MarkEntryWindow
        from apps.students.models import Student

        student = Student.objects.filter(id=student_id).select_related('tenant', 'current_class').first()
        config = TenantConfig.get_for_tenant(student.tenant) if student else None

        if not student:
            return Response({'detail': 'Student not found.'}, status=404)

        shared_sequence_ids = MarkEntryWindow.objects.filter(
            is_open=False, share_results=True, tenant_id=student.tenant_id
        ).values_list('sequence_id', flat=True)

        results = ExamResult.objects.filter(
            student_id=student_id,
        ).filter(
            models.Q(sequence_id__in=shared_sequence_ids) | models.Q(exam__is_published=True)
        ).select_related(
            'subject', 'exam', 'exam__term', 'sequence', 'sequence__term'
        ).order_by(
            '-sequence__term__order_number', '-sequence__order_number'
        )

        data = []
        section = student.current_class.stream if student.current_class else None
        for r in results:
            coefficient = float(effective_coefficient(section, r.subject)) if r.subject else 1.0
            score_val = float(r.score) if r.score else 0
            scale_max = float(config.grading_scale_max) if config else 20.0
            data.append({
                "id": str(r.id),
                "subject_name": r.subject.name if r.subject else "",
                "score": str(r.score) if r.score else "0",
                "exam_name": r.exam.name if r.exam else "",
                "term_name": r.sequence.term.name if r.sequence and r.sequence.term else (r.exam.term.name if r.exam and r.exam.term else ""),
                "term_order": r.sequence.term.order_number if r.sequence and r.sequence.term else (r.exam.term.order_number if r.exam and r.exam.term else 0),
                "sequence_name": r.sequence.name if r.sequence else "",
                "sequence_order": r.sequence.order_number if r.sequence else 0,
                "score_out_of": scale_max,
                "coefficient": coefficient,
                "weighted_score": round(score_val * coefficient, 2),
            })

        response = {"results": data}
        if config:
            response["grading_config"] = {
                "scale_max": float(config.grading_scale_max),
                "grade_a": float(config.grade_a_threshold),
                "grade_b": float(config.grade_b_threshold),
                "grade_c": float(config.grade_c_threshold),
            }

        return Response(response)


class ParentChildSummaryView(APIView):
    """
    Per-child summary returning marks organised by term → sequence → subject.
    Only shows results for closed + shared windows or published exams.
    Intentionally excludes averages, rank, and position.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        user = request.user

        if not ParentStudentRelationship.objects.filter(parent_user=user, student_id=student_id).exists():
            return Response({'detail': 'Not authorized to view this student.'}, status=403)

        from apps.assessments.models import ExamResult, MarkEntryWindow
        from apps.students.models import Student
        from apps.academic.models import Term, Sequence, AcademicYear
        from apps.attendance.models import AttendanceRecord

        student = Student.objects.filter(id=student_id).select_related(
            'tenant', 'current_class'
        ).first()

        if not student:
            return Response({'detail': 'Student not found.'}, status=404)

        config = TenantConfig.get_for_tenant(student.tenant)

        closed_sequence_ids = MarkEntryWindow.objects.filter(
            is_open=False, tenant_id=student.tenant_id
        ).values_list('sequence_id', flat=True)

        results = ExamResult.objects.filter(
            student_id=student_id,
        ).filter(
            models.Q(sequence_id__in=closed_sequence_ids) | models.Q(exam__is_published=True)
        ).select_related(
            'subject', 'exam', 'sequence', 'sequence__term', 'sequence__term__academic_year'
        ).order_by(
            'sequence__term__academic_year__start_date',
            'sequence__term__order_number',
            'sequence__order_number'
        )

        windows_by_seq = {
            w.sequence_id: w
            for w in MarkEntryWindow.objects.filter(
                tenant_id=student.tenant_id, sequence_id__in=closed_sequence_ids
            )
        }

        attendance_records = AttendanceRecord.objects.filter(student=student)
        total_records = attendance_records.count()
        present_records = attendance_records.filter(status=AttendanceRecord.Status.PRESENT).count()
        attendance_pct = round((present_records / total_records) * 100, 1) if total_records > 0 else None

        terms_dict = {}
        for r in results:
            if not r.sequence or not r.sequence.term:
                continue
            term = r.sequence.term
            term_key = str(term.id)
            if term_key not in terms_dict:
                terms_dict[term_key] = {
                    "term_name": term.name,
                    "term_order": term.order_number,
                    "term_id": str(term.id),
                    "sequences": {},
                }
            seq = r.sequence
            seq_key = str(seq.id)
            if seq_key not in terms_dict[term_key]["sequences"]:
                window = windows_by_seq.get(seq.id)
                is_locked = not window.is_open if window else (r.exam.is_published if r.exam else False)
                is_shared = window.share_results if window else False
                terms_dict[term_key]["sequences"][seq_key] = {
                    "sequence_name": seq.name,
                    "sequence_order": seq.order_number,
                    "sequence_id": str(seq.id),
                    "is_locked": is_locked,
                    "is_shared": is_shared,
                    "subjects": [],
                }
            if terms_dict[term_key]["sequences"][seq_key].get("is_shared"):
                coefficient = float(effective_coefficient(section, r.subject)) if r.subject else 1.0
                scale_max = float(config.grading_scale_max) if config else 20.0
                terms_dict[term_key]["sequences"][seq_key]["subjects"].append({
                    "name": r.subject.name if r.subject else "",
                    "score": float(r.score) if r.score else 0,
                    "out_of": scale_max,
                    "coefficient": coefficient,
                })

        terms_list = sorted(terms_dict.values(), key=lambda t: t["term_order"])
        for term in terms_list:
            term["sequences"] = sorted(
                term["sequences"].values(), key=lambda s: s["sequence_order"]
            )

        return Response({
            "student": {
                "id": str(student.id),
                "first_name": student.first_name,
                "last_name": student.last_name,
                "grade": student.current_class.name if student.current_class else "",
                "campus": student.tenant.school_name,
                "photo_url": student.photo_url or "",
                "admission_number": student.admission_number or "",
            },
            "attendance": {
                "percentage": attendance_pct,
                "present_days": present_records,
                "total_days": total_records,
            },
            "terms": terms_list,
        })


class ParentComparisonView(APIView):
    """
    Returns a lightweight comparison object for all linked children.
    Only attendance and subject scores — no averages or ranks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from apps.assessments.models import ExamResult, MarkEntryWindow
        from apps.academic.models import Sequence
        from apps.attendance.models import AttendanceRecord
        from django.db import models as django_models

        links = ParentStudentRelationship.objects.filter(
            parent_user=user
        ).select_related(
            'student', 'student__tenant', 'student__current_class'
        )

        children = []
        for link in links:
            student = link.student
            config = TenantConfig.get_for_tenant(student.tenant)

            closed_sequence_ids = MarkEntryWindow.objects.filter(
                is_open=False, share_results=True, tenant_id=student.tenant_id
            ).values_list('sequence_id', flat=True)

            results_with_marks = ExamResult.objects.filter(
                student=student,
                score__isnull=False,
            ).filter(
                django_models.Q(sequence_id__in=closed_sequence_ids) | django_models.Q(exam__is_published=True)
            ).select_related('subject', 'sequence', 'sequence__term').order_by(
                '-sequence__term__order_number', '-sequence__order_number'
            )

            total_sequences = Sequence.objects.filter(
                term__academic_year__tenant=student.tenant,
                term__academic_year__is_active=True,
            ).count()

            sequences_with_marks = results_with_marks.values('sequence').distinct().count()

            subjects_map = {}
            for r in results_with_marks:
                if r.subject and r.subject.name not in subjects_map:
                    subjects_map[r.subject.name] = {
                        "name": r.subject.name,
                        "latest_score": float(r.score) if r.score else 0,
                        "out_of": float(config.grading_scale_max) if config else 20.0,
                    }

            attendance_records = AttendanceRecord.objects.filter(student=student)
            total_records = attendance_records.count()
            present_records = attendance_records.filter(status=AttendanceRecord.Status.PRESENT).count()
            attendance_pct = round((present_records / total_records) * 100, 1) if total_records > 0 else None

            children.append({
                "id": str(student.id),
                "name": student.first_name,
                "last_name": student.last_name,
                "grade": student.current_class.name if student.current_class else "",
                "campus": student.tenant.school_name,
                "photo_url": student.photo_url or "",
                "attendance_pct": attendance_pct,
                "sequences_with_marks": sequences_with_marks,
                "sequences_total": total_sequences,
                "subjects_with_scores": list(subjects_map.values()),
            })

        return Response({"children": children})


class ParentPaymentView(APIView):
    """
    Parent-initiated payment endpoint.
    In production, integrates with MTN MoMo / Orange Money APIs.
    For now, payments are auto-confirmed (mock).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.finance.models import StudentInvoice, PaymentTransaction
        from django.db import transaction as db_transaction
        from django.utils.crypto import get_random_string

        user = request.user
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant context required.'}, status=400)

        invoice_id = request.data.get('invoice_id')
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'mtn_momo')
        phone_number = request.data.get('phone_number', '')

        if not invoice_id or not amount:
            return Response({'detail': 'invoice_id and amount are required.'}, status=400)

        # Validate payment method against tenant config
        config = TenantConfig.get_for_tenant(tenant)
        if payment_method not in config.payment_methods:
            return Response(
                {'detail': f'Payment method "{payment_method}" is not available. Available: {", ".join(config.payment_methods)}'},
                status=400
            )

        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'detail': 'Amount must be a positive number.'}, status=400)

        # Verify parent is linked to the invoice's student
        try:
            invoice = StudentInvoice.objects.select_related('student').get(id=invoice_id, tenant=tenant)
        except StudentInvoice.DoesNotExist:
            return Response({'detail': 'Invoice not found.'}, status=404)

        if not ParentStudentRelationship.objects.filter(parent_user=user, student=invoice.student).exists():
            return Response({'detail': 'Not authorized to pay this invoice.'}, status=403)

        if invoice.status == StudentInvoice.Status.PAID:
            return Response({'detail': 'This invoice is already fully paid.'}, status=400)

        if amount > float(invoice.balance):
            return Response(
                {'detail': f'Amount exceeds outstanding balance of {invoice.balance} XAF.'},
                status=400
            )

        METHOD_MAP = {
            'mtn_momo': 'momo',
            'orange_money': 'momo',
            'bank_transfer': 'bank',
        }
        method = METHOD_MAP.get(payment_method, 'momo')

        with db_transaction.atomic():
            payment = PaymentTransaction.objects.create(
                tenant=tenant,
                invoice=invoice,
                amount=amount,
                method=method,
                reference=f"{payment_method.upper()}-{get_random_string(12).upper()}",
                recorded_by=user,
                notes=f"Parent payment via {payment_method}. Phone: {phone_number}" if phone_number else f"Parent payment via {payment_method}",
            )

            invoice.amount_paid = invoice.amount_paid + Decimal(str(amount))
            if invoice.amount_paid >= invoice.total_amount:
                invoice.status = StudentInvoice.Status.PAID
            elif invoice.amount_paid > 0:
                invoice.status = StudentInvoice.Status.PARTIAL
            invoice.save()

        # Notify parents (confirmation) and tenant admins (payment received)
        try:
            from apps.notifications.utils import notify_payment_received
            notify_payment_received(payment, created_by=user)
        except Exception:
            pass

        return Response({
            "reference_number": payment.receipt_number,
            "status": "completed",
            "amount": amount,
            "payment_method": payment_method,
            "invoice_balance": float(invoice.balance),
        }, status=201)


