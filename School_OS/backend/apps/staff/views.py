"""
Staff Views — School OS
Teacher directory, teaching assignment management, bulk import, and marketplace.
"""
import csv
import io
import secrets
import string
from rest_framework.decorators import api_view, permission_classes as perm_decorator, action
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q, Avg, Count
from django.core.mail import send_mail
from apps.staff.models import Teacher, TeachingAssignment, PerformanceReview
from apps.staff.serializers import (
    TeacherSerializer, TeachingAssignmentSerializer,
    TeacherOnboardSerializer
)
from apps.academic.views import BaseTenantViewSet
from apps.authentication.permissions import IsSchoolAdmin, IsAdminOrTeacher, IsSchoolMember


@api_view(['POST'])
@perm_decorator([IsAuthenticated, IsSchoolAdmin])
def onboard_bursar(request):
    """
    POST /api/v1/staff/bursars/onboard/
    Create a new bursar user with the bursar role for the current tenant.
    """
    from rest_framework import serializers as drf_serializers
    from apps.authentication.models import User, UserRoleMapping

    class BursarOnboardSerializer(drf_serializers.Serializer):
        first_name = drf_serializers.CharField(max_length=150)
        last_name = drf_serializers.CharField(max_length=150)
        email = drf_serializers.EmailField()
        phone = drf_serializers.CharField(max_length=30, required=False, allow_blank=True)
        employee_id = drf_serializers.CharField(max_length=50, required=False, allow_blank=True)

        def validate_email(self, value):
            if User.objects.filter(email=value).exists():
                raise drf_serializers.ValidationError("A user with this email already exists.")
            return value

    serializer = BursarOnboardSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        with transaction.atomic():
            tenant = request.tenant

            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))

            user = User.objects.create_user(
                email=data['email'],
                username=data['email'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                password=temp_password,
            )
            user.must_change_password = True
            user.save(update_fields=['must_change_password'])

            UserRoleMapping.objects.create(
                user=user,
                tenant=tenant,
                role='bursar',
                assigned_by=request.user
            )

            employee_id = data.get('employee_id')
            if not employee_id:
                employee_id = f"BRS-{tenant.id.hex[:4].upper()}-{user.id.hex[:4].upper()}"

            from django.conf import settings
            frontend_url = settings.FRONTEND_URL
            subject = "Welcome to School OS — Your Bursar Account"
            message = (
                f"Hello {user.full_name},\n\n"
                f"Your School OS bursar account has been created.\n\n"
                f"Your temporary password is: {temp_password}\n\n"
                f"Please log in at {frontend_url} and change your password immediately.\n\n"
                f"Email: {user.email}\n"
                f"Employee ID: {employee_id}"
            )
            try:
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception:
                pass

            return Response({
                "message": f"Bursar {user.full_name} onboarded successfully. "
                          f"Temporary password below — share it with {user.first_name} (email is not configured).",
                "temp_password": temp_password,
                "user": {
                    "id": str(user.id),
                    "full_name": user.full_name,
                    "email": user.email,
                    "employee_id": employee_id,
                }
            }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@perm_decorator([IsAuthenticated, IsSchoolAdmin])
def onboard_parent(request):
    """
    POST /api/v1/staff/parents/onboard/
    Create a parent user. Parents are GLOBAL — they hold a parent role mapping
    at the creating school (their 'home') but can be linked to students in any
    school. Returns the temporary password on screen (email is not configured).
    Body: {first_name, last_name, email, phone?, default_language?,
           links?: [{student_id, relationship_type}]}
    """
    from rest_framework import serializers as drf_serializers
    from apps.authentication.models import User, UserRoleMapping
    from apps.students.models import Student, ParentStudentRelationship

    class ParentOnboardSerializer(drf_serializers.Serializer):
        first_name = drf_serializers.CharField(max_length=150)
        last_name = drf_serializers.CharField(max_length=150)
        email = drf_serializers.EmailField()
        phone = drf_serializers.CharField(max_length=30, required=False, allow_blank=True)
        default_language = drf_serializers.ChoiceField(
            choices=['en', 'fr'], required=False, default='en')
        links = drf_serializers.ListField(
            child=drf_serializers.DictField(), required=False, default=list)

        def validate_email(self, value):
            if User.objects.filter(email=value).exists():
                raise drf_serializers.ValidationError("A user with this email already exists.")
            return value

    serializer = ParentOnboardSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        with transaction.atomic():
            tenant = request.tenant

            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))

            user = User.objects.create_user(
                email=data['email'],
                username=data['email'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                password=temp_password,
                phone=data.get('phone', ''),
                default_language=data.get('default_language', 'en'),
            )
            user.must_change_password = True
            user.save(update_fields=['must_change_password'])

            UserRoleMapping.objects.create(
                user=user,
                tenant=tenant,
                role='parent',
                assigned_by=request.user,
            )

            # Validate + create student links (students must belong to the
            # requesting school; the parent can later be linked to other
            # schools' students by those schools' admins).
            created_links = []
            for link in data.get('links', []):
                student_id = link.get('student_id')
                relationship_type = link.get('relationship_type', 'guardian')
                if not student_id:
                    continue
                try:
                    student = Student.objects.get(id=student_id, tenant_id=tenant.id)
                except (Student.DoesNotExist, ValueError):
                    raise drf_serializers.ValidationError({
                        'links': f'Student {student_id} does not exist in this school.'
                    })
                if relationship_type not in ('father', 'mother', 'guardian'):
                    raise drf_serializers.ValidationError({
                        'links': f'Invalid relationship_type: {relationship_type}.'
                    })
                rel, rel_created = ParentStudentRelationship.objects.get_or_create(
                    parent_user=user, student=student,
                    defaults={'relationship_type': relationship_type},
                )
                if rel_created:
                    created_links.append(str(student.id))

            return Response({
                "message": f"Parent {user.full_name} created. "
                           f"Temporary password below — share it with {user.first_name} (email is not configured).",
                "temp_password": temp_password,
                "user": {
                    "id": str(user.id),
                    "full_name": user.full_name,
                    "email": user.email,
                    "phone": user.phone,
                    "home_school": tenant.school_name,
                },
                "linked_students": created_links,
            }, status=status.HTTP_201_CREATED)

    except drf_serializers.ValidationError:
        raise
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TeacherViewSet(BaseTenantViewSet):
    """
    API endpoint for teacher profile management.
    """
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAdminOrTeacher]
    filterset_fields = ['is_active', 'availability', 'public_profile', 'department']
    search_fields = ['user__first_name', 'user__last_name', 'employee_id', 'department']

    @action(detail=False, methods=['post'], permission_classes=[IsSchoolAdmin])
    def onboard(self, request):
        from rest_framework import status
        from apps.authentication.models import User, UserRoleMapping
        from .serializers import TeacherOnboardSerializer

        serializer = TeacherOnboardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            with transaction.atomic():
                tenant = request.tenant

                alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
                temp_password = ''.join(secrets.choice(alphabet) for i in range(12))

                username = data['email']

                user = User.objects.create_user(
                    email=data['email'],
                    username=username,
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                    password=temp_password,
                    default_language=data.get('default_language', 'en')
                )
                user.must_change_password = True
                user.save(update_fields=['must_change_password'])

                UserRoleMapping.objects.create(
                    user=user,
                    tenant=tenant,
                    role='teacher',
                    assigned_by=request.user
                )

                employee_id = data.get('employee_id')
                if not employee_id:
                    employee_id = f"TCH-{tenant.id.hex[:4].upper()}-{user.id.hex[:4].upper()}"

                teacher = Teacher.objects.create(
                    user=user,
                    tenant=tenant,
                    employee_id=employee_id,
                    qualification=data.get('qualification', ''),
                    department=data.get('department', ''),
                )

                from apps.academic.models import Subject, Class, AcademicYear

                TeachingAssignment.objects.create(
                    teacher=teacher,
                    tenant=tenant,
                    subject=Subject.objects.get(id=data['subject_id']),
                    academic_class=Class.objects.get(id=data['class_id']),
                    academic_year=AcademicYear.objects.get(id=data['academic_year_id'])
                )

                from django.conf import settings
                frontend_url = settings.FRONTEND_URL
                subject = "Welcome to School OS — Your Teacher Account"
                message = (
                    f"Hello {user.full_name},\n\n"
                    f"Your School OS teacher account has been created.\n\n"
                    f"Your temporary password is: {temp_password}\n\n"
                    f"Please log in at {frontend_url} and change your password immediately.\n\n"
                    f"Email: {user.email}\n"
                    f"Employee ID: {employee_id}"
                )
                try:
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                except Exception:
                    pass

                result_serializer = TeacherSerializer(teacher)

                return Response({
                    "message": f"Teacher {user.full_name} onboarded successfully. "
                               f"Temporary password below — share it with {user.first_name} (email is not configured).",
                    "temp_password": temp_password,
                    "teacher": result_serializer.data
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsSchoolAdmin], url_path='bulk-import')
    def bulk_import(self, request):
        """
        POST /api/v1/staff/teachers/bulk-import/
        Accepts a CSV file with columns: first_name, last_name, email, employee_id, qualification, department
        Creates User + UserRoleMapping + Teacher for each row.
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'detail': 'No file uploaded. Send a CSV file as "file".'}, status=400)

        try:
            decoded = csv_file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(decoded))
        except Exception:
            return Response({'detail': 'Could not read CSV file. Ensure it is UTF-8 encoded.'}, status=400)

        required_cols = {'first_name', 'last_name', 'email'}
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
            email = row.get('email', '').strip()
            first_name = row.get('first_name', '').strip()
            last_name = row.get('last_name', '').strip()

            if not email or not first_name or not last_name:
                errors.append({'row': row_num, 'email': email, 'error': 'Missing required fields (first_name, last_name, email)'})
                continue

            try:
                with transaction.atomic():
                    from apps.authentication.models import User, UserRoleMapping

                    if User.objects.filter(email=email).exists():
                        errors.append({'row': row_num, 'email': email, 'error': 'Email already exists'})
                        continue

                    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
                    temp_password = ''.join(secrets.choice(alphabet) for i in range(12))

                    user = User.objects.create_user(
                        email=email,
                        username=email,
                        first_name=first_name,
                        last_name=last_name,
                        password=temp_password,
                        default_language=row.get('default_language', 'en').strip() or 'en',
                    )
                    user.must_change_password = True
                    user.save(update_fields=['must_change_password'])

                    UserRoleMapping.objects.create(
                        user=user, tenant=tenant, role='teacher', assigned_by=request.user,
                    )

                    employee_id = row.get('employee_id', '').strip()
                    if not employee_id:
                        employee_id = f"TCH-{tenant.id.hex[:4].upper()}-{user.id.hex[:4].upper()}"

                    teacher = Teacher.objects.create(
                        user=user,
                        tenant=tenant,
                        employee_id=employee_id,
                        qualification=row.get('qualification', '').strip(),
                        department=row.get('department', '').strip(),
                    )

                    from django.conf import settings
                    frontend_url = settings.FRONTEND_URL
                    subject = "Welcome to School OS — Your Teacher Account"
                    message = (
                        f"Hello {first_name} {last_name},\n\n"
                        f"Your School OS teacher account has been created via bulk import.\n\n"
                        f"Your temporary password is: {temp_password}\n\n"
                        f"Please log in at {frontend_url} and change your password immediately.\n\n"
                        f"Email: {email}\n"
                        f"Employee ID: {employee_id}"
                    )
                    try:
                        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])
                    except Exception:
                        pass

                    created.append({
                        'email': email,
                        'name': f"{first_name} {last_name}",
                        'employee_id': employee_id,
                        'temp_password': temp_password,
                    })
            except Exception as e:
                errors.append({'row': row_num, 'email': email, 'error': str(e)})

        return Response({
            'message': f'Import complete. {len(created)} teachers created, {len(errors)} errors.',
            'created': created,
            'errors': errors,
        }, status=status.HTTP_201_CREATED)


class TeachingAssignmentViewSet(BaseTenantViewSet):
    """
    API endpoint for mapping teachers to classes/subjects.
    """
    queryset = TeachingAssignment.objects.all()
    serializer_class = TeachingAssignmentSerializer
    permission_classes = [IsSchoolAdmin]
    filterset_fields = ['teacher', 'subject', 'academic_class', 'academic_year']

    def perform_create(self, serializer):
        # Derive tenant from teacher if request.tenant_id is missing, 
        # though BaseTenantViewSet handles it via middleware.
        teacher = serializer.validated_data.get('teacher')
        tenant = self.request.tenant if hasattr(self.request, 'tenant') else teacher.tenant
        serializer.save(tenant=tenant)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsSchoolMember])
    def my_assignments(self, request):
        tenant_id = request.tenant_id
        teacher = Teacher.objects.filter(user=request.user, tenant_id=tenant_id).first()
        if not teacher:
            return Response([])
            
        assignments = self.get_queryset().filter(teacher=teacher)
        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)

from apps.staff.models import LeaveRequest, PerformanceReview
from apps.staff.serializers import LeaveRequestSerializer, PerformanceReviewSerializer
from rest_framework import viewsets

class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAdminOrTeacher]
    filterset_fields = ['teacher', 'status']

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return LeaveRequest.objects.none()
        return LeaveRequest.objects.filter(teacher__tenant_id=tenant_id)

class PerformanceReviewViewSet(viewsets.ModelViewSet):
    serializer_class = PerformanceReviewSerializer
    permission_classes = [IsSchoolAdmin]
    filterset_fields = ['teacher']

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return PerformanceReview.objects.none()
        return PerformanceReview.objects.filter(teacher__tenant_id=tenant_id)
