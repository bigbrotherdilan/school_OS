import uuid
from django.db import models
from apps.tenants.models import Tenant
from apps.authentication.models import User


class Announcement(models.Model):
    """
    A school-wide or targeted announcement from the admin.
    """
    class AudienceType(models.TextChoices):
        ALL = 'all', 'Everyone'
        TEACHERS = 'teachers', 'Teachers Only'
        PARENTS = 'parents', 'Parents Only'
        STUDENTS = 'students', 'Students Only'
        STAFF = 'staff', 'All Staff'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=255)
    body = models.TextField()
    audience = models.CharField(max_length=20, choices=AudienceType.choices, default=AudienceType.ALL)
    is_urgent = models.BooleanField(default=False)
    published = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'announcements'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_audience_display()})"


class DirectMessage(models.Model):
    """
    A private message sent between two users within a school context.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'direct_messages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender.full_name} → {self.recipient.full_name}: {self.subject}"
