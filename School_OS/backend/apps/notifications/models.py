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


class AnnouncementRead(models.Model):
    """
    Server-side read tracking for announcements so the bell badge and
    "removed once viewed" behaviour persist across logins/devices.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='announcement_reads')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='read_announcements')
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='reads')
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'announcement_reads'
        constraints = [
            models.UniqueConstraint(fields=['user', 'announcement'], name='uniq_announcement_read_user'),
        ]

    def __str__(self):
        return f"{self.user.full_name} read {self.announcement.title}"


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


class Notification(models.Model):
    """
    A per-user notification with server-side read tracking.
    Used for targeted system events (fee invoices, payments, reminders)
    so only the intended recipients see them and unread counts persist.
    """
    class Category(models.TextChoices):
        FEE_INVOICE = 'fee_invoice', 'Fee Invoice'
        PAYMENT = 'payment', 'Payment'
        FEE_REMINDER = 'fee_reminder', 'Fee Reminder'
        MARKS = 'marks', 'Marks'
        ANNOUNCEMENT = 'announcement', 'Announcement'
        SYSTEM = 'system', 'System'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='notifications')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.SYSTEM)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=255, blank=True, default='', help_text="Frontend route to navigate to on click")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'recipient', 'is_read'], name='idx_notif_recipient'),
        ]

    def __str__(self):
        return f"{self.title} → {self.recipient.full_name}"


class EmailSetting(models.Model):
    """
    Per-tenant SMTP configuration for sending emails.
    Falls back to environment variables if not configured.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.OneToOneField(
        Tenant, on_delete=models.CASCADE, related_name='email_settings'
    )
    host = models.CharField(max_length=255, default='smtp.gmail.com')
    port = models.PositiveIntegerField(default=587)
    use_tls = models.BooleanField(default=True)
    username = models.EmailField(max_length=255, blank=True, default='')
    password = models.CharField(max_length=255, blank=True, default='')
    from_email = models.EmailField(max_length=255, blank=True, default='')
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'email_settings'

    def __str__(self):
        return f"Email settings for {self.tenant.name}"
