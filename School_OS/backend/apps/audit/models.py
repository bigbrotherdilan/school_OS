"""
Audit Models — System-wide audit trail for all data modifications.
"""
import uuid
from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """
    Records every data-modifying operation across the platform.
    Immutable — never updated or deleted.
    """

    class ActionType(models.TextChoices):
        CREATE = 'CREATE', 'Create'
        UPDATE = 'UPDATE', 'Update'
        DELETE = 'DELETE', 'Delete'
        LOGIN = 'LOGIN', 'Login'
        LOGOUT = 'LOGOUT', 'Logout'
        EXPORT = 'EXPORT', 'Export'
        APPROVE = 'APPROVE', 'Approve'
        REJECT = 'REJECT', 'Reject'

    class Module(models.TextChoices):
        AUTH = 'AUTH', 'Authentication'
        STUDENT = 'STUDENT', 'Student Management'
        STAFF = 'STAFF', 'Staff Management'
        ACADEMIC = 'ACADEMIC', 'Academic'
        ASSESSMENT = 'ASSESSMENT', 'Assessment'
        FINANCE = 'FINANCE', 'Finance'
        ATTENDANCE = 'ATTENDANCE', 'Attendance'
        TIMETABLE = 'TIMETABLE', 'Timetable'
        REPORT = 'REPORT', 'Reports'
        LOGBOOK = 'LOGBOOK', 'Logbook'
        NOTIFICATION = 'NOTIFICATION', 'Notifications'
        DOCUMENT = 'DOCUMENT', 'Documents'
        SYSTEM = 'SYSTEM', 'System'
        GOVERNMENT = 'GOVERNMENT', 'Government'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    action = models.CharField(max_length=20, choices=ActionType.choices)
    module = models.CharField(max_length=20, choices=Module.choices)
    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    endpoint = models.CharField(max_length=500, blank=True)
    method = models.CharField(max_length=10, blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        user_str = self.user.email if self.user else 'System'
        return f"[{self.action}] {self.module} by {user_str} at {self.created_at}"
