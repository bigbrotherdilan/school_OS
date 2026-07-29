from decimal import Decimal
from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academic.models import AcademicYear, Class, Subject
from apps.authentication.permissions import IsSchoolAdmin
from apps.attendance.models import AttendanceSession, AttendanceRecord
from apps.finance.models import PaymentTransaction, StudentInvoice, Expense
from apps.reports.models import StudentReportCard
from apps.students.models import Student
from apps.staff.models import Teacher

from .report_card_views import SchoolPerformanceReportViewSet, ReportCardViewSet

__all__ = ['SchoolPerformanceReportViewSet', 'ReportCardViewSet', 'year_review', 'school_comparison']


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolAdmin])
def year_review(request):
    """
    Aggregated school year in review data.
    GET /reports/year-review/?academic_year_id=XXX
    """
    tenant = request.tenant
    academic_year_id = request.query_params.get('academic_year_id')

    if not academic_year_id:
        academic_year = AcademicYear.objects.filter(tenant=tenant, is_active=True).first()
        if not academic_year:
            return Response({'detail': 'No active academic year found.'}, status=400)
    else:
        try:
            academic_year = AcademicYear.objects.get(id=academic_year_id, tenant=tenant)
        except AcademicYear.DoesNotExist:
            return Response({'detail': 'Academic year not found.'}, status=404)

    # ── Students ──
    total_students = Student.objects.filter(tenant=tenant, status__in=['active', 'registered']).count()
    active_students = Student.objects.filter(tenant=tenant, status='active').count()

    # ── Teachers ──
    total_teachers = Teacher.objects.filter(tenant=tenant, is_active=True).count()

    # ── Classes ──
    total_classes = Class.objects.filter(tenant=tenant).count()

    # ── Attendance ──
    term_ids = list(academic_year.terms.values_list('id', flat=True))
    sessions = AttendanceSession.objects.filter(tenant=tenant, term_id__in=term_ids)
    total_sessions = sessions.count()
    attendance_rate = None
    if total_sessions > 0:
        total_records = AttendanceRecord.objects.filter(session__in=sessions)
        present_count = total_records.filter(status='present').count()
        total_count = total_records.count()
        if total_count > 0:
            attendance_rate = round((present_count / total_count) * 100, 1)

    # ── Finance ──
    invoices = StudentInvoice.objects.filter(tenant=tenant, academic_year=academic_year)
    total_billed = invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
    total_collected = invoices.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
    outstanding = total_billed - total_collected
    collection_rate = None
    if total_billed > 0:
        collection_rate = round(float(total_collected / total_billed) * 100, 1)

    total_expenses = Expense.objects.filter(
        tenant=tenant,
        expense_date__gte=academic_year.start_date,
        expense_date__lte=academic_year.end_date,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    net = total_collected - total_expenses

    # ── Report Cards ──
    report_cards_generated = StudentReportCard.objects.filter(
        tenant=tenant, academic_year=academic_year
    ).count()

    # ── Academic Performance ──
    from apps.assessments.models import ExamResult
    avg_score = ExamResult.objects.filter(
        exam__tenant=tenant,
        exam__term_id__in=term_ids,
        score__isnull=False,
    ).aggregate(avg=Avg('score'))['avg']

    # ── Growth ──
    students_enrolled_this_year = Student.objects.filter(
        tenant=tenant,
        enrolled_date__gte=academic_year.start_date,
        enrolled_date__lte=academic_year.end_date,
    ).count()

    data = {
        'academic_year': {
            'id': str(academic_year.id),
            'name': academic_year.name,
            'start_date': str(academic_year.start_date),
            'end_date': str(academic_year.end_date),
        },
        'school': {
            'name': tenant.school_name,
            'logo_url': tenant.logo_url or '',
            'motto': tenant.motto or '',
        },
        'students': {
            'total': total_students,
            'active': active_students,
            'enrolled_this_year': students_enrolled_this_year,
        },
        'teachers': {
            'total': total_teachers,
        },
        'classes': {
            'total': total_classes,
        },
        'attendance': {
            'rate': attendance_rate,
            'total_sessions': total_sessions,
        },
        'finance': {
            'total_billed': float(total_billed),
            'total_collected': float(total_collected),
            'outstanding': float(outstanding),
            'collection_rate': collection_rate,
            'total_expenses': float(total_expenses),
            'net': float(net),
        },
        'academics': {
            'report_cards_generated': report_cards_generated,
            'average_score': round(float(avg_score), 1) if avg_score else None,
        },
        'generated_at': timezone.now().isoformat(),
    }

    return Response(data)


# ── Benchmarks for schools without enough multi-tenant data ──
BENCHMARKS = {
    'attendance': 68,
    'fee_collection': 62,
}


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolAdmin])
def school_comparison(request):
    """
    Compare this school's metrics against platform benchmarks.
    GET /reports/comparison/?academic_year_id=XXX
    """
    tenant = request.tenant
    academic_year_id = request.query_params.get('academic_year_id')

    if not academic_year_id:
        academic_year = AcademicYear.objects.filter(tenant=tenant, is_active=True).first()
    else:
        try:
            academic_year = AcademicYear.objects.get(id=academic_year_id, tenant=tenant)
        except AcademicYear.DoesNotExist:
            academic_year = None

    # ── Attendance rate ──
    attendance_rate = None
    if academic_year:
        term_ids = list(academic_year.terms.values_list('id', flat=True))
        sessions = AttendanceSession.objects.filter(tenant=tenant, term_id__in=term_ids)
        total_sessions = sessions.count()
        if total_sessions > 0:
            total_records = AttendanceRecord.objects.filter(session__in=sessions)
            present_count = total_records.filter(status='present').count()
            total_count = total_records.count()
            if total_count > 0:
                attendance_rate = round((present_count / total_count) * 100, 1)

    # ── Fee collection rate ──
    fee_collection_rate = None
    if academic_year:
        invoices = StudentInvoice.objects.filter(tenant=tenant, academic_year=academic_year)
        total_billed = invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        total_collected = invoices.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
        if float(total_billed) > 0:
            fee_collection_rate = round(float(total_collected / total_billed) * 100, 1)

    # ── Enrollment growth ──
    enrollment_growth = 0
    if academic_year:
        enrolled_this_year = Student.objects.filter(
            tenant=tenant,
            enrolled_date__gte=academic_year.start_date,
            enrolled_date__lte=academic_year.end_date,
        ).count()
        total_active = Student.objects.filter(tenant=tenant, status__in=['active', 'registered']).count()
        if total_active > 0:
            enrollment_growth = round((enrolled_this_year / total_active) * 100, 1)

    # ── Percentile estimate ──
    school_score = 0
    score_count = 0
    if attendance_rate is not None:
        school_score += attendance_rate * 0.4
        score_count += 1
    if fee_collection_rate is not None:
        school_score += fee_collection_rate * 0.6
        score_count += 1

    benchmark_score = BENCHMARKS['attendance'] * 0.4 + BENCHMARKS['fee_collection'] * 0.6
    percentile = 50
    if score_count > 0:
        percentile = min(99, max(5, round(50 + (school_score - benchmark_score) * 2)))

    return Response({
        'attendance': {
            'school': attendance_rate,
            'benchmark': BENCHMARKS['attendance'],
        },
        'feeCollection': {
            'school': fee_collection_rate,
            'benchmark': BENCHMARKS['fee_collection'],
        },
        'enrollmentGrowth': {
            'school': enrollment_growth,
            'benchmark': 0,
        },
        'percentile': percentile,
    })
