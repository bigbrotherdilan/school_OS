"""
Document Models — File management for school documents.
"""
import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone


def document_upload_path(instance, filename):
    """Generate upload path: media/{tenant_id}/documents/{category}/{filename}"""
    return os.path.join(
        str(instance.tenant_id) if instance.tenant_id else 'unknown',
        'documents',
        instance.category,
        filename,
    )


class DocumentCategory(models.Model):
    """Categorization for uploaded documents."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='document_categories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'document_categories'
        ordering = ['name']
        verbose_name = 'Document Category'
        verbose_name_plural = 'Document Categories'

    def __str__(self):
        return self.name


class Document(models.Model):
    """
    Represents an uploaded school document.
    Scoped to a tenant (school).
    """

    class AccessLevel(models.TextChoices):
        PUBLIC = 'public', 'Public'
        STAFF = 'staff', 'Staff Only'
        ADMIN = 'admin', 'Admin Only'
        CONFIDENTIAL = 'confidential', 'Confidential'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=document_upload_path, max_length=500)
    file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0, help_text="File size in bytes")
    file_type = models.CharField(max_length=100, blank=True, help_text="MIME type")
    category = models.ForeignKey(
        DocumentCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documents',
    )
    access_level = models.CharField(
        max_length=20,
        choices=AccessLevel.choices,
        default=AccessLevel.STAFF,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents',
    )
    download_count = models.IntegerField(default=0)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'documents'
        ordering = ['-created_at']
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'

    def __str__(self):
        return self.title


class IDCardTemplate(models.Model):
    """
    Template for ID card generation. Schools can customize card layout.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='id_card_templates')
    name = models.CharField(max_length=100, default='Default Template')
    is_active = models.BooleanField(default=True)
    
    # Layout settings
    card_width = models.IntegerField(default=85, help_text="Card width in mm (standard: 85)")
    card_height = models.IntegerField(default=54, help_text="Card height in mm (standard: 54)")
    
    # Color scheme
    primary_color = models.CharField(max_length=7, default='#0B2348', help_text="Hex color code")
    secondary_color = models.CharField(max_length=7, default='#ffffff', help_text="Hex color code")
    accent_color = models.CharField(max_length=7, default='#F2B01E', help_text="Hex color code")

    # Full visual editor config
    style_config = models.JSONField(default=dict, blank=True, help_text="Full visual style configuration")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'id_card_templates'
        ordering = ['-is_active', 'name']
        verbose_name = 'ID Card Template'
        verbose_name_plural = 'ID Card Templates'

    def __str__(self):
        return f"{self.name} ({self.tenant.school_name})"


class GeneratedIDCard(models.Model):
    """
    Record of generated ID cards for audit and re-download purposes.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='generated_id_cards')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='id_cards')
    template = models.ForeignKey(IDCardTemplate, on_delete=models.SET_NULL, null=True, related_name='generated_cards')
    
    # Generation metadata
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_id_cards',
    )
    academic_year = models.ForeignKey(
        'academic.AcademicYear',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='id_cards',
    )
    
    # Status
    is_printed = models.BooleanField(default=False)
    printed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'generated_id_cards'
        ordering = ['-created_at']
        verbose_name = 'Generated ID Card'
        verbose_name_plural = 'Generated ID Cards'
        unique_together = ['tenant', 'student', 'academic_year']

    def __str__(self):
        return f"ID Card: {self.student.full_name} ({self.academic_year})"

    def mark_printed(self):
        self.is_printed = True
        self.printed_at = timezone.now()
        self.save(update_fields=['is_printed', 'printed_at'])
