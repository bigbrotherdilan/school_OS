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
    middle_name = models.CharField(
        max_length=150, blank=True,
        help_text="Middle name(s), e.g., 'Nfon' in 'Dilan Nfon Ngongsong'",
    )
    phone = models.CharField(max_length=20, blank=True)
    default_language = models.CharField(
        max_length=5,
        choices=[('en', 'English'), ('fr', 'French')],
        default='en',
    )
    profile_photo = models.ImageField(
        upload_to='profile_photos/',
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
    failed_login_attempts = models.PositiveIntegerField(
        default=0,
        help_text="Consecutive failed login attempts. Reset on successful login.",
    )
    locked_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="If set, the account cannot log in until this time.",
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="If True, the user must change their password on next login (e.g. after admin sets a temporary password).",
    )
    pin_hash = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text="SHA-256 hash of the user's 6-digit PIN. Used for quick re-authentication.",
    )
    pin_set_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last PIN change. Used to invalidate stale PIN verification tokens.",
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

    def get_full_name(self):
        parts = [p for p in (self.first_name, self.middle_name, self.last_name) if p]
        return ' '.join(parts)

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

    @staticmethod
    def _hash_pin(pin: str) -> str:
        return hashlib.sha256(pin.encode()).hexdigest()

    def set_pin(self, pin: str):
        self.pin_hash = self._hash_pin(pin)
        self.pin_set_at = timezone.now()
        self.save(update_fields=['pin_hash', 'pin_set_at'])

    def verify_pin(self, pin: str) -> bool:
        if not self.pin_hash:
            return False
        return self.pin_hash == self._hash_pin(pin)

    def remove_pin(self):
        self.pin_hash = None
        self.pin_set_at = None
        self.save(update_fields=['pin_hash', 'pin_set_at'])


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


class Invitation(models.Model):
    """
    Invitation token for onboarding users who are not onsite.
    The admin creates an invite, shares the link, and the user sets their own password.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        EXPIRED = 'expired', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=UserRoleMapping.Role.choices)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='invitations',
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_invitations',
    )
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    class Meta:
        db_table = 'invitations'
        ordering = ['-created_at']
        verbose_name = 'Invitation'
        verbose_name_plural = 'Invitations'

    def __str__(self):
        return f"Invite {self.email} → {self.get_role_display()} @ {self.tenant.school_name}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def login_url(self):
        from django.conf import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        portal = {
            'admin': 'admin', 'super_admin': 'admin',
            'teacher': 'teacher', 'parent': 'parent',
            'bursar': 'bursar',
        }.get(self.role, 'login')
        return f"{frontend_url}/invite/{self.token}"
