"""
Analytics & Statistics Views — School OS
Provides aggregated performance data for admin and teacher dashboards.
"""
from decimal import Decimal
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Avg, Count, Q, Sum, F
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academic.models import AcademicYear, Term, Class, Subject, Section, ClassSubject, effective_coefficient
from apps.assessments.models import Exam, ExamResult, MarkEntryWindow
from apps.attendance.models import AttendanceSession, AttendanceRecord
from apps.authentication.permissions import IsSchoolMember, IsSchoolAdmin, IsAdminOrTeacher
from apps.logbook.models import CurriculumModule, CurriculumLesson
from apps.staff.models import TeachingAssignment
from apps.students.models import Student
from apps.tenants.models import Tenant


def _get_tenant(request):
    tenant_id = getattr(request, 'tenant_id', None)
    if not tenant_id:
        return None
    try:
        return Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return None


def _get_grade(percentage, education_type):
    if percentage is None:
        return 'N/A'
    if education_type == 'francophone':
        if percentage >= 90: return 'TB'
        elif percentage >= 75: return 'B'
        elif percentage >= 60: return 'AB'
        elif percentage >= 50: return 'P'
        elif percentage >= 40: return 'I'
        else: return 'F'
    else:
        if percentage >= 80: return 'A'
        elif percentage >= 70: return 'B'
        elif percentage >= 60: return 'C'
        elif percentage >= 50: return 'D'
        else: return 'F'


def _get_grade_bucket(percentage):
    if percentage is None:
        return 'No Data'
    if percentage >= 80: return 'Distinction (80-100)'
    elif percentage >= 70: return 'Merit (70-79)'
    elif percentage >= 60: return 'Credit (60-69)'
    elif percentage >= 50: return 'Pass (50-59)'
    else: return 'Fail (0-49)'


def _compute_subject_stats(exam_results, education_type, max_scale=100):
    """Compute stats from a queryset of ExamResult."""
    scores = [r.score for r in exam_results if r.score is not None]
    if not scores:
        return {
            'average': None, 'count': 0,
            'pass_count': 0, 'fail_count': 0, 'pass_rate': None,
            'highest': None, 'lowest': None, 'grade_distribution': {},
        }

    pass_mark = Decimal('10') if education_type == 'francophone' else Decimal('50')
    total = len(scores)
    passed = sum(1 for s in scores if s >= pass_mark)
    failed = total - passed
    avg_score = sum(scores) / total
    avg_percentage = (float(avg_score) / float(max_scale)) * 100

    dist = defaultdict(int)
    for s in scores:
        pct = (float(s) / float(max_scale)) * 100
        bucket = _get_grade_bucket(pct)
        dist[bucket] += 1

    return {
        'average': round(float(avg_score), 2),
        'average_percentage': round(avg_percentage, 1),
        'count': total,
        'pass_count': passed,
        'fail_count': failed,
        'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
        'highest': round(float(max(scores)), 2),
        'lowest': round(float(min(scores)), 2),
        'grade_distribution': dict(dist),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolAdmin])
def exam_performance_overview(request):
    """
    GET /api/v1/reports/analytics/exam-performance/
    School-wide exam performance analytics for a given term.
    Query params: academic_year_id, term_id
    """
    tenant = _get_tenant(request)
    if not tenant:
        return Response({'detail': 'Tenant not found.'}, status=400)

    term_id = request.query_params.get('term_id')
    year_id = request.query_params.get('academic_year_id')

    if not term_id or not year_id:
        return Response({'detail': 'term_id and academic_year_id are required.'}, status=400)

    try:
        term = Term.objects.get(id=term_id, academic_year_id=year_id)
        year = AcademicYear.objects.get(id=year_id, tenant=tenant)
    except (Term.DoesNotExist, AcademicYear.DoesNotExist) as e:
        return Response({'detail': str(e)}, status=404)

    max_scale = 100 if tenant.education_type == 'anglophone' else 20
    education_type = tenant.education_type
    pass_mark = Decimal('50') if education_type == 'anglophone' else Decimal('10')

    exams = Exam.objects.filter(tenant=tenant, term=term)
    results = ExamResult.objects.filter(exam__in=exams).select_related('student', 'subject', 'exam')

    total_results = results.count()
    total_students_with_marks = results.values('student').distinct().count()
    subjects_with_data = results.values('subject').distinct().count()

    # Subject breakdown
    subject_breakdown = []
    for subj_id in results.values_list('subject', flat=True).distinct():
        subj_results = results.filter(subject_id=subj_id)
        subj = subj_results.first().subject
        stats = _compute_subject_stats(subj_results, education_type, max_scale)
        subject_breakdown.append({
            'subject_id': str(subj.id),
            'subject_name': subj.name,
            'subject_code': subj.code,
            'coefficient': float(subj.default_coefficient),
            'stream': subj.stream.name if hasattr(subj, 'stream') and subj.stream else None,
            **stats,
        })

    # Class breakdown
    class_breakdown = []
    class_ids = results.values_list('student__current_class_id', flat=True).distinct()
    for cls_id in class_ids:
        if not cls_id:
            continue
        cls_results = results.filter(student__current_class_id=cls_id)
        cls_obj = cls_results.first().student.current_class
        stats = _compute_subject_stats(cls_results, education_type, max_scale)
        class_breakdown.append({
            'class_id': str(cls_obj.id),
            'class_name': cls_obj.name,
            'stream': cls_obj.stream.name if cls_obj.stream else None,
            'student_count': cls_results.values('student').distinct().count(),
            **stats,
        })

    # Section breakdown
    section_breakdown = []
    for section_id in Section.objects.filter(tenant=tenant).values_list('id', flat=True):
        section_results = results.filter(student__stream_id=section_id)
        if not section_results.exists():
            continue
        stats = _compute_subject_stats(section_results, education_type, max_scale)
        section_breakdown.append({
            'section_id': str(section_id),
            'section_name': section_results.first().student.stream.name,
            **stats,
        })

    # Grade distribution (overall)
    all_scores = [r.score for r in results if r.score is not None]
    grade_dist = defaultdict(int)
    for s in all_scores:
        pct = (float(s) / float(max_scale)) * 100
        grade_dist[_get_grade_bucket(pct)] += 1

    # Overall stats
    overall = _compute_subject_stats(results, education_type, max_scale)

    return Response({
        'term': term.name,
        'academic_year': year.name,
        'education_type': education_type,
        'max_scale': max_scale,
        'pass_mark': float(pass_mark),
        'total_students_assessed': total_students_with_marks,
        'total_exam_results': total_results,
        'subjects_with_data': subjects_with_data,
        'overall': overall,
        'grade_distribution': dict(grade_dist),
        'subject_breakdown': sorted(subject_breakdown, key=lambda x: x['subject_name']),
        'class_breakdown': sorted(class_breakdown, key=lambda x: x['class_name']),
        'section_breakdown': section_breakdown,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolAdmin])
def subject_performance_detail(request):
    """
    GET /api/v1/reports/analytics/subject-performance/
    Detailed performance breakdown for a specific subject across classes.
    Query params: subject_id, term_id, academic_year_id
    """
    tenant = _get_tenant(request)
    if not tenant:
        return Response({'detail': 'Tenant not found.'}, status=400)

    subject_id = request.query_params.get('subject_id')
    term_id = request.query_params.get('term_id')
    year_id = request.query_params.get('academic_year_id')

    if not all([subject_id, term_id, year_id]):
        return Response({'detail': 'subject_id, term_id, and academic_year_id are required.'}, status=400)

    try:
        subject = Subject.objects.get(id=subject_id, tenant=tenant)
        term = Term.objects.get(id=term_id, academic_year_id=year_id)
    except (Subject.DoesNotExist, Term.DoesNotExist):
        return Response({'detail': 'Subject or term not found.'}, status=404)

    max_scale = 100 if tenant.education_type == 'anglophone' else 20
    education_type = tenant.education_type

    exams = Exam.objects.filter(tenant=tenant, term=term)
    results = ExamResult.objects.filter(
        exam__in=exams, subject=subject
    ).select_related('student', 'student__current_class')

    overall = _compute_subject_stats(results, education_type, max_scale)

    # Per-class breakdown
    class_breakdown = []
    for cls_id in results.values_list('student__current_class_id', flat=True).distinct():
        if not cls_id:
            continue
        cls_results = results.filter(student__current_class_id=cls_id)
        cls_obj = cls_results.first().student.current_class
        stats = _compute_subject_stats(cls_results, education_type, max_scale)
        class_breakdown.append({
            'class_id': str(cls_obj.id),
            'class_name': cls_obj.name,
            **stats,
        })

    # Top and bottom students
    student_scores = []
    for r in results:
        if r.score is not None:
            pct = (float(r.score) / float(max_scale)) * 100
            student_scores.append({
                'student_id': str(r.student.id),
                'student_name': r.student.full_name,
                'admission_number': r.student.admission_number,
                'class_name': r.student.current_class.name if r.student.current_class else 'N/A',
                'score': float(r.score),
                'percentage': round(pct, 1),
                'grade': _get_grade(pct, education_type),
            })

    student_scores.sort(key=lambda x: x['score'], reverse=True)
    top_students = student_scores[:10]
    bottom_students = student_scores[-10:] if len(student_scores) >= 10 else student_scores
    bottom_students.reverse()

    return Response({
        'subject': subject.name,
        'subject_code': subject.code,
        'coefficient': float(subject.default_coefficient),
        'term': term.name,
        'overall': overall,
        'class_breakdown': sorted(class_breakdown, key=lambda x: x['class_name']),
        'top_students': top_students,
        'bottom_students': bottom_students,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolAdmin])
def class_performance_detail(request):
    """
    GET /api/v1/reports/analytics/class-performance/
    Full performance breakdown for a single class across all subjects.
    Query params: class_id, term_id, academic_year_id
    """
    tenant = _get_tenant(request)
    if not tenant:
        return Response({'detail': 'Tenant not found.'}, status=400)

    class_id = request.query_params.get('class_id')
    term_id = request.query_params.get('term_id')
    year_id = request.query_params.get('academic_year_id')

    if not all([class_id, term_id, year_id]):
        return Response({'detail': 'class_id, term_id, and academic_year_id are required.'}, status=400)

    try:
        cls_obj = Class.objects.get(id=class_id, tenant=tenant)
        term = Term.objects.get(id=term_id, academic_year_id=year_id)
    except (Class.DoesNotExist, Term.DoesNotExist):
        return Response({'detail': 'Class or term not found.'}, status=404)

    max_scale = 100 if tenant.education_type == 'anglophone' else 20
    education_type = tenant.education_type

    exams = Exam.objects.filter(tenant=tenant, term=term)
    results = ExamResult.objects.filter(
        exam__in=exams, student__current_class=cls_obj
    ).select_related('student', 'subject')

    # Per-subject breakdown
    subject_breakdown = []
    for subj_id in results.values_list('subject_id', flat=True).distinct():
        subj_results = results.filter(subject_id=subj_id)
        subj = subj_results.first().subject
        stats = _compute_subject_stats(subj_results, education_type, max_scale)
        subject_breakdown.append({
            'subject_id': str(subj.id),
            'subject_name': subj.name,
            'subject_code': subj.code,
            'coefficient': float(effective_coefficient(cls_obj.stream, subj)),
            **stats,
        })

    # Student rankings
    student_totals = defaultdict(lambda: {'total_score': Decimal('0'), 'subject_count': 0, 'name': '', 'admission': ''})
    for r in results:
        if r.score is not None:
            sid = str(r.student.id)
            student_totals[sid]['total_score'] += r.score
            student_totals[sid]['subject_count'] += 1
            student_totals[sid]['name'] = r.student.full_name
            student_totals[sid]['admission'] = r.student.admission_number

    student_rankings = []
    for sid, data in student_totals.items():
        avg = float(data['total_score']) / data['subject_count'] if data['subject_count'] > 0 else 0
        pct = (avg / float(max_scale)) * 100
        student_rankings.append({
            'student_id': sid,
            'student_name': data['name'],
            'admission_number': data['admission'],
            'average': round(avg, 2),
            'percentage': round(pct, 1),
            'grade': _get_grade(pct, education_type),
            'subjects_taken': data['subject_count'],
        })

    student_rankings.sort(key=lambda x: x['average'], reverse=True)
    for rank, s in enumerate(student_rankings, 1):
        s['rank'] = rank

    overall = _compute_subject_stats(results, education_type, max_scale)
    student_count = results.values('student').distinct().count()

    return Response({
        'class_name': cls_obj.name,
        'section': cls_obj.stream.name if cls_obj.stream else None,
        'term': term.name,
        'student_count': student_count,
        'overall': overall,
        'subject_breakdown': sorted(subject_breakdown, key=lambda x: x['subject_name']),
        'student_rankings': student_rankings,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminOrTeacher])
def teacher_analytics_summary(request):
    """
    GET /api/v1/reports/analytics/teacher-summary/
    Returns performance data for a teacher's subjects + classmaster overview.
    Query params: term_id (optional, defaults to latest)
    """
    tenant = _get_tenant(request)
    if not tenant:
        return Response({'detail': 'Tenant not found.'}, status=400)

    user = request.user
    term_id = request.query_params.get('term_id')

    # Get teacher profile
    try:
        teacher = user.teacher_profiles.first()
    except:
        return Response({'detail': 'Teacher profile not found.'}, status=404)

    # Resolve term
    if term_id:
        try:
            term = Term.objects.get(id=term_id, academic_year__tenant=tenant)
        except Term.DoesNotExist:
            return Response({'detail': 'Term not found.'}, status=404)
    else:
        term = Term.objects.filter(
            academic_year__tenant=tenant, academic_year__is_active=True
        ).order_by('-order_number').first()
        if not term:
            return Response({'detail': 'No active term found.'}, status=404)

    max_scale = 100 if tenant.education_type == 'anglophone' else 20
    education_type = tenant.education_type

    # Get teacher's assignments
    assignments = TeachingAssignment.objects.filter(
        teacher=teacher, academic_year=term.academic_year
    ).select_related('subject', 'academic_class')

    subject_performance = []
    all_student_scores = []

    for assignment in assignments:
        exams = Exam.objects.filter(tenant=tenant, term=term)
        results = ExamResult.objects.filter(
            exam__in=exams,
            subject=assignment.subject,
            student__current_class=assignment.academic_class,
        ).select_related('student')

        stats = _compute_subject_stats(results, education_type, max_scale)
        total_students = Student.objects.filter(
            current_class=assignment.academic_class, tenant=tenant,
            status__in=['active', 'registered']
        ).count()

        subject_performance.append({
            'subject_id': str(assignment.subject.id),
            'subject_name': assignment.subject.name,
            'subject_code': assignment.subject.code,
            'class_id': str(assignment.academic_class.id),
            'class_name': assignment.academic_class.name,
            'total_students': total_students,
            'students_with_marks': stats['count'],
            **stats,
        })

        for r in results:
            if r.score is not None:
                all_student_scores.append(r)

    # Check if teacher is classmaster of any class
    # A teacher is considered classmaster if they teach >= 50% of subjects in a class
    is_classmaster = False
    classmaster_view = None

    classes_taught = set(a.academic_class_id for a in assignments)
    for cls_id in classes_taught:
        cls = Class.objects.get(id=cls_id)
        subjects_in_class = ClassSubject.objects.filter(
            academic_class=cls
        ).count()
        teacher_subjects = assignments.filter(academic_class=cls).count()
        if subjects_in_class > 0 and teacher_subjects >= subjects_in_class * 0.5:
            is_classmaster = True
            exams = Exam.objects.filter(tenant=tenant, term=term)
            all_class_results = ExamResult.objects.filter(
                exam__in=exams,
                student__current_class=cls,
            ).select_related('student', 'subject')

            student_totals = defaultdict(lambda: {
                'total': Decimal('0'), 'count': 0, 'name': '', 'admission': ''
            })
            for r in all_class_results:
                if r.score is not None:
                    sid = str(r.student.id)
                    student_totals[sid]['total'] += r.score
                    student_totals[sid]['count'] += 1
                    student_totals[sid]['name'] = r.student.full_name
                    student_totals[sid]['admission'] = r.student.admission_number

            rankings = []
            for sid, d in student_totals.items():
                avg = float(d['total']) / d['count'] if d['count'] > 0 else 0
                pct = (avg / max_scale) * 100
                rankings.append({
                    'student_id': sid,
                    'student_name': d['name'],
                    'admission_number': d['admission'],
                    'average': round(avg, 2),
                    'percentage': round(pct, 1),
                    'grade': _get_grade(pct, education_type),
                })
            rankings.sort(key=lambda x: x['average'], reverse=True)
            for rank, s in enumerate(rankings, 1):
                s['rank'] = rank

            classmaster_view = {
                'class_name': cls.name,
                'section': cls.stream.name if cls.stream else None,
                'student_count': all_class_results.values('student').distinct().count(),
                'student_rankings': rankings[:30],
            }
            break

    # Overall stats for teacher's subjects
    overall_stats = _compute_subject_stats(
        ExamResult.objects.filter(id__in=[r.id for r in all_student_scores]),
        education_type, max_scale
    ) if all_student_scores else {'average': None, 'count': 0, 'pass_rate': None}

    return Response({
        'teacher_name': user.full_name,
        'term': term.name,
        'academic_year': term.academic_year.name,
        'overall': overall_stats,
        'subject_performance': subject_performance,
        'is_classmaster': is_classmaster,
        'classmaster_view': classmaster_view,
        'assignments_count': len(assignments),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolMember])
def analytics_metadata(request):
    """
    GET /api/v1/reports/analytics/metadata/
    Returns academic years, terms, classes, and subjects for filter dropdowns.
    """
    tenant = _get_tenant(request)
    if not tenant:
        return Response({'detail': 'Tenant not found.'}, status=400)

    cache_key = f'analytics_metadata:{tenant.id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    years = AcademicYear.objects.filter(tenant=tenant).values('id', 'name', 'is_active')
    terms = Term.objects.filter(academic_year__tenant=tenant).values(
        'id', 'name', 'order_number', 'academic_year_id'
    )
    classes = Class.objects.filter(tenant=tenant).values('id', 'name', 'stream__name')
    subjects = Subject.objects.filter(tenant=tenant).values('id', 'name', 'code')

    data = {
        'academic_years': list(years),
        'terms': list(terms),
        'classes': list(classes),
        'subjects': list(subjects),
    }
    # Filter dropdowns are loaded once per page visit; a short TTL keeps
    # them fresh after admins add classes/subjects/years.
    cache.set(cache_key, data, 60)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSchoolAdmin])
def dashboard_overview(request):
    """
    GET /api/v1/reports/analytics/dashboard-overview/
    Comprehensive admin dashboard data: students, teachers, academics,
    attendance, curriculum compliance, mark filling status, and alerts.
    """
    tenant = _get_tenant(request)
    if not tenant:
        return Response({'detail': 'Tenant not found.'}, status=400)

    active_year = AcademicYear.objects.filter(tenant=tenant, is_active=True).first()
    current_term = Term.objects.filter(academic_year=active_year).order_by('order_number').last() if active_year else None
    education_type = tenant.education_type
    max_scale = 100 if education_type == 'anglophone' else 20

    # ── Students ──
    students_qs = Student.objects.filter(tenant=tenant)
    total_students = students_qs.count()
    active_students = students_qs.filter(status__in=['active', 'registered']).count()
    new_this_month = students_qs.filter(
        enrollment_date__gte=timezone.now().date() - timezone.timedelta(days=30)
    ).count()

    # ── Teachers ──
    from apps.staff.models import Teacher
    teachers_qs = Teacher.objects.filter(tenant=tenant)
    total_teachers = teachers_qs.count()
    active_assignments = TeachingAssignment.objects.filter(
        teacher__tenant=tenant,
        academic_year=active_year,
    ).count() if active_year else 0

    # ── Academics ──
    overall_average = None
    pass_rate = None
    best_subject = None
    worst_subject = None
    grade_distribution = {}

    if current_term:
        exams = Exam.objects.filter(tenant=tenant, term=current_term)
        results = ExamResult.objects.filter(exam__in=exams)
        if results.exists():
            overall = _compute_subject_stats(results, education_type, max_scale)
            overall_average = overall['average_percentage']
            pass_rate = overall['pass_rate']
            grade_distribution = overall['grade_distribution']

            # Best/worst subject
            subject_perf = []
            for subj_id in results.values_list('subject_id', flat=True).distinct():
                subj_results = results.filter(subject_id=subj_id)
                subj = subj_results.first().subject
                stats = _compute_subject_stats(subj_results, education_type, max_scale)
                if stats['average'] is not None:
                    subject_perf.append({
                        'name': subj.name,
                        'average': stats['average_percentage'],
                        'pass_rate': stats['pass_rate'],
                    })
            if subject_perf:
                subject_perf.sort(key=lambda x: x['average'], reverse=True)
                best_subject = subject_perf[0]
                worst_subject = subject_perf[-1]

    # ── Attendance ──
    attendance_rate = None
    at_risk_count = 0
    if current_term:
        sessions = AttendanceSession.objects.filter(tenant=tenant, term=current_term)
        total_records = AttendanceRecord.objects.filter(session__in=sessions)
        if total_records.exists():
            present_count = total_records.filter(status__in=['present', 'late']).count()
            attendance_rate = round((present_count / total_records.count()) * 100, 1)

        # At-risk: absent > 20% in last 30 days
        recent_sessions = sessions.filter(
            date__gte=timezone.now().date() - timezone.timedelta(days=30)
        )
        recent_records = AttendanceRecord.objects.filter(
            session__in=recent_sessions, status='absent'
        ).values('student').annotate(absent_count=Count('id'))
        recent_session_count = recent_sessions.count()
        if recent_session_count > 0:
            threshold = recent_session_count * 0.2
            at_risk_count = recent_records.filter(absent_count__gt=threshold).count()

    # ── Curriculum ──
    total_modules = CurriculumModule.objects.filter(tenant=tenant).count()
    total_lessons = CurriculumLesson.objects.filter(module__tenant=tenant).count()
    completed_lessons = CurriculumLesson.objects.filter(
        module__tenant=tenant, is_completed=True
    ).count()
    curriculum_coverage = round((completed_lessons / total_lessons) * 100) if total_lessons > 0 else 0

    # Teachers with 0 modules created
    teachers_with_modules = set(
        CurriculumModule.objects.filter(
            tenant=tenant, created_by__isnull=False
        ).values_list('created_by_id', flat=True)
    )
    all_teacher_ids = set(teachers_qs.values_list('id', flat=True))
    teachers_no_modules = len(all_teacher_ids - teachers_with_modules)

    # ── Marks ──
    mark_fill_rate = None
    pending_teachers = []
    if current_term:
        windows = MarkEntryWindow.objects.filter(tenant=tenant, sequence__term=current_term)
        for window in windows:
            if window.is_open:
                # Count teachers who haven't filled for this sequence
                assigned_teachers = TeachingAssignment.objects.filter(
                    teacher__tenant=tenant,
                    academic_year=active_year,
                ).values_list('teacher_id', flat=True).distinct()
                filled_teachers = ExamResult.objects.filter(
                    exam__tenant=tenant, sequence=window.sequence
                ).values('exam__teacher').distinct().count() if hasattr(ExamResult, 'exam__teacher') else 0
                # Simplified: just track if any results exist for this sequence
                has_results = ExamResult.objects.filter(
                    exam__tenant=tenant, sequence=window.sequence
                ).exists()
                if not has_results and assigned_teachers:
                    pending_teachers.append({
                        'sequence': str(window.sequence_id),
                        'is_open': window.is_open,
                    })

        total_windows = windows.count()
        open_windows = windows.filter(is_open=True).count()
        closed_windows = total_windows - open_windows
        if total_windows > 0:
            mark_fill_rate = round((closed_windows / total_windows) * 100, 1) if total_windows > 0 else 0

    # ── Alerts ──
    alerts = []
    if teachers_no_modules > 0:
        alerts.append({
            'type': 'curriculum',
            'severity': 'warning',
            'message': f'{teachers_no_modules} teacher(s) have not created any curriculum modules.',
        })
    if at_risk_count > 0:
        alerts.append({
            'type': 'attendance',
            'severity': 'critical',
            'message': f'{at_risk_count} student(s) are at risk of chronic absenteeism.',
        })
    if pending_teachers:
        alerts.append({
            'type': 'marks',
            'severity': 'warning',
            'message': f'{len(pending_teachers)} sequence(s) are open but have no marks submitted.',
        })
    if attendance_rate is not None and attendance_rate < 80:
        alerts.append({
            'type': 'attendance',
            'severity': 'critical',
            'message': f'School attendance rate is {attendance_rate}% (below 80% threshold).',
        })

    return Response({
        'students': {
            'total': total_students,
            'active': active_students,
            'new_this_month': new_this_month,
        },
        'teachers': {
            'total': total_teachers,
            'active_assignments': active_assignments,
            'without_modules': teachers_no_modules,
        },
        'academics': {
            'current_term': current_term.name if current_term else None,
            'academic_year': active_year.name if active_year else None,
            'overall_average': overall_average,
            'pass_rate': pass_rate,
            'best_subject': best_subject,
            'worst_subject': worst_subject,
            'grade_distribution': grade_distribution,
        },
        'attendance': {
            'rate': attendance_rate,
            'at_risk_count': at_risk_count,
        },
        'curriculum': {
            'total_modules': total_modules,
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'coverage_pct': curriculum_coverage,
            'teachers_without_modules': teachers_no_modules,
        },
        'marks': {
            'fill_rate': mark_fill_rate,
            'pending_sequences': len(pending_teachers),
        },
        'alerts': alerts,
    })
