"""
Authentication Models — Central Identity System
Global user accounts with per-tenant role mappings.
"""
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom user model for School OS.
    Identity is global — roles are per-tenant.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    default_language = models.CharField(
        max_length=5,
        choices=[('en', 'English'), ('fr', 'French')],
        default='en',
    )
    profile_photo = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    email_alerts = models.BooleanField(
        default=True,
        help_text="Receive email notifications",
    )
    sms_alerts = models.BooleanField(
        default=False,
        help_text="Receive SMS notifications",
    )
    password_changed_at = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp of last password change. Used to invalidate sessions.",
    )
    is_platform_admin = models.BooleanField(
        default=False,
        help_text="Super Admin — manages the entire SOS platform",
    )
    is_government_official = models.BooleanField(
        default=False,
        help_text="MINESEC Official — has macro-level oversight",
    )
    government_region = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="If set, limits oversight to this specific region (e.g., 'Littoral'). If blank, grants national oversight.",
    )

    # Use email as the login field
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"

    @property
    def full_name(self):
        return self.get_full_name() or self.email

    def get_roles_for_tenant(self, tenant_id):
        """Get all roles this user has for a specific tenant."""
        return self.role_mappings.filter(
            tenant_id=tenant_id,
            is_active=True,
        ).values_list('role', flat=True)

    def get_tenants(self):
        """Get all tenants this user belongs to."""
        return self.role_mappings.filter(
            is_active=True,
        ).select_related('tenant')


class UserRoleMapping(models.Model):
    """
    Maps a user to a role within a specific tenant.
    One user can have roles in multiple schools.
    
    Example:
      - parent@mail.com → Parent @ SchoolA
      - parent@mail.com → Parent @ SchoolB
      - teacher@mail.com → Teacher @ SchoolA
      - teacher@mail.com → Admin @ SchoolB
    """

    class Role(models.TextChoices):
        SUPER_ADMIN = 'super_admin', 'Super Admin'
        ADMIN = 'admin', 'School Administrator'
        BURSAR = 'bursar', 'Bursar'
        TEACHER = 'teacher', 'Teacher'
        PARENT = 'parent', 'Parent'
        STUDENT = 'student', 'Student'
        GOVERNMENT = 'government', 'Government Officer'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='role_mappings',
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='user_roles',
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_roles',
    )

    class Meta:
        db_table = 'user_role_mappings'
        unique_together = ['user', 'tenant', 'role']
        verbose_name = 'User Role Mapping'
        verbose_name_plural = 'User Role Mappings'

    def __str__(self):
        return f"{self.user.email} → {self.get_role_display()} @ {self.tenant.school_name}"


class UserSession(models.Model):
    """
    Tracks active login sessions per user.
    Used for device tracking, concurrent session limits, and session invalidation.
    """
    class DeviceType(models.TextChoices):
        MOBILE = 'mobile', 'Mobile'
        DESKTOP = 'desktop', 'Desktop'
        TABLET = 'tablet', 'Tablet'
        UNKNOWN = 'unknown', 'Unknown'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='sessions'
    )
    device_name = models.CharField(max_length=255, blank=True, default='')
    device_type = models.CharField(
        max_length=20, choices=DeviceType.choices, default=DeviceType.UNKNOWN
    )
    browser = models.CharField(max_length=255, blank=True, default='')
    os = models.CharField(max_length=255, blank=True, default='')
    user_agent = models.TextField(blank=True, default='')
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    login_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    refresh_token_hash = models.CharField(max_length=128, blank=True, default='')

    class Meta:
        db_table = 'user_sessions'
        ordering = ['-last_activity_at']
        verbose_name = 'User Session'
        verbose_name_plural = 'User Sessions'

    def __str__(self):
        return f"{self.user.email} — {self.device_name or self.device_type} ({self.ip_address})"
