from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from django.http import HttpResponse
import csv

from apps.government.models import (
    Inspection, InspectionFinding, CorrectiveAction, InspectionDocument, InspectionSchedule
)
from apps.government.serializers import (
    InspectionSerializer, InspectionListSerializer, InspectionFindingSerializer,
    InspectionFindingCreateSerializer, CorrectiveActionSerializer,
    CorrectiveActionCreateSerializer, CorrectiveActionReviewSerializer,
    InspectionDocumentSerializer, InspectionDocumentUploadSerializer,
    InspectionScheduleSerializer, InspectionStartSerializer,
    InspectionCompleteSerializer, InspectionFinalizeReportSerializer
)
from apps.government.permissions import IsGovernmentOfficial
from apps.authentication.permissions import IsSchoolAdmin
from apps.tenants.models import Tenant
from apps.students.models import Student
from apps.attendance.models import AttendanceSession, AttendanceRecord
from apps.assessments.models import Exam, ExamResult
from apps.logbook.models import CurriculumLesson, CurriculumModule, LogbookEntry


class IsInspectorOrReadOnly(IsGovernmentOfficial):
    """
    Allow inspectors full access, school admins read-only access to their school's inspections.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Government officials have full access
        if getattr(request.user, 'is_government_official', False):
            return True
        # School admins can view their school's inspections
        if getattr(request.user, 'is_school_admin', False):
            return request.method in ['GET', 'HEAD', 'OPTIONS']
        return False

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'is_government_official', False):
            return True
        if getattr(request.user, 'is_school_admin', False):
            # School admin can only access their own school's inspections
            return obj.tenant_id == request.tenant_id
        return False


class InspectionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for MINESEC inspections.
    """
    queryset = Inspection.objects.select_related(
        'tenant', 'lead_inspector', 'created_by', 'report_finalized_by'
    ).prefetch_related('inspectors', 'findings', 'documents')
    permission_classes = [IsInspectorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tenant__school_name', 'scope_notes', 'summary']
    ordering_fields = ['scheduled_date', 'created_at', 'status', 'overall_score']
    ordering = ['-scheduled_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return InspectionListSerializer
        return InspectionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Government officials see all (or region-filtered)
        if getattr(user, 'is_government_official', False):
            if user.government_region:
                qs = qs.filter(tenant__region__icontains=user.government_region)
            return qs

        # School admins see only their school's inspections
        if getattr(user, 'is_school_admin', False):
            return qs.filter(tenant_id=user.tenant_id)

        return Inspection.objects.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsGovernmentOfficial])
    def start(self, request, pk=None):
        """Mark inspection as in progress"""
        inspection = self.get_object()
        if inspection.status != Inspection.Status.SCHEDULED:
            return Response(
                {'detail': 'Only scheduled inspections can be started.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = InspectionStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inspection.status = Inspection.Status.IN_PROGRESS
        inspection.actual_start = serializer.validated_data.get('actual_start', timezone.now())
        inspection.save(update_fields=['status', 'actual_start', 'updated_at'])

        return Response(InspectionSerializer(inspection, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], permission_classes=[IsGovernmentOfficial])
    def complete(self, request, pk=None):
        """Mark inspection as completed"""
        inspection = self.get_object()
        if inspection.status != Inspection.Status.IN_PROGRESS:
            return Response(
                {'detail': 'Only in-progress inspections can be completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = InspectionCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inspection.status = Inspection.Status.COMPLETED
        inspection.actual_end = serializer.validated_data.get('actual_end', timezone.now())
        if 'overall_score' in serializer.validated_data:
            inspection.overall_score = serializer.validated_data['overall_score']
        if 'outcome' in serializer.validated_data:
            inspection.outcome = serializer.validated_data['outcome']
        if 'summary' in serializer.validated_data:
            inspection.summary = serializer.validated_data['summary']
        if 'recommendations' in serializer.validated_data:
            inspection.recommendations = serializer.validated_data['recommendations']
        inspection.save(update_fields=[
            'status', 'actual_end', 'overall_score', 'outcome',
            'summary', 'recommendations', 'updated_at'
        ])

        return Response(InspectionSerializer(inspection, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], permission_classes=[IsGovernmentOfficial])
    def finalize_report(self, request, pk=None):
        """Finalize the inspection report"""
        inspection = self.get_object()
        if inspection.status not in [Inspection.Status.COMPLETED, Inspection.Status.REPORT_DRAFT]:
            return Response(
                {'detail': 'Inspection must be completed before finalizing report.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = InspectionFinalizeReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inspection.report_file = serializer.validated_data['report_file']
        inspection.status = Inspection.Status.REPORT_FINALIZED
        inspection.report_finalized_at = timezone.now()
        inspection.report_finalized_by = request.user
        inspection.save(update_fields=['report_file', 'status', 'report_finalized_at', 'report_finalized_by', 'updated_at'])

        return Response(InspectionSerializer(inspection, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], permission_classes=[IsGovernmentOfficial])
    def close(self, request, pk=None):
        """Close the inspection (all actions verified)"""
        inspection = self.get_object()
        unresolved = inspection.findings.filter(is_resolved=False).count()
        if unresolved > 0:
            return Response(
                {'detail': f'{unresolved} finding(s) still unresolved. Resolve all findings before closing.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        inspection.status = Inspection.Status.CLOSED
        inspection.save(update_fields=['status', 'updated_at'])

        return Response(InspectionSerializer(inspection, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['get'], permission_classes=[IsInspectorOrReadOnly])
    def export_report(self, request, pk=None):
        """Export inspection report as CSV"""
        import csv
        from django.http import HttpResponse

        inspection = self.get_object()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="inspection_report_{inspection.tenant.school_code}_{inspection.scheduled_date}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Field', 'Value'])

        writer.writerow(['School', inspection.tenant.school_name])
        writer.writerow(['School Code', inspection.tenant.school_code])
        writer.writerow(['Inspection Type', inspection.get_inspection_type_display()])
        writer.writerow(['Status', inspection.get_status_display()])
        writer.writerow(['Outcome', inspection.get_outcome_display()])
        writer.writerow(['Scheduled Date', inspection.scheduled_date])
        writer.writerow(['Scheduled Time', inspection.scheduled_time or 'N/A'])
        writer.writerow(['Actual Start', inspection.actual_start or 'N/A'])
        writer.writerow(['Actual End', inspection.actual_end or 'N/A'])
        writer.writerow(['Lead Inspector', inspection.lead_inspector.get_full_name() if inspection.lead_inspector else 'N/A'])
        writer.writerow(['Overall Score', inspection.overall_score or 'N/A'])
        writer.writerow(['Scope', inspection.scope_notes or 'N/A'])
        writer.writerow(['Summary', inspection.summary or 'N/A'])
        writer.writerow(['Recommendations', inspection.recommendations or 'N/A'])
        writer.writerow([], ['Findings'])
        writer.writerow(['Category', 'Severity', 'Title', 'Description', 'Reference', 'Deadline', 'Responsible', 'Resolved'])

        for finding in inspection.findings.all().order_by('severity', 'category'):
            writer.writerow([
                finding.get_category_display(),
                finding.get_severity_display(),
                finding.title,
                finding.description,
                finding.reference_standard or 'N/A',
                finding.deadline or 'N/A',
                finding.responsible_party or 'N/A',
                'Yes' if finding.is_resolved else 'No'
            ])

        return response


class InspectionFindingViewSet(viewsets.ModelViewSet):
    """
    API endpoint for inspection findings.
    """
    queryset = InspectionFinding.objects.select_related(
        'inspection', 'inspection__tenant', 'created_by', 'resolved_by'
    ).prefetch_related('corrective_actions')
    permission_classes = [IsInspectorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'reference_standard']
    ordering_fields = ['severity', 'category', 'created_at', 'deadline']
    ordering = ['severity', 'category', 'created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InspectionFindingCreateSerializer
        return InspectionFindingSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if getattr(user, 'is_government_official', False):
            if user.government_region:
                qs = qs.filter(inspection__tenant__region__icontains=user.government_region)
            return qs

        if getattr(user, 'is_school_admin', False):
            return qs.filter(inspection__tenant_id=user.tenant_id)

        return InspectionFinding.objects.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsInspectorOrReadOnly])
    def add_corrective_action(self, request, pk=None):
        """School adds a corrective action"""
        finding = self.get_object()

        # Only school admin of the inspected school can add corrective actions
        if not (getattr(request.user, 'is_school_admin', False) and
                finding.inspection.tenant_id == request.tenant_id):
            return Response(
                {'detail': 'Only the inspected school can submit corrective actions.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if finding.is_resolved:
            return Response(
                {'detail': 'This finding is already resolved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CorrectiveActionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.save(submitted_by=request.user, submitted_at=timezone.now())
        finding.is_resolved = False  # Re-open if was resolved
        finding.save(update_fields=['is_resolved', 'updated_at'])

        return Response(CorrectiveActionSerializer(action, context=self.get_serializer_context()).data,
                       status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsGovernmentOfficial])
    def resolve(self, request, pk=None):
        """Inspector marks finding as resolved"""
        finding = self.get_object()
        finding.is_resolved = True
        finding.resolved_at = timezone.now()
        finding.resolved_by = request.user
        finding.resolution_notes = request.data.get('resolution_notes', '')
        finding.save(update_fields=['is_resolved', 'resolved_at', 'resolved_by', 'resolution_notes', 'updated_at'])

        return Response(InspectionFindingSerializer(finding, context=self.get_serializer_context()).data)


class CorrectiveActionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for corrective actions.
    """
    queryset = CorrectiveAction.objects.select_related(
        'finding', 'finding__inspection', 'finding__inspection__tenant',
        'submitted_by', 'reviewed_by'
    )
    permission_classes = [IsInspectorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['action_taken']
    ordering_fields = ['status', 'submitted_at', 'reviewed_at']
    ordering = ['-submitted_at']

    def get_serializer_class(self):
        if self.action in ['create']:
            return CorrectiveActionCreateSerializer
        if self.action in ['update', 'partial_update'] and getattr(self.request.user, 'is_government_official', False):
            return CorrectiveActionReviewSerializer
        return CorrectiveActionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if getattr(user, 'is_government_official', False):
            if user.government_region:
                qs = qs.filter(finding__inspection__tenant__region__icontains=user.government_region)
            return qs

        if getattr(user, 'is_school_admin', False):
            return qs.filter(finding__inspection__tenant_id=user.tenant_id)

        return CorrectiveAction.objects.none()

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user, submitted_at=timezone.now())

    @action(detail=True, methods=['post'], permission_classes=[IsGovernmentOfficial])
    def review(self, request, pk=None):
        """Inspector reviews a corrective action"""
        action = self.get_object()

        serializer = CorrectiveActionReviewSerializer(action, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        action.status = serializer.validated_data.get('status', action.status)
        action.reviewed_by = request.user
        action.reviewed_at = timezone.now()
        action.review_notes = serializer.validated_data.get('review_notes', action.review_notes)
        action.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'])

        # If approved, check if all actions for this finding are approved
        if action.status == CorrectiveAction.Status.APPROVED:
            finding = action.finding
            all_approved = finding.corrective_actions.exclude(
                status__in=[CorrectiveAction.Status.APPROVED, CorrectiveAction.Status.VERIFIED]
            ).count() == 0
            if all_approved:
                finding.is_resolved = True
                finding.resolved_at = timezone.now()
                finding.resolved_by = request.user
                finding.save(update_fields=['is_resolved', 'resolved_at', 'resolved_by', 'updated_at'])

        return Response(CorrectiveActionSerializer(action, context=self.get_serializer_context()).data)


class InspectionDocumentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for inspection documents.
    """
    queryset = InspectionDocument.objects.select_related('inspection', 'inspection__tenant', 'uploaded_by')
    permission_classes = [IsInspectorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['document_type', 'created_at']
    ordering = ['document_type', 'title']

    def get_serializer_class(self):
        if self.action in ['create']:
            return InspectionDocumentUploadSerializer
        return InspectionDocumentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if getattr(user, 'is_government_official', False):
            if user.government_region:
                qs = qs.filter(inspection__tenant__region__icontains=user.government_region)
            # Inspectors see all documents for their inspections
            return qs

        if getattr(user, 'is_school_admin', False):
            # School admins see non-confidential documents for their school
            return qs.filter(inspection__tenant_id=user.tenant_id, is_confidential=False)

        return InspectionDocument.objects.none()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class InspectionScheduleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for inspection schedules.
    """
    queryset = InspectionSchedule.objects.select_related('tenant')
    permission_classes = [IsGovernmentOfficial]
    serializer_class = InspectionScheduleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.government_region:
            qs = qs.filter(tenant__region__icontains=user.government_region)
        return qs

    @action(detail=True, methods=['post'])
    def calculate_next_due(self, request, pk=None):
        """Calculate next due date based on frequency"""
        schedule = self.get_object()
        from datetime import date
        from dateutil.relativedelta import relativedelta

        base_date = schedule.last_inspection_date or date.today()

        if schedule.frequency == InspectionSchedule.Frequency.ANNUAL:
            next_due = base_date + relativedelta(years=1)
        elif schedule.frequency == InspectionSchedule.Frequency.BIENNIAL:
            next_due = base_date + relativedelta(years=2)
        elif schedule.frequency == InspectionSchedule.Frequency.TERMLY:
            next_due = base_date + relativedelta(months=4)
        else:
            next_due = None

        if next_due:
            schedule.next_due_date = next_due
            schedule.save(update_fields=['next_due_date', 'updated_at'])

        return Response(InspectionScheduleSerializer(schedule).data)


class InspectorDashboardAPIView(APIView):
    """
    Dashboard for inspectors - overview of inspections, upcoming, stats.
    """
    permission_classes = [IsAuthenticated, IsGovernmentOfficial]

    def get(self, request):
        user = request.user
        now = timezone.now()
        today = now.date()

        # Base queryset
        inspections = Inspection.objects.select_related('tenant', 'lead_inspector').prefetch_related('findings')

        if user.government_region:
            inspections = inspections.filter(tenant__region__icontains=user.government_region)

        # Upcoming inspections (next 30 days)
        upcoming = inspections.filter(
            status=Inspection.Status.SCHEDULED,
            scheduled_date__gte=today,
            scheduled_date__lte=today + timedelta(days=30)
        ).order_by('scheduled_date')[:10]

        # In-progress inspections
        in_progress = inspections.filter(status=Inspection.Status.IN_PROGRESS).order_by('actual_start')[:10]

        # Recent completed (last 30 days)
        recent_completed = inspections.filter(
            status__in=[Inspection.Status.COMPLETED, Inspection.Status.REPORT_DRAFT,
                       Inspection.Status.REPORT_FINALIZED, Inspection.Status.CLOSED],
            actual_end__gte=now - timedelta(days=30)
        ).order_by('-actual_end')[:10]

        # Overdue findings (deadline passed, not resolved)
        overdue_findings = InspectionFinding.objects.filter(
            inspection__in=inspections,
            deadline__lt=today,
            is_resolved=False
        ).select_related('inspection', 'inspection__tenant').order_by('deadline')[:10]

        # Pending corrective actions (submitted, not reviewed)
        pending_actions = CorrectiveAction.objects.filter(
            finding__inspection__in=inspections,
            status=CorrectiveAction.Status.SUBMITTED
        ).select_related('finding', 'finding__inspection', 'finding__inspection__tenant', 'submitted_by').order_by('submitted_at')[:10]

        # Stats
        total_inspections = inspections.count()
        this_year = inspections.filter(scheduled_date__year=today.year).count()
        completed_this_year = inspections.filter(
            status__in=[Inspection.Status.COMPLETED, Inspection.Status.REPORT_DRAFT,
                       Inspection.Status.REPORT_FINALIZED, Inspection.Status.CLOSED],
            scheduled_date__year=today.year
        ).count()

        # Compliance scores
        avg_score = inspections.filter(
            overall_score__isnull=False
        ).aggregate(avg=Avg('overall_score'))['avg']

        # Findings by severity
        severity_counts = {}
        for severity in InspectionFinding.Severity.values:
            severity_counts[severity] = InspectionFinding.objects.filter(
                inspection__in=inspections, severity=severity
            ).count()

        # Findings by category
        category_counts = {}
        for category in InspectionFinding.Category.values:
            category_counts[category] = InspectionFinding.objects.filter(
                inspection__in=inspections, category=category
            ).count()

        return Response({
            'upcoming': InspectionListSerializer(upcoming, many=True, context={'request': request}).data,
            'in_progress': InspectionListSerializer(in_progress, many=True, context={'request': request}).data,
            'recent_completed': InspectionListSerializer(recent_completed, many=True, context={'request': request}).data,
            'overdue_findings': InspectionFindingSerializer(overdue_findings, many=True, context={'request': request}).data,
            'pending_actions': CorrectiveActionSerializer(pending_actions, many=True, context={'request': request}).data,
            'stats': {
                'total_inspections': total_inspections,
                'this_year': this_year,
                'completed_this_year': completed_this_year,
                'completion_rate': round((completed_this_year / this_year * 100), 1) if this_year > 0 else 0,
                'average_score': round(float(avg_score), 1) if avg_score else None,
                'severity_breakdown': severity_counts,
                'category_breakdown': category_counts,
            }
})


# Original government views for backward compatibility
from rest_framework.decorators import api_view, permission_classes
from django.http import HttpResponse
import csv
from datetime import datetime
from apps.logbook.models import LogbookEntry
from apps.attendance.models import AttendanceSession, AttendanceRecord
from apps.assessments.models import Exam, ExamResult
from apps.logbook.models import CurriculumLesson


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