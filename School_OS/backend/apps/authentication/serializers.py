"""
Authentication Serializers — JWT Token & User Management
"""
import hashlib
import logging
from datetime import timedelta
import requests
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed as DRFAuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.authentication.models import User, UserRoleMapping
from apps.tenants.serializers import TenantListSerializer

logger = logging.getLogger(__name__)


def check_password_breach(password: str) -> bool:
    """
    Check if a password has been exposed in data breaches using HaveIBeenPwned API.
    Uses k-anonymity model - only sends first 5 chars of SHA-1 hash.
    Returns True if password found in breaches, False otherwise.
    """
    try:
        # Create SHA-1 hash of password
        sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
        prefix = sha1_hash[:5]
        suffix = sha1_hash[5:]

        # Query the API
        response = requests.get(
            f'https://api.pwnedpasswords.com/range/{prefix}',
            timeout=5,
            headers={'User-Agent': 'School-OS-Security-Check'}
        )

        if response.status_code == 200:
            # Check if our suffix is in the response
            for line in response.text.strip().split('\n'):
                if line.startswith(suffix):
                    count = int(line.split(':')[1])
                    logger.warning(f"Password found in breach database (seen {count} times)")
                    return True
        return False
    except requests.RequestException as e:
        # Log error but don't block registration on API failure
        logger.warning(f"Could not check password breach: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error checking password breach: {e}")
        return False


class SOSTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer that includes user roles and tenants
    in the token claims and response.
    """
    username_field = 'email'

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['full_name'] = user.full_name
        token['is_platform_admin'] = user.is_platform_admin
        token['password_changed_at'] = int(user.password_changed_at.timestamp()) if user.password_changed_at else 0

        # Add roles per tenant
        roles = {}
        for mapping in user.role_mappings.filter(is_active=True).select_related('tenant'):
            tenant_id = str(mapping.tenant_id)
            if tenant_id not in roles:
                roles[tenant_id] = []
            roles[tenant_id].append(mapping.role)
        token['roles'] = roles

        return token

    def validate(self, attrs):
        # M1: brute-force lockout — check before authenticating
        email = attrs.get(self.username_field, '')
        account = None
        if email:
            account = User.objects.filter(email=email).first()
            if account and account.locked_until and account.locked_until > timezone.now():
                mins_left = int((account.locked_until - timezone.now()).total_seconds() // 60) + 1
                raise DRFAuthenticationFailed(
                    f'Account temporarily locked due to too many failed attempts. Try again in {mins_left} minute(s).',
                    code='account_locked',
                )

        try:
            data = super().validate(attrs)
        except DRFAuthenticationFailed:
            # Record the failed attempt
            if account:
                max_attempts = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 5)
                lockout_minutes = getattr(settings, 'LOGIN_LOCKOUT_MINUTES', 15)
                attempts = account.failed_login_attempts + 1
                if attempts >= max_attempts:
                    account.failed_login_attempts = 0
                    account.locked_until = timezone.now() + timedelta(minutes=lockout_minutes)
                    logger.warning(f"Account {account.email} locked for {lockout_minutes} minutes after {attempts} failed attempts.")
                else:
                    account.failed_login_attempts = attempts
                account.save(update_fields=['failed_login_attempts', 'locked_until'])
            raise

        # Success — reset counters
        if account and (account.failed_login_attempts or account.locked_until):
            account.failed_login_attempts = 0
            account.locked_until = None
            account.save(update_fields=['failed_login_attempts', 'locked_until'])

        user = self.user

        # Add extra response data
        role_mappings = user.role_mappings.filter(
            is_active=True
        ).select_related('tenant')

        tenants = []
        roles = []
        for mapping in role_mappings:
            tenants.append({
                'id': str(mapping.tenant_id),
                'school_name': mapping.tenant.school_name,
                'education_type': mapping.tenant.education_type,
                'logo_url': mapping.tenant.logo_url or '',
            })
            roles.append({
                'tenant_id': str(mapping.tenant_id),
                'role': mapping.role,
                'role_display': mapping.get_role_display(),
            })

        # Deduplicate tenants
        seen = set()
        unique_tenants = []
        for t in tenants:
            if t['id'] not in seen:
                seen.add(t['id'])
                unique_tenants.append(t)

        data['user'] = {
            'id': str(user.id),
            'email': user.email,
            'full_name': user.full_name,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'default_language': user.default_language,
            'email_alerts': user.email_alerts,
            'sms_alerts': user.sms_alerts,
            'is_platform_admin': user.is_platform_admin,
            'must_change_password': user.must_change_password,
        }
        data['roles'] = roles
        data['tenants'] = unique_tenants
        data['must_change_password'] = user.must_change_password

        return data


class UserSerializer(serializers.ModelSerializer):
    """Full user profile serializer."""
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'default_language', 'profile_photo',
            'email_alerts', 'sms_alerts',
            'is_platform_admin', 'is_active', 'date_joined',
            'must_change_password',
            'roles',
        ]
        read_only_fields = ['id', 'date_joined', 'is_platform_admin']

    def get_roles(self, obj):
        mappings = obj.role_mappings.filter(is_active=True).select_related('tenant')
        return [
            {
                'tenant_id': str(m.tenant_id),
                'tenant_name': m.tenant.school_name,
                'role': m.role,
                'role_display': m.get_role_display(),
            }
            for m in mappings
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=UserRoleMapping.Role.choices, write_only=True)
    tenant_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone',
            'default_language', 'password', 'role', 'tenant_id',
        ]

    def validate_password(self, value):
        """Enforce Django password validators + breach check."""
        validate_password(value)
        if check_password_breach(value):
            raise serializers.ValidationError(
                "This password has appeared in data breaches. Please choose a different password."
            )
        return value

    def create(self, validated_data):
        role = validated_data.pop('role')
        tenant_id = validated_data.pop('tenant_id')
        password = validated_data.pop('password')

        # Use full email as username to ensure global uniqueness
        validated_data['username'] = validated_data['email']

        # Admin-supplied password is temporary — force change on first login.
        validated_data['must_change_password'] = True

        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        # Create role mapping
        UserRoleMapping.objects.create(
            user=user,
            tenant_id=tenant_id,
            role=role,
            assigned_by=self.context.get('request', {}).user if self.context.get('request') else None,
        )

        return user


class UserRoleMappingSerializer(serializers.ModelSerializer):
    """Serializer for role assignments."""
    user_email = serializers.ReadOnlyField(source='user.email')
    user_name = serializers.ReadOnlyField(source='user.full_name')
    tenant_name = serializers.ReadOnlyField(source='tenant.school_name')

    class Meta:
        model = UserRoleMapping
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'tenant', 'tenant_name', 'role', 'is_active',
            'assigned_at',
        ]
        read_only_fields = ['id', 'assigned_at']
