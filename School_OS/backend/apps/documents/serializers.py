from rest_framework import serializers
from .models import Document, DocumentCategory, IDCardTemplate, GeneratedIDCard


class DocumentCategorySerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = DocumentCategory
        fields = ['id', 'name', 'description', 'document_count', 'created_at']

    def get_document_count(self, obj):
        return obj.documents.filter(is_archived=False).count()


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    file_size_display = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'title', 'description', 'file', 'file_name', 'file_size',
            'file_size_display', 'file_type', 'category', 'category_name',
            'access_level', 'uploaded_by', 'uploaded_by_name', 'download_count',
            'is_archived', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'file_name', 'file_size', 'file_type', 'uploaded_by', 'download_count', 'created_at']

    def get_file_size_display(self, obj):
        size = obj.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.1f} MB"


class IDCardTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IDCardTemplate
        fields = [
            'id', 'name', 'is_active', 'card_width', 'card_height',
            'primary_color', 'secondary_color', 'accent_color',
            'style_config',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class GeneratedIDCardSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_admission = serializers.CharField(source='student.admission_number', read_only=True)
    student_class = serializers.CharField(source='student.current_class.name', read_only=True, default='N/A')
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True, default='N/A')
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True, default='N/A')

    class Meta:
        model = GeneratedIDCard
        fields = [
            'id', 'student', 'student_name', 'student_admission', 'student_class',
            'template', 'generated_by', 'generated_by_name', 'academic_year', 'academic_year_name',
            'is_printed', 'printed_at', 'created_at',
        ]
        read_only_fields = ['id', 'generated_by', 'is_printed', 'printed_at', 'created_at']


class IDCardGenerationRequestSerializer(serializers.Serializer):
    """Serializer for ID card generation requests."""
    student_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="List of student UUIDs. If empty, all active students in class."
    )
    class_id = serializers.IntegerField(
        required=False,
        help_text="Class ID for batch generation"
    )
    academic_year_id = serializers.IntegerField(
        required=True,
        help_text="Academic year ID"
    )
    template_id = serializers.UUIDField(
        required=False,
        help_text="Template ID (uses default if not provided)"
    )
    output_format = serializers.ChoiceField(
        choices=[('single', 'Single PDF'), ('multi', 'Multi-page PDF'), ('zip', 'ZIP Archive')],
        default='single',
        help_text="Output format for generated ID cards"
    )
    style_overrides = serializers.JSONField(
        required=False,
        help_text="Inline style overrides (colors, toggles, etc.)"
    )
