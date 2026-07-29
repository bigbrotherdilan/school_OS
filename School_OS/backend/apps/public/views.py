"""
Public API Views — No authentication required.
Serves school directory, enrollment inquiries, teacher marketplace.
Uses a different prefix (/pub/v1/) and response format than private APIs
so attackers cannot identify the backend technology.
"""
import re
import logging
from datetime import timedelta

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings

from apps.tenants.models import Tenant
from apps.students.models import Student
from apps.staff.models import Teacher
from .serializers import PublicSchoolListSerializer, PublicSchoolProfileSerializer

logger = logging.getLogger(__name__)


class PublicRateThrottle(AnonRateThrottle):
    """Stricter rate limiting for public endpoints — 20 requests per minute per IP."""
    scope = 'public'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


def _sanitize_input(value):
    """Strip HTML tags and trim whitespace."""
    if not value:
        return ''
    value = str(value).strip()
    value = re.sub(r'<[^>]*>', '', value)
    return value[:1000]


def _check_honeypot(request):
    """Check honeypot fields — hidden fields bots fill in but humans don't see."""
    honeypot = request.data.get('website', '') or request.data.get('fax', '')
    if honeypot:
        logger.warning(f"Honeypot triggered from IP: {request.META.get('REMOTE_ADDR')}")
        return True
    return False


def _wrap_response(data, meta=None):
    """Wrap public API responses in a non-standard format."""
    response = {'data': data}
    if meta:
        response['meta'] = meta
    return Response(response)


def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


class PublicSchoolListView(generics.ListAPIView):
    """
    GET /pub/v1/schools/
    Public school directory — no auth required.
    """
    serializer_class = PublicSchoolListSerializer
    permission_classes = [AllowAny]
    throttle_classes = [PublicRateThrottle]
    pagination_class = None

    def get_queryset(self):
        qs = Tenant.objects.filter(status=Tenant.Status.ACTIVE)

        qs = qs.annotate(
            _student_count=Count(
                'students__id',
                filter=Q(students__status__in=['active', 'registered']),
                distinct=True,
            ),
            _class_count=Count('classes__id', distinct=True),
        )

        q = _sanitize_input(self.request.query_params.get('q', ''))
        if q:
            qs = qs.filter(
                Q(school_name__icontains=q) |
                Q(region__icontains=q) |
                Q(division__icontains=q) |
                Q(education_type__icontains=q)
            )

        region = _sanitize_input(self.request.query_params.get('region', ''))
        if region:
            qs = qs.filter(region__iexact=region)

        edu_type = _sanitize_input(self.request.query_params.get('education_type', ''))
        if edu_type:
            qs = qs.filter(education_type__iexact=edu_type)

        school_type = _sanitize_input(self.request.query_params.get('school_type', ''))
        if school_type:
            qs = qs.filter(school_type__iexact=school_type)

        return qs.order_by('school_name')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return _wrap_response(serializer.data, meta={'total': len(serializer.data)})


class PublicSchoolProfileView(generics.RetrieveAPIView):
    """
    GET /pub/v1/schools/<slug>/
    Full school profile — no auth required.
    """
    serializer_class = PublicSchoolProfileSerializer
    permission_classes = [AllowAny]
    throttle_classes = [PublicRateThrottle]
    lookup_field = 'slug'

    def get_queryset(self):
        return Tenant.objects.filter(status=Tenant.Status.ACTIVE)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return _wrap_response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PublicRateThrottle])
def submit_enrollment_inquiry(request):
    """
    POST /pub/v1/enrollment/
    Submit an enrollment inquiry for a school. No auth required.
    Includes honeypot fields and input sanitization for bot protection.
    """
    if _check_honeypot(request):
        return _wrap_response(
            {'message': 'Enrollment inquiry submitted successfully. The school will contact you soon.'},
            status=status.HTTP_201_CREATED,
        )

    MAX_PAYLOAD_SIZE = 10240
    if request.body and len(request.body) > MAX_PAYLOAD_SIZE:
        return _wrap_response(
            {'error': 'Payload too large.'},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    required_fields = ['school_id', 'child_first_name', 'child_last_name', 'parent_name', 'parent_phone']
    for field in required_fields:
        value = request.data.get(field, '')
        if not value or not str(value).strip():
            return _wrap_response(
                {'error': f'{field} is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    try:
        school = Tenant.objects.get(id=request.data['school_id'], status=Tenant.Status.ACTIVE)
    except (Tenant.DoesNotExist, ValueError):
        return _wrap_response(
            {'error': 'School not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    parent_name = _sanitize_input(request.data.get('parent_name', ''))
    parent_phone = _sanitize_input(request.data.get('parent_phone', ''))
    child_first = _sanitize_input(request.data.get('child_first_name', ''))
    child_last = _sanitize_input(request.data.get('child_last_name', ''))
    email = _sanitize_input(request.data.get('email', ''))
    date_of_birth = _sanitize_input(request.data.get('date_of_birth', ''))
    gender = _sanitize_input(request.data.get('gender', ''))
    grade = _sanitize_input(request.data.get('grade', ''))
    notes = _sanitize_input(request.data.get('notes', ''))

    try:
        from apps.notifications.models import Announcement
        Announcement.objects.create(
            tenant=school,
            title=f'New Enrollment Inquiry: {child_first} {child_last}',
            body=(
                f"Parent: {parent_name}\n"
                f"Phone: {parent_phone}\n"
                f"Email: {email or 'N/A'}\n"
                f"Child: {child_first} {child_last}\n"
                f"DOB: {date_of_birth or 'N/A'}\n"
                f"Gender: {gender or 'N/A'}\n"
                f"Grade: {grade or 'N/A'}\n"
                f"Notes: {notes or 'N/A'}"
            ),
            is_urgent=False,
            published=True,
        )
    except Exception as e:
        logger.error(f"Failed to create enrollment inquiry: {e}")
        return _wrap_response(
            {'error': 'Failed to submit inquiry. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    ip = _get_client_ip(request)
    logger.info(f"Enrollment inquiry submitted from IP: {ip} for school: {school.slug}")

    return _wrap_response(
        {'message': 'Enrollment inquiry submitted successfully. The school will contact you soon.'},
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([PublicRateThrottle])
def school_regions(request):
    """
    GET /pub/v1/regions/
    List all distinct regions with school counts.
    """
    regions = (
        Tenant.objects.filter(status=Tenant.Status.ACTIVE)
        .values_list('region', flat=True)
        .distinct()
        .order_by('region')
    )
    data = [
        {'name': r, 'count': Tenant.objects.filter(region=r, status=Tenant.Status.ACTIVE).count()}
        for r in regions if r
    ]
    return _wrap_response(data, meta={'total': len(data)})


class PublicTeacherListView(generics.ListAPIView):
    """
    GET /pub/v1/teachers/
    National teacher marketplace — public, no auth required.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PublicRateThrottle]
    pagination_class = None

    def get_queryset(self):
        qs = Teacher.objects.filter(
            public_profile=True,
            is_active=True,
        ).select_related('user', 'tenant')

        q = _sanitize_input(self.request.query_params.get('q', ''))
        if q:
            qs = qs.filter(
                Q(user__first_name__icontains=q) |
                Q(user__last_name__icontains=q) |
                Q(department__icontains=q) |
                Q(qualification__icontains=q)
            )

        subject = _sanitize_input(self.request.query_params.get('subject', ''))
        if subject:
            qs = qs.filter(
                Q(subjects_taught__contains=[subject]) |
                Q(assignments__subject__name__icontains=subject)
            ).distinct()

        region = _sanitize_input(self.request.query_params.get('region', ''))
        if region:
            qs = qs.filter(tenant__region__icontains=region)

        availability = _sanitize_input(self.request.query_params.get('availability', ''))
        if availability:
            qs = qs.filter(availability=availability)

        min_rating = _sanitize_input(self.request.query_params.get('min_rating', ''))
        if min_rating:
            try:
                qs = qs.filter(average_rating__gte=float(min_rating))
            except ValueError:
                pass

        return qs.order_by('-average_rating', 'user__last_name')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []
        for teacher in queryset:
            school = teacher.tenant
            data.append({
                'id': str(teacher.id),
                'name': teacher.user.full_name,
                'qualification': teacher.qualification,
                'department': teacher.department,
                'specializations': teacher.specializations,
                'subjects_taught': teacher.subjects_taught,
                'languages_spoken': teacher.languages_spoken,
                'availability': teacher.availability,
                'hourly_rate': str(teacher.hourly_rate) if teacher.hourly_rate else None,
                'average_rating': float(teacher.average_rating),
                'total_reviews': teacher.total_reviews,
                'years_of_experience': teacher.years_of_experience,
                'profile_photo': teacher.user.profile_photo or '',
                'school': {
                    'id': str(school.id),
                    'name': school.school_name,
                    'slug': school.slug,
                    'region': school.region,
                    'division': school.division,
                    'education_type': school.education_type,
                },
            })

        return _wrap_response(data, meta={'total': len(data)})
