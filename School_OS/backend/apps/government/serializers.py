from rest_framework import serializers
from apps.government.models import (
    Inspection, InspectionFinding, CorrectiveAction, InspectionDocument, InspectionSchedule
)
from apps.authentication.models import User
from apps.tenants.models import Tenant


class InspectorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone', 'government_region', 'is_government_official']


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'school_name', 'slug', 'region', 'division', 'phone', 'email', 'status']


class InspectionDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)

    class Meta:
        model = InspectionDocument
        fields = ['id', 'document_type', 'title', 'description', 'file', 'uploaded_by', 'uploaded_by_name', 'is_confidential', 'created_at']
        read_only_fields = ['id', 'uploaded_by', 'uploaded_by_name', 'created_at']


class CorrectiveActionSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    finding_title = serializers.CharField(source='finding.title', read_only=True)

    class Meta:
        model = CorrectiveAction
        fields = [
            'id', 'finding', 'finding_title', 'action_taken', 'evidence_files', 'status',
            'submitted_by', 'submitted_by_name', 'submitted_at',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'submitted_by', 'submitted_by_name', 'submitted_at',
                           'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
                           'created_at', 'updated_at']


class InspectionFindingSerializer(serializers.ModelSerializer):
    corrective_actions = CorrectiveActionSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = InspectionFinding
        fields = [
            'id', 'category', 'category_display', 'severity', 'severity_display',
            'title', 'description', 'evidence', 'reference_standard',
            'recommended_action', 'deadline', 'responsible_party',
            'is_resolved', 'resolved_at', 'resolved_by', 'resolved_by_name', 'resolution_notes',
            'corrective_actions', 'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'is_resolved', 'resolved_at', 'resolved_by', 'resolution_notes',
                           'corrective_actions', 'created_at', 'updated_at', 'created_by', 'created_by_name']


class InspectionSerializer(serializers.ModelSerializer):
    lead_inspector_detail = InspectorSerializer(source='lead_inspector', read_only=True)
    inspectors_detail = InspectorSerializer(source='inspectors', many=True, read_only=True)
    school = SchoolSerializer(source='tenant', read_only=True)
    findings = InspectionFindingSerializer(many=True, read_only=True)
    documents = InspectionDocumentSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    report_finalized_by_name = serializers.CharField(source='report_finalized_by.get_full_name', read_only=True)
    inspection_type_display = serializers.CharField(source='get_inspection_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    outcome_display = serializers.CharField(source='get_outcome_display', read_only=True)
    findings_count = serializers.SerializerMethodField()
    critical_findings_count = serializers.SerializerMethodField()
    major_findings_count = serializers.SerializerMethodField()
    resolved_findings_count = serializers.SerializerMethodField()

    class Meta:
        model = Inspection
        fields = [
            'id', 'inspection_type', 'inspection_type_display', 'status', 'status_display',
            'outcome', 'outcome_display', 'school', 'scheduled_date', 'scheduled_time',
            'actual_start', 'actual_end', 'lead_inspector', 'lead_inspector_detail',
            'inspectors', 'inspectors_detail', 'scope_notes', 'focus_areas',
            'overall_score', 'summary', 'recommendations', 'report_file',
            'report_finalized_at', 'report_finalized_by', 'report_finalized_by_name',
            'findings', 'documents', 'findings_count', 'critical_findings_count',
            'major_findings_count', 'resolved_findings_count',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'actual_start', 'actual_end', 'overall_score',
                           'report_finalized_at', 'report_finalized_by', 'report_finalized_by_name',
                           'findings', 'documents', 'findings_count', 'critical_findings_count',
                           'major_findings_count', 'resolved_findings_count',
                           'created_at', 'updated_at', 'created_by', 'created_by_name']

    def get_findings_count(self, obj):
        return obj.findings.count()

    def get_critical_findings_count(self, obj):
        return obj.findings.filter(severity='critical').count()

    def get_major_findings_count(self, obj):
        return obj.findings.filter(severity='major').count()

    def get_resolved_findings_count(self, obj):
        return obj.findings.filter(is_resolved=True).count()


class InspectionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    school = SchoolSerializer(source='tenant', read_only=True)
    lead_inspector_name = serializers.CharField(source='lead_inspector.get_full_name', read_only=True)
    inspection_type_display = serializers.CharField(source='get_inspection_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    outcome_display = serializers.CharField(source='get_outcome_display', read_only=True)
    findings_count = serializers.SerializerMethodField()
    critical_findings_count = serializers.SerializerMethodField()

    class Meta:
        model = Inspection
        fields = [
            'id', 'inspection_type', 'inspection_type_display', 'status', 'status_display',
            'outcome', 'outcome_display', 'school', 'scheduled_date', 'scheduled_time',
            'lead_inspector', 'lead_inspector_name', 'overall_score',
            'findings_count', 'critical_findings_count',
            'created_at', 'updated_at'
        ]

    def get_findings_count(self, obj):
        return obj.findings.count()

    def get_critical_findings_count(self, obj):
        return obj.findings.filter(severity='critical').count()


class InspectionFindingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionFinding
        fields = [
            'inspection', 'category', 'severity', 'title', 'description',
            'evidence', 'reference_standard', 'recommended_action',
            'deadline', 'responsible_party'
        ]


class CorrectiveActionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorrectiveAction
        fields = ['finding', 'action_taken', 'evidence_files']


class CorrectiveActionReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorrectiveAction
        fields = ['status', 'review_notes']


class InspectionDocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionDocument
        fields = ['inspection', 'document_type', 'title', 'description', 'file', 'is_confidential']


class InspectionScheduleSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(source='tenant', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)

    class Meta:
        model = InspectionSchedule
        fields = [
            'id', 'school', 'frequency', 'frequency_display',
            'last_inspection_date', 'next_due_date', 'preferred_months',
            'notes', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_inspection_date', 'next_due_date', 'created_at', 'updated_at']


class InspectionStartSerializer(serializers.Serializer):
    """Serializer for starting an inspection"""
    actual_start = serializers.DateTimeField(required=False)


class InspectionCompleteSerializer(serializers.Serializer):
    """Serializer for completing an inspection"""
    actual_end = serializers.DateTimeField(required=False)
    overall_score = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    outcome = serializers.ChoiceField(choices=Inspection.Outcome.choices, required=False)
    summary = serializers.CharField(required=False)
    recommendations = serializers.CharField(required=False)


class InspectionFinalizeReportSerializer(serializers.Serializer):
    """Serializer for finalizing inspection report"""
    report_file = serializers.FileField()