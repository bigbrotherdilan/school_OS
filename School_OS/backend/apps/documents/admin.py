from django.contrib import admin
from .models import Document, DocumentCategory, IDCardTemplate, GeneratedIDCard


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant_id', 'created_at']
    search_fields = ['name']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'file_name', 'file_size', 'access_level', 'uploaded_by', 'is_archived', 'created_at']
    list_filter = ['access_level', 'is_archived', 'created_at']
    search_fields = ['title', 'file_name']
    readonly_fields = ['file_size', 'file_type', 'download_count', 'created_at', 'updated_at']


@admin.register(IDCardTemplate)
class IDCardTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant_id', 'is_active', 'primary_color', 'accent_color', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name']


@admin.register(GeneratedIDCard)
class GeneratedIDCardAdmin(admin.ModelAdmin):
    list_display = ['student', 'tenant_id', 'academic_year', 'generated_by', 'is_printed', 'printed_at', 'created_at']
    list_filter = ['is_printed', 'created_at', 'academic_year']
    search_fields = ['student__first_name', 'student__last_name', 'student__admission_number']
    readonly_fields = ['created_at']
