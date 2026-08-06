from rest_framework import serializers
from apps.tenants.models import Tenant


class TenantSerializer(serializers.ModelSerializer):
    """Full tenant serializer for creation and detail views."""
    is_bilingual = serializers.ReadOnlyField()
    default_theme = serializers.ReadOnlyField()

    class Meta:
        model = Tenant
        fields = [
            'id', 'school_name', 'slug', 'education_type',
            'region', 'division', 'country', 'address',
            'phone', 'email', 'logo_url', 'theme_config',
            'motto', 'postal_code', 'status', 'subscription_plan',
            'max_students', 'is_bilingual', 'default_theme',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TenantListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing tenants."""

    class Meta:
        model = Tenant
        fields = [
            'id', 'school_name', 'slug', 'education_type',
            'region', 'division', 'address', 'phone', 'email',
            'logo_url', 'motto', 'postal_code', 'status', 'created_at',
        ]


class TenantThemeSerializer(serializers.Serializer):
    """Serializer for updating tenant theme/branding."""
    logo_url = serializers.URLField(required=False)
    theme_config = serializers.JSONField(required=False)
    motto = serializers.CharField(max_length=255, required=False)


class TenantConfigSerializer(serializers.ModelSerializer):
    """Serializer for TenantConfig — school-level settings."""
    class Meta:
        from apps.tenants.models import TenantConfig
        model = TenantConfig
        fields = [
            'currency_code', 'currency_symbol',
            'grading_scale_max',
            'grade_a_threshold', 'grade_b_threshold', 'grade_c_threshold',
            'promotion_cutoff',
            'payment_methods',
            'default_language', 'phone_format_placeholder',
        ]
