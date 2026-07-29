from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from django.db.models import Count, Q, Avg
import csv
from datetime import datetime, timedelta
from decimal import Decimal
from rest_framework.views import APIView
from .permissions import IsGovernmentOfficial
from apps.tenants.models import Tenant
from apps.students.models import Student
from apps.attendance.models import AttendanceSession, AttendanceRecord
from apps.assessments.models import Exam, ExamResult
from apps.logbook.models import CurriculumLesson, CurriculumModule


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsGovernmentOfficial])
def export_ministry_report(request):
    """
    Export Institutional Data in Ministry-ready CSV format.
    """
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="ministry_report_{datetime.now().strftime("%Y%m%d")}.csv"'

    writer = csv.writer(response)
    writer.writerow(['Indicator', 'Value', 'Compliance Status', 'Verification Date'])

    today = datetime.now().date()

    # Logbook completion
    try:
        from apps.logbook.models import LogbookEntry
        total_logbook_entries = LogbookEntry.objects.count()
        status_val = 'Fully Compliant' if total_logbook_entries > 0 else 'Needs Attention'
        writer.writerow(['Logbook Completion', f'{total_logbook_entries} entries', status_val, today.strftime("%Y-%m-%d")])
    except Exception:
        writer.writerow(['Logbook Completion', 'N/A', 'No Data', today.strftime("%Y-%m-%d")])

    # Program coverage
    try:
        total_lessons = CurriculumLesson.objects.count()
        completed = CurriculumLesson.objects.filter(is_completed=True).count()
        pct = round((completed / total_lessons * 100), 1) if total_lessons > 0 else 0
        compliance = 'Fully Compliant' if pct >= 80 else ('Needs Attention' if pct >= 50 else 'Critical Issues')
        writer.writerow(['Program Coverage', f'{pct}%', compliance, today.strftime("%Y-%m-%d")])
    except Exception:
        writer.writerow(['Program Coverage', 'N/A', 'No Data', today.strftime("%Y-%m-%d")])

    # Attendance submission
    try:
        total_sessions = AttendanceSession.objects.count()
        sessions_with_records = AttendanceSession.objects.annotate(
            record_count=Count('records')
        ).filter(record_count__gt=0).count()
        pct = round((sessions_with_records / total_sessions * 100), 1) if total_sessions > 0 else 0
        compliance = 'Fully Compliant' if pct >= 80 else ('Needs Attention' if pct >= 50 else 'Critical Issues')
        writer.writerow(['Attendance Submission', f'{pct}%', compliance, today.strftime("%Y-%m-%d")])
    except Exception:
        writer.writerow(['Attendance Submission', 'N/A', 'No Data', today.strftime("%Y-%m-%d")])

    # Mark entry
    try:
        total_exams = Exam.objects.count()
        exams_with_results = Exam.objects.annotate(
            result_count=Count('results')
        ).filter(result_count__gt=0).count()
        pct = round((exams_with_results / total_exams * 100), 1) if total_exams > 0 else 0
        compliance = 'Fully Compliant' if pct >= 80 else ('Needs Attention' if pct >= 50 else 'Critical Issues')
        writer.writerow(['Mark Entry', f'{pct}%', compliance, today.strftime("%Y-%m-%d")])
    except Exception:
        writer.writerow(['Mark Entry', 'N/A', 'No Data', today.strftime("%Y-%m-%d")])

    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGovernmentOfficial])
def recalculate_compliance(request):
    """
    Trigger a backend recalculation of institutional compliance scores.
    """
    scores = {}

    # Logbook score
    try:
        from apps.logbook.models import LogbookEntry
        total = LogbookEntry.objects.count()
        scores['logbook'] = min(100, total * 5)
    except Exception:
        scores['logbook'] = 0

    # Attendance score
    try:
        total_sessions = AttendanceSession.objects.count()
        sessions_with_records = AttendanceSession.objects.annotate(
            record_count=Count('records')
        ).filter(record_count__gt=0).count()
        scores['attendance'] = round((sessions_with_records / total_sessions * 100), 1) if total_sessions > 0 else 0
    except Exception:
        scores['attendance'] = 0

    # Assessment score
    try:
        total_exams = Exam.objects.count()
        exams_with_results = Exam.objects.annotate(
            result_count=Count('results')
        ).filter(result_count__gt=0).count()
        scores['assessments'] = round((exams_with_results / total_exams * 100), 1) if total_exams > 0 else 0
    except Exception:
        scores['assessments'] = 0

    # Overall
    values = [v for v in scores.values() if v > 0]
    overall = round(sum(values) / len(values), 1) if values else 0

    return Response({
        'status': 'success',
        'message': 'Compliance scores recalibration completed.',
        'scores': scores,
        'overall_score': f'{overall}%',
        'timestamp': datetime.now().isoformat(),
    })


class NationalDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated, IsGovernmentOfficial]

    def get(self, request):
        user = request.user

        tenants = Tenant.objects.all()
        students = Student.objects.all()

        # Regional scoping
        if user.government_region:
            tenants = tenants.filter(region__icontains=user.government_region)
            students = students.filter(tenant__region__icontains=user.government_region)

        total_schools = tenants.count()
        total_students = students.count()

        # Calculate real attendance rate (last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        national_attendance_rate = 0
        try:
            recent_sessions = AttendanceSession.objects.filter(date__gte=thirty_days_ago.date())
            if user.government_region:
                recent_sessions = recent_sessions.filter(tenant__region__icontains=user.government_region)
            total_records = AttendanceRecord.objects.filter(session__in=recent_sessions).count()
            present_count = AttendanceRecord.objects.filter(
                session__in=recent_sessions, status=AttendanceRecord.Status.PRESENT
            ).count()
            national_attendance_rate = round((present_count / total_records * 100), 1) if total_records > 0 else 0
        except Exception:
            national_attendance_rate = 0

        # Program coverage (curriculum lessons completed)
        program_coverage_percent = 0
        try:
            lesson_qs = CurriculumLesson.objects.all()
            if user.government_region:
                lesson_qs = lesson_qs.filter(module__tenant__region__icontains=user.government_region)
            total_lessons = lesson_qs.count()
            completed_lessons = lesson_qs.filter(is_completed=True).count()
            program_coverage_percent = round((completed_lessons / total_lessons * 100), 1) if total_lessons > 0 else 0
        except Exception:
            program_coverage_percent = 0

        # Performance average from exam results
        performance_average = 0
        max_scale = 20
        try:
            result_qs = ExamResult.objects.filter(score__isnull=False)
            if user.government_region:
                result_qs = result_qs.filter(exam__tenant__region__icontains=user.government_region)
            avg_score = result_qs.aggregate(avg=Avg('score'))['avg']
            if avg_score is not None:
                performance_average = round(float(avg_score), 1)
        except Exception:
            performance_average = 0

        # Regional Breakdown with student counts
        regions = ['Center', 'Littoral', 'West', 'Northwest', 'Southwest', 'Adamawa', 'East', 'Far North', 'North', 'South']
        regional_distribution = []
        for region in regions:
            if user.government_region and user.government_region.lower() not in region.lower():
                continue

            region_tenants = tenants.filter(region__icontains=region)
            region_students = students.filter(tenant__region__icontains=region)
            school_count = region_tenants.count()
            if school_count > 0 or not user.government_region:
                regional_distribution.append({
                    'name': region,
                    'schools_count': school_count,
                    'students_count': region_students.count(),
                })

        # Real alerts
        alerts = []
        alert_id = 1

        try:
            schools_with_attendance = AttendanceSession.objects.filter(
                date__gte=thirty_days_ago.date()
            ).values_list('tenant_id', flat=True).distinct()

            schools_no_attendance = tenants.exclude(id__in=schools_with_attendance)
            count = schools_no_attendance.count()
            if count > 0:
                alerts.append({
                    'id': str(alert_id),
                    'type': 'warning',
                    'title': 'Missing Attendance Data',
                    'message': f'{count} school(s) have not submitted attendance in the last 30 days.',
                    'date': datetime.now().isoformat(),
                })
                alert_id += 1
        except Exception:
            pass

        try:
            schools_with_exams = Exam.objects.values_list('tenant_id', flat=True).distinct()
            schools_no_exams = tenants.exclude(id__in=schools_with_exams)
            count = schools_no_exams.count()
            if count > 0:
                alerts.append({
                    'id': str(alert_id),
                    'type': 'info',
                    'title': 'No Assessments Recorded',
                    'message': f'{count} school(s) have not recorded any exams this term.',
                    'date': datetime.now().isoformat(),
                })
                alert_id += 1
        except Exception:
            pass

        if not alerts:
            alerts.append({
                'id': '1',
                'type': 'success',
                'title': 'All Clear',
                'message': 'No compliance issues detected across monitored institutions.',
                'date': datetime.now().isoformat(),
            })

        if user.government_region:
            alerts = [a for a in alerts if user.government_region.lower() in a['message'].lower() or a['type'] == 'success']

        data = {
            'overview': {
                'total_schools': total_schools,
                'total_students': total_students,
                'national_attendance_rate': national_attendance_rate,
                'program_coverage_percent': program_coverage_percent,
                'performance_average': performance_average,
                'max_scale': max_scale,
                'scope': user.government_region or 'National',
            },
            'regional_distribution': regional_distribution,
            'alerts': alerts,
        }

        return Response(data)


class MonitoringAPIView(APIView):
    """Returns monitoring data for the government portal."""
    permission_classes = [IsAuthenticated, IsGovernmentOfficial]

    def get(self, request):
        user = request.user
        tenants = Tenant.objects.all()
        if user.government_region:
            tenants = tenants.filter(region__icontains=user.government_region)

        # Logbook stats
        try:
            from apps.logbook.models import LogbookEntry
            total_logbooks = LogbookEntry.objects.count()
            recent_logbooks = LogbookEntry.objects.filter(
                date__gte=(datetime.now() - timedelta(days=30)).date()
            ).count()
        except Exception:
            total_logbooks = 0
            recent_logbooks = 0

        # Attendance stats
        try:
            recent_sessions = AttendanceSession.objects.filter(
                date__gte=(datetime.now() - timedelta(days=30)).date()
            )
            total_sessions = recent_sessions.count()
            sessions_with_records = recent_sessions.annotate(
                record_count=Count('records')
            ).filter(record_count__gt=0).count()
        except Exception:
            total_sessions = 0
            sessions_with_records = 0

        # Curriculum coverage
        try:
            total_lessons = CurriculumLesson.objects.count()
            completed_lessons = CurriculumLesson.objects.filter(is_completed=True).count()
            coverage_pct = round((completed_lessons / total_lessons * 100), 1) if total_lessons > 0 else 0
        except Exception:
            coverage_pct = 0

        return Response({
            'logbook': {
                'total_entries': total_logbooks,
                'recent_entries': recent_logbooks,
            },
            'attendance': {
                'total_sessions_30d': total_sessions,
                'sessions_with_records': sessions_with_records,
                'submission_rate': round((sessions_with_records / total_sessions * 100), 1) if total_sessions > 0 else 0,
            },
            'curriculum': {
                'coverage_percent': coverage_pct,
            },
        })
