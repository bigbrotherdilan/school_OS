from django.db import models
from django.conf import settings
from apps.tenants.models import Tenant
from apps.authentication.models import User


class Inspection(models.Model):
    """
    MINESEC inspection of a school.
    """
    class InspectionType(models.TextChoices):
        ROUTINE = 'routine', 'Routine Inspection'
        FOLLOW_UP = 'follow_up', 'Follow-up Inspection'
        COMPLAINT = 'complaint', 'Complaint-Based Inspection'
        ACCREDITATION = 'accreditation', 'Accreditation Review'
        SPECIAL = 'special', 'Special Audit'

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        REPORT_DRAFT = 'report_draft', 'Report Draft'
        REPORT_FINALIZED = 'report_finalized', 'Report Finalized'
        CLOSED = 'closed', 'Closed'

    class Outcome(models.TextChoices):
        COMPLIANT = 'compliant', 'Compliant'
        MINOR_ISSUES = 'minor_issues', 'Minor Issues'
        MAJOR_ISSUES = 'major_issues', 'Major Issues'
        CRITICAL = 'critical', 'Critical Non-Compliance'
        PENDING = 'pending', 'Pending Review'

    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name='inspections',
        help_text="School being inspected"
    )
    inspection_type = models.CharField(
        max_length=20, choices=InspectionType.choices, default=InspectionType.ROUTINE
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    outcome = models.CharField(
        max_length=20, choices=Outcome.choices, default=Outcome.PENDING, blank=True
    )

    # Scheduling
    scheduled_date = models.DateField()
    scheduled_time = models.TimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    # Inspectors
    lead_inspector = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='led_inspections', limit_choices_to={'is_government_official': True}
    )
    inspectors = models.ManyToManyField(
        User, related_name='inspections', blank=True,
        limit_choices_to={'is_government_official': True}
    )

    # Scope
    scope_notes = models.TextField(blank=True, help_text="Areas to be inspected")
    focus_areas = models.JSONField(default=list, blank=True, help_text="Specific focus areas (e.g., ['attendance', 'curriculum', 'finance'])")

    # Results
    overall_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Overall compliance score (0-100)"
    )
    summary = models.TextField(blank=True, help_text="Executive summary of findings")
    recommendations = models.TextField(blank=True, help_text="Key recommendations")

    # Report
    report_file = models.FileField(upload_to='inspection_reports/', null=True, blank=True)
    report_finalized_at = models.DateTimeField(null=True, blank=True)
    report_finalized_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='finalized_inspection_reports'
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_inspections'
    )

    class Meta:
        db_table = 'government_inspections'
        ordering = ['-scheduled_date', '-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['lead_inspector', 'status']),
            models.Index(fields=['scheduled_date']),
        ]

    def __str__(self):
        return f"{self.get_inspection_type_display()} - {self.tenant.school_name} ({self.scheduled_date})"


class InspectionFinding(models.Model):
    """
    Individual finding within an inspection.
    """
    class Severity(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        MAJOR = 'major', 'Major'
        MINOR = 'minor', 'Minor'
        OBSERVATION = 'observation', 'Observation'
        GOOD_PRACTICE = 'good_practice', 'Good Practice'

    class Category(models.TextChoices):
        GOVERNANCE = 'governance', 'Governance & Leadership'
        CURRICULUM = 'curriculum', 'Curriculum & Instruction'
        TEACHING = 'teaching', 'Teaching Quality'
        LEARNING = 'learning', 'Learning Outcomes'
        ASSESSMENT = 'assessment', 'Assessment & Examinations'
        ATTENDANCE = 'attendance', 'Attendance & Retention'
        SAFEGUARDING = 'safeguarding', 'Safeguarding & Welfare'
        INFRASTRUCTURE = 'infrastructure', 'Infrastructure & Resources'
        FINANCE = 'finance', 'Financial Management'
        STAFFING = 'staffing', 'Staffing & Professional Development'
        DATA = 'data', 'Data & Reporting'
        COMPLIANCE = 'compliance', 'Statutory Compliance'

    inspection = models.ForeignKey(
        Inspection, on_delete=models.CASCADE, related_name='findings'
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    severity = models.CharField(max_length=20, choices=Severity.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(help_text="Detailed description of the finding")
    evidence = models.TextField(blank=True, help_text="Evidence supporting the finding")
    reference_standard = models.CharField(
        max_length=255, blank=True,
        help_text="Regulatory reference (e.g., 'MINESEC Circular 2023/045', 'Education Law Art. 12')"
    )

    # Remediation
    recommended_action = models.TextField(blank=True, help_text="Recommended corrective action")
    deadline = models.DateField(null=True, blank=True, help_text="Deadline for corrective action")
    responsible_party = models.CharField(
        max_length=100, blank=True,
        help_text="Who is responsible (e.g., 'Principal', 'Bursar', 'Board of Governors')"
    )

    # Status tracking
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_findings'
    )
    resolution_notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_findings'
    )

    class Meta:
        db_table = 'government_inspection_findings'
        ordering = ['severity', 'category', 'created_at']

    def __str__(self):
        return f"[{self.get_severity_display()}] {self.title}"


class CorrectiveAction(models.Model):
    """
    Corrective action taken in response to a finding.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        SUBMITTED = 'submitted', 'Submitted for Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected - More Work Needed'
        VERIFIED = 'verified', 'Verified & Closed'

    finding = models.ForeignKey(
        InspectionFinding, on_delete=models.CASCADE, related_name='corrective_actions'
    )
    action_taken = models.TextField(help_text="Description of corrective action taken")
    evidence_files = models.JSONField(default=list, blank=True, help_text="List of uploaded evidence file URLs")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # School response
    submitted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='submitted_corrective_actions',
        help_text="School staff who submitted the action"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    # Inspector review
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_corrective_actions',
        limit_choices_to={'is_government_official': True}
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'government_corrective_actions'
        ordering = ['-created_at']

    def __str__(self):
        return f"Action for: {self.finding.title[:50]}..."


class InspectionDocument(models.Model):
    """
    Documents related to an inspection (school policies, records, evidence, etc.)
    """
    class DocumentType(models.TextChoices):
        SCHOOL_POLICY = 'school_policy', 'School Policy'
        CURRICULUM_PLAN = 'curriculum_plan', 'Curriculum Plan / Scheme of Work'
        TIMETABLE = 'timetable', 'Class Timetables'
        STAFF_RECORDS = 'staff_records', 'Staff Records / Qualifications'
        STUDENT_RECORDS = 'student_records', 'Student Records / Admissions'
        ATTENDANCE_REGISTERS = 'attendance_registers', 'Attendance Registers'
        ASSESSMENT_RECORDS = 'assessment_records', 'Assessment / Exam Records'
        FINANCIAL_RECORDS = 'financial_records', 'Financial Records'
        INFRASTRUCTURE = 'infrastructure', 'Infrastructure / Safety Certificates'
        GOVERNANCE = 'governance', 'Governance / Board Minutes'
        INSPECTION_EVIDENCE = 'inspection_evidence', 'Inspection Evidence (photos, notes)'
        CORRESPONDENCE = 'correspondence', 'Official Correspondence'
        OTHER = 'other', 'Other'

    inspection = models.ForeignKey(
        Inspection, on_delete=models.CASCADE, related_name='documents'
    )
    document_type = models.CharField(max_length=30, choices=DocumentType.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='inspection_documents/')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_inspection_documents'
    )
    is_confidential = models.BooleanField(default=False, help_text="Restrict to inspectors only")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'government_inspection_documents'
        ordering = ['document_type', 'title']

    def __str__(self):
        return f"{self.get_document_type_display()}: {self.title}"


class InspectionSchedule(models.Model):
    """
    Recurring inspection schedule for a school.
    """
    class Frequency(models.TextChoices):
        ANNUAL = 'annual', 'Annual'
        BIENNIAL = 'biennial', 'Biennial'
        TERMLY = 'termly', 'Per Term'
        AD_HOC = 'ad_hoc', 'Ad Hoc Only'

    tenant = models.OneToOneField(
        Tenant, on_delete=models.CASCADE, related_name='inspection_schedule'
    )
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.ANNUAL)
    last_inspection_date = models.DateField(null=True, blank=True)
    next_due_date = models.DateField(null=True, blank=True)
    preferred_months = models.JSONField(default=list, blank=True, help_text="Preferred months for inspection (1-12)")
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'government_inspection_schedules'

    def __str__(self):
        return f"Inspection Schedule for {self.tenant.school_name} ({self.get_frequency_display()})"