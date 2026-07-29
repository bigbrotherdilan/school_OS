"""
Tenant Model — Core of Multi-Tenant Architecture
Each school = one tenant. All data is isolated per tenant.
"""
import uuid
from django.db import models


class Tenant(models.Model):
    """
    Represents a school institution registered in School OS.
    Every piece of school data belongs to exactly one tenant.
    """

    class EducationType(models.TextChoices):
        ANGLOPHONE = 'anglophone', 'Anglophone'
        FRANCOPHONE = 'francophone', 'Francophone'
        BILINGUAL = 'bilingual', 'Bilingual'

    class SchoolType(models.TextChoices):
        GENERAL = 'general', 'General Education'
        TECHNICAL = 'technical', 'Technical Education'
        VOCATIONAL = 'vocational', 'Vocational Education'

    class SessionType(models.TextChoices):
        MORNING = 'morning', 'Morning Session'
        AFTERNOON = 'afternoon', 'Afternoon Session'
        BOTH = 'both', 'Morning & Afternoon'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        PENDING = 'pending', 'Pending Approval'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True, help_text="URL-friendly school identifier")
    education_type = models.CharField(
        max_length=20,
        choices=EducationType.choices,
        default=EducationType.ANGLOPHONE,
    )
    school_type = models.CharField(
        max_length=20,
        choices=SchoolType.choices,
        default=SchoolType.GENERAL,
    )
    session_type = models.CharField(
        max_length=20,
        choices=SessionType.choices,
        default=SessionType.MORNING,
    )
    region = models.CharField(max_length=100, blank=True)
    division = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='Cameroon')
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    # Branding
    logo_url = models.URLField(blank=True)
    logo = models.CharField(max_length=255, blank=True, null=True)
    theme_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="UI theme configuration: colors, fonts, etc.",
    )

    # Academic config
    motto = models.CharField(max_length=255, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)

    # Platform metadata
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    subscription_plan = models.CharField(max_length=50, default='starter')
    max_students = models.IntegerField(default=500, help_text="Maximum students allowed")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenants'
        ordering = ['school_name']
        verbose_name = 'School (Tenant)'
        verbose_name_plural = 'Schools (Tenants)'

    def __str__(self):
        return f"{self.school_name} ({self.get_education_type_display()})"

    @property
    def is_bilingual(self):
        return self.education_type == self.EducationType.BILINGUAL

    @property
    def default_theme(self):
        """Return theme config with defaults."""
        defaults = {
            'primaryColor': '#1a2b5f',
            'secondaryColor': '#2d8a4e',
            'accentColor': '#d4a843',
            'fontFamily': 'Inter, sans-serif',
        }
        return {**defaults, **self.theme_config}


class TenantConfig(models.Model):
    """
    School-level configuration. Stores values that vary per school
    (currency, grading scale, payment methods, etc.) instead of hardcoding them.
    """
    tenant = models.OneToOneField(
        Tenant, on_delete=models.CASCADE, related_name='config',
        primary_key=True,
    )

    # Financial
    currency_code = models.CharField(max_length=10, default='XAF', help_text="ISO 4217 currency code")
    currency_symbol = models.CharField(max_length=10, default='XAF', help_text="Display symbol")

    # Grading
    grading_scale_max = models.DecimalField(
        max_digits=5, decimal_places=1, default=20,
        help_text="Maximum possible score (e.g. 20 for French system, 100 for American)",
    )
    grade_a_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=16,
        help_text="Minimum score for grade A",
    )
    grade_b_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=12,
        help_text="Minimum score for grade B",
    )
    grade_c_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=10,
        help_text="Minimum score for grade C",
    )
    promotion_cutoff = models.DecimalField(
        max_digits=5, decimal_places=1, default=9.5,
        help_text="Minimum average for student promotion",
    )

    # Payments
    payment_methods = models.JSONField(
        default=list,
        blank=True,
        help_text='Available payment methods, e.g. ["mtn_momo", "orange_money", "bank_transfer"]',
    )

    # Localization
    default_language = models.CharField(
        max_length=5, default='en',
        choices=[('en', 'English'), ('fr', 'French')],
    )
    phone_format_placeholder = models.CharField(
        max_length=50, default='6XX XXX XXX',
        help_text="Placeholder text for phone number input",
    )

    class Meta:
        db_table = 'tenant_config'

    def __str__(self):
        return f"Config for {self.tenant.school_name}"

    def save(self, *args, **kwargs):
        if not self.payment_methods:
            self.payment_methods = ['mtn_momo', 'orange_money', 'bank_transfer']
        super().save(*args, **kwargs)

    @property
    def grade_a_threshold_pct(self):
        """A threshold as percentage of max score."""
        return float(self.grade_a_threshold) / float(self.grading_scale_max) * 100

    @property
    def grade_b_threshold_pct(self):
        return float(self.grade_b_threshold) / float(self.grading_scale_max) * 100

    @property
    def grade_c_threshold_pct(self):
        return float(self.grade_c_threshold) / float(self.grading_scale_max) * 100

    @classmethod
    def get_for_tenant(cls, tenant):
        """Get or create config for a tenant with Cameroon defaults."""
        config, _ = cls.objects.get_or_create(tenant=tenant)
        return config
