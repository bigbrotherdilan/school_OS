"""
Test fixtures for the timetable test suite (spec-driven, permanent).
"""
import uuid
from datetime import date

from django.contrib.auth import get_user_model

from apps.tenants.models import Tenant
from apps.academic.models import AcademicYear, Section, Class, Subject, ClassSubject
from apps.staff.models import Teacher, TeachingAssignment
from apps.timetable.models import Timetable, Lesson, TeacherUnavailability

# Small deterministic school week (5 days x 4 periods, lunch break 10:00-10:30).
PERIODS = [
    {'start': '07:30', 'end': '08:20'},
    {'start': '08:20', 'end': '09:10'},
    {'start': '09:10', 'end': '10:00'},
    {'start': '10:30', 'end': '11:20'},
]
WORKING_DAYS = [1, 2, 3, 4, 5]


def make_tenant(name='Test College Molyko'):
    return Tenant.objects.create(
        school_name=name,
        slug=f'test-{uuid.uuid4().hex[:8]}',
        status='active',
    )


def make_user(is_platform_admin=False):
    User = get_user_model()
    uid = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        username=f'user-{uid}',
        email=f'user-{uid}@test.local',
        password='testpass123',
        is_platform_admin=is_platform_admin,
    )


def make_teacher(tenant):
    user = make_user()
    return Teacher.objects.create(
        tenant=tenant,
        user=user,
        employee_id=f'E{uuid.uuid4().hex[:8].upper()}',
        is_active=True,
    )


def make_year(tenant):
    return AcademicYear.objects.create(
        tenant=tenant,
        name='2026/2027',
        start_date=date(2026, 9, 1),
        end_date=date(2027, 7, 31),
        is_active=True,
    )


def make_section(tenant, name='Anglophone'):
    return Section.objects.create(tenant=tenant, name=name)


def make_class(tenant, section, name, level_order=1):
    return Class.objects.create(
        tenant=tenant, stream=section, name=name, level_order=level_order
    )


def make_subject(tenant, name, code, coefficient=4, double_preferred=False):
    return Subject.objects.create(
        tenant=tenant,
        name=name,
        code=code,
        default_coefficient=coefficient,
        is_compulsory=True,
        is_double_preferred=double_preferred,
    )


def make_class_subject(cls, subject, weekly_hours, student_group=None, is_double=None):
    return ClassSubject.objects.create(
        academic_class=cls,
        subject=subject,
        weekly_hours=weekly_hours,
        student_group=student_group,
        is_double=is_double,
    )


def make_assignment(teacher, cls, subject, student_group=None):
    return TeachingAssignment.objects.create(
        teacher=teacher,
        tenant=teacher.tenant,
        subject=subject,
        academic_class=cls,
        student_group=student_group,
    )


def make_timetable(tenant, year, cls, periods=None, working_days=None,
                   day_periods=None, blocked_slots=None):
    return Timetable.objects.create(
        tenant=tenant,
        academic_year=year,
        class_obj=cls,
        periods=periods if periods is not None else PERIODS,
        working_days=working_days if working_days is not None else WORKING_DAYS,
        day_periods=day_periods or {},
        blocked_slots=blocked_slots or [],
        is_active=True,
    )


def make_lesson(timetable, subject, teacher=None, student_group=None,
                periods=8, is_double=False, note=''):
    return Lesson.objects.create(
        timetable=timetable,
        subject=subject,
        teacher=teacher,
        student_group=student_group,
        periods_per_week=periods,
        is_double=is_double,
        note=note,
    )


def make_unavailability(teacher, day, start, end, reason=''):
    return TeacherUnavailability.objects.create(
        tenant=teacher.tenant,
        teacher=teacher,
        day_of_week=day,
        start_time=start,
        end_time=end,
        reason=reason,
    )
