import uuid
from django.db import models


def report_card_upload_path(instance, filename):
    return f'report_cards/{instance.tenant.id}/{instance.student.id}/{instance.term.id}_{filename}'


class ReportCardTemplate(models.Model):
    """
    Template for report card visual customization.
    Stores color scheme, typography, and layout preferences.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='report_card_templates')
    name = models.CharField(max_length=100, default='Default Template')
    is_active = models.BooleanField(default=True)

    # Color scheme
    primary_color = models.CharField(max_length=7, default='#000000', help_text="Main accent color (hex)")
    secondary_color = models.CharField(max_length=7, default='#333333', help_text="Secondary text color (hex)")
    accent_color = models.CharField(max_length=7, default='#F2B01E', help_text="Gold/highlight accent (hex)")

    # Full visual editor config
    style_config = models.JSONField(default=dict, blank=True, help_text="Full visual style configuration")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'report_card_templates'
        ordering = ['-is_active', 'name']
        verbose_name = 'Report Card Template'
        verbose_name_plural = 'Report Card Templates'

    def __str__(self):
        return f"{self.name} ({self.tenant.school_name})"


class StudentReportCard(models.Model):
    """
    A generated PDF report card for a single student for a specific term.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='student_report_cards')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='report_cards')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='student_report_cards')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='student_report_cards')
    generated_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to=report_card_upload_path, blank=True, null=True)
    data_snapshot = models.JSONField(default=dict, blank=True, help_text="Scores and grades at generation time")
    is_archived = models.BooleanField(default=False)

    class Meta:
        db_table = 'student_report_cards'
        unique_together = ['student', 'term', 'academic_year']
        ordering = ['-generated_at']

    def __str__(self):
        return f"Report Card: {self.student.full_name} - {self.term.name} ({self.academic_year.name})"


class SchoolPerformanceReport(models.Model):
    """
    An aggregated school-level performance report for a given period.
    """
    class ReportType(models.TextChoices):
        ACADEMIC = 'academic', 'Academic Performance'
        FINANCIAL = 'financial', 'Financial Summary'
        ATTENDANCE = 'attendance', 'Attendance Report'
        COMPLIANCE = 'compliance', 'Compliance & Audit'
        COMPREHENSIVE = 'comprehensive', 'Comprehensive'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='performance_reports')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='performance_reports')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='performance_reports', null=True, blank=True)
    report_type = models.CharField(max_length=20, choices=ReportType.choices, default=ReportType.COMPREHENSIVE)
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    data_snapshot = models.JSONField(default=dict, blank=True)
    generated_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    is_submitted_to_gov = models.BooleanField(default=False)

    class Meta:
        db_table = 'school_performance_reports'
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.title} ({self.get_report_type_display()})"
