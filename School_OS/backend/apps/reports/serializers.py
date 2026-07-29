from rest_framework import serializers
from .models import SchoolPerformanceReport, ReportCardTemplate


class SchoolPerformanceReportSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    term_name = serializers.CharField(source='term.name', read_only=True)

    class Meta:
        model = SchoolPerformanceReport
        fields = '__all__'


class ReportCardTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportCardTemplate
        fields = [
            'id', 'name', 'is_active',
            'primary_color', 'secondary_color', 'accent_color',
            'style_config',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
