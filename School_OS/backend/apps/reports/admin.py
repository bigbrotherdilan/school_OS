from django.contrib import admin
from .models import SchoolPerformanceReport, StudentReportCard


@admin.register(StudentReportCard)
class StudentReportCardAdmin(admin.ModelAdmin):
    list_display = ['student', 'term', 'academic_year', 'generated_at', 'is_archived']
    list_filter = ['is_archived', 'term', 'academic_year']
    search_fields = ['student__first_name', 'student__last_name', 'student__admission_number']
    readonly_fields = ['id', 'generated_at', 'pdf_file']
    raw_id_fields = ['tenant', 'student', 'academic_year', 'term', 'generated_by']


@admin.register(SchoolPerformanceReport)
class SchoolPerformanceReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'academic_year', 'term', 'generated_at', 'is_submitted_to_gov']
    list_filter = ['report_type', 'is_submitted_to_gov', 'academic_year']
    search_fields = ['title']
    readonly_fields = ['id', 'generated_at']
    raw_id_fields = ['tenant', 'academic_year', 'term', 'generated_by']
