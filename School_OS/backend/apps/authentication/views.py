"""
Authentication Views — Login, User Management, Role Assignment
"""
import os
import uuid
import secrets
import string
import hashlib
import json
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.utils import timezone
from django.contrib.auth.tokens import default_token_generator
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken
from apps.authentication.models import User, UserRoleMapping, UserSession
from apps.authentication.serializers import (
    SOSTokenObtainPairSerializer,
    UserSerializer,
    UserCreateSerializer,
    UserRoleMappingSerializer,
)
from apps.authentication.permissions import IsSchoolAdmin, IsPlatformAdmin


LOGIN_TOKEN_EXPIRY = timedelta(minutes=5)


def _parse_device_info(request):
    """Extract device info from request headers."""
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    ua_lower = user_agent.lower()

    if 'mobile' in ua_lower or 'android' in ua_lower or 'iphone' in ua_lower:
        device_type = UserSession.DeviceType.MOBILE
    elif 'tablet' in ua_lower or 'ipad' in ua_lower:
        device_type = UserSession.DeviceType.TABLET
    elif 'windows' in ua_lower or 'mac' in ua_lower or 'linux' in ua_lower:
        device_type = UserSession.DeviceType.DESKTOP
    else:
        device_type = UserSession.DeviceType.UNKNOWN

    if 'windows' in ua_lower:
        os_name = 'Windows'
    elif 'mac' in ua_lower and 'iphone' not in ua_lower:
        os_name = 'macOS'
    elif 'linux' in ua_lower and 'android' not in ua_lower:
        os_name = 'Linux'
    elif 'android' in ua_lower:
        os_name = 'Android'
    elif 'iphone' in ua_lower or 'ipad' in ua_lower:
        os_name = 'iOS'
    else:
        os_name = 'Unknown'

    browser = 'Unknown'
    if 'edge' in ua_lower or 'edg/' in ua_lower:
        browser = 'Edge'
    elif 'chrome' in ua_lower and 'opr' not in ua_lower:
        browser = 'Chrome'
    elif 'firefox' in ua_lower:
        browser = 'Firefox'
    elif 'safari' in ua_lower and 'chrome' not in ua_lower:
        browser = 'Safari'

    device_name = f"{browser} on {os_name}" if browser != 'Unknown' else os_name

    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR', '')

    return {
        'device_name': device_name,
        'device_type': device_type,
        'browser': browser,
        'os': os_name,
        'user_agent': user_agent,
        'ip_address': ip or None,
    }


def _hash_refresh_token(token_str):
    return hashlib.sha256(token_str.encode('utf-8')).hexdigest()


def _create_session(user, refresh_token_str, device_info):
    """Create a UserSession record for the login."""
    return UserSession.objects.create(
        user=user,
        device_name=device_info['device_name'],
        device_type=device_info['device_type'],
        browser=device_info['browser'],
        os=device_info['os'],
        user_agent=device_info['user_agent'],
        ip_address=device_info['ip_address'],
        refresh_token_hash=_hash_refresh_token(refresh_token_str),
    )


def _deactivate_user_sessions(user, exclude_session_id=None):
    """Deactivate all active sessions for a user, optionally excluding one."""
    qs = UserSession.objects.filter(user=user, is_active=True)
    if exclude_session_id:
        qs = qs.exclude(id=exclude_session_id)
    count = qs.update(is_active=False)
    return count


def _set_refresh_cookie(response, refresh_token):
    max_age = 7 * 24 * 3600
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/api/v1/auth/',
    )
    return response


def _delete_refresh_cookie(response):
    response.delete_cookie('refresh_token', path='/api/v1/auth/')
    return response


class SOSLoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Authenticate user and return JWT tokens with roles and tenants.
    Supports 2-step login when device limit is reached.
    Refresh token is set as an HttpOnly cookie.
    """
    serializer_class = SOSTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def finalize_response(self, request, response, *args, **kwargs):
        if response.status_code != 200:
            return super().finalize_response(request, response, *args, **kwargs)

        if 'refresh' not in response.data:
            return super().finalize_response(request, response, *args, **kwargs)

        user = getattr(self, 'user', None)
        if not user:
            return super().finalize_response(request, response, *args, **kwargs)

        refresh_token = response.data.get('refresh')
        device_info = _parse_device_info(request)

        max_sessions = getattr(settings, 'MAX_SESSIONS_PER_USER', 2)
        active_count = UserSession.objects.filter(user=user, is_active=True).count()

        if max_sessions > 0 and active_count >= max_sessions:
            active_sessions = UserSession.objects.filter(user=user, is_active=True)
            sessions_info = [
                {
                    'id': str(s.id),
                    'device_name': s.device_name or 'Unknown device',
                    'device_type': s.device_type,
                    'browser': s.browser,
                    'os': s.os,
                    'ip_address': s.ip_address or 'Unknown',
                    'last_active': s.last_activity_at.isoformat(),
                    'login_at': s.login_at.isoformat(),
                }
                for s in active_sessions
            ]

            login_token_data = {
                'user_id': str(user.id),
                'device_info': device_info,
                'refresh_token': refresh_token,
                'expires_at': (timezone.now() + LOGIN_TOKEN_EXPIRY).isoformat(),
            }
            login_token = secrets.token_urlsafe(32)
            request.session[f'login_token_{login_token}'] = login_token_data
            request.session.set_expiry(int(LOGIN_TOKEN_EXPIRY.total_seconds()))

            response = Response(
                {
                    'requires_device_kill': True,
                    'login_token': login_token,
                    'message': f'You are already logged in on {active_count} device(s). Maximum allowed is {max_sessions}. Confirm to disconnect existing devices and continue.',
                    'active_sessions': sessions_info,
                },
                status=status.HTTP_409_CONFLICT,
            )
            response = super().finalize_response(request, response, *args, **kwargs)
            return response

        user.last_login_ip = device_info['ip_address']
        user.save(update_fields=['last_login_ip'])

        session = _create_session(user, refresh_token, device_info)

        response = super().finalize_response(request, response, *args, **kwargs)
        response = _set_refresh_cookie(response, refresh_token)
        response.data.pop('refresh', None)  # M3: never expose refresh token in body
        response.data['session_id'] = str(session.id)
        response.data['device'] = device_info
        return response

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.user = serializer.user
        return super().post(request, *args, **kwargs)


@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_kill_login_view(request):
    """
    POST /api/v1/auth/login/confirm-kill/
    After user confirms, kills old sessions and completes login.
    Requires: login_token from the initial 409 response.
    """
    login_token = request.data.get('login_token')
    if not login_token:
        return Response({'detail': 'Login token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    login_data = request.session.pop(f'login_token_{login_token}', None)
    if not login_data:
        return Response({'detail': 'Invalid or expired login token. Please log in again.'}, status=status.HTTP_410_GONE)

    user_id = login_data['user_id']
    device_info = login_data['device_info']
    refresh_token = login_data['refresh_token']

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    killed = _deactivate_user_sessions(user)
    user.last_login_ip = device_info['ip_address']
    user.save(update_fields=['last_login_ip'])

    session = _create_session(user, refresh_token, device_info)

    serializer = UserSerializer(user)
    token_serializer = SOSTokenObtainPairSerializer()
    token = token_serializer.__class__.get_token(user)

    access_token = str(token.access_token)
    refresh_token_str = str(token)

    from apps.authentication.serializers import SOSTokenObtainPairSerializer as SerializerClass
    from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

    role_mappings = user.role_mappings.filter(is_active=True).select_related('tenant')
    tenants = []
    roles = []
    seen = set()
    for mapping in role_mappings:
        if mapping.tenant_id not in seen:
            seen.add(mapping.tenant_id)
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

    response = Response({
        'access': access_token,
        'session_id': str(session.id),
        'device': device_info,
        'sessions_killed': killed,
        'user': {
            'id': str(user.id),
            'email': user.email,
            'full_name': user.full_name,
            'first_name': user.first_name,
            'middle_name': user.middle_name,
            'last_name': user.last_name,
            'default_language': user.default_language,
            'email_alerts': user.email_alerts,
            'sms_alerts': user.sms_alerts,
            'is_platform_admin': user.is_platform_admin,
            'must_change_password': user.must_change_password,
        },
        'roles': roles,
        'tenants': tenants,
        'must_change_password': user.must_change_password,
    }, status=status.HTTP_200_OK)

    response = _set_refresh_cookie(response, refresh_token_str)
    return response


class SOSTokenRefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Refresh JWT access token.
    Reads refresh token from HttpOnly cookie if not in request body.
    Rejects tokens whose UserSession has been terminated, or tokens
    issued before a password change.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        if 'refresh' not in request.data and request.COOKIES.get('refresh_token'):
            request.data['refresh'] = request.COOKIES['refresh_token']

        refresh_token_str = request.data.get('refresh')
        session = None

        if refresh_token_str:
            # H1: reject if the owning session has been deactivated
            token_hash = _hash_refresh_token(refresh_token_str)
            session = UserSession.objects.filter(refresh_token_hash=token_hash).first()
            if session is None or not session.is_active:
                raise InvalidToken(
                    'Your session has been terminated. Please log in again.',
                    code='session_terminated',
                )

            # H2: reject if the password changed after this token was issued
            try:
                token = RefreshToken(refresh_token_str)
                iat = token.payload.get('iat')
                user = User.objects.get(id=token.payload.get('user_id'))
                if iat and user.password_changed_at:
                    token_issued = timezone.datetime.fromtimestamp(
                        iat, tz=timezone.get_current_timezone()
                    )
                    if user.password_changed_at > token_issued:
                        raise InvalidToken(
                            'Password has been changed. Please log in again.',
                            code='password_changed',
                        )
            except (User.DoesNotExist, InvalidToken):
                raise
            except Exception:
                raise InvalidToken('Invalid refresh token.', code='token_invalid')

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200 and 'refresh' in response.data:
            refresh = response.data.pop('refresh')
            response = _set_refresh_cookie(response, refresh)

            # Track the rotated token so logout/session-kill can still find it
            if session is not None and refresh:
                UserSession.objects.filter(id=session.id).update(
                    refresh_token_hash=_hash_refresh_token(refresh)
                )

        return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    POST /api/v1/auth/logout/
    Blacklist the refresh token and deactivate the session.
    """
    try:
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
            token_hash = _hash_refresh_token(refresh_token)
            UserSession.objects.filter(
                user=request.user,
                refresh_token_hash=token_hash,
                is_active=True,
            ).update(is_active=False)

        response = Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        response = _delete_refresh_cookie(response)
        return response
    except Exception:
        response = Response({'message': 'Logged out.'}, status=status.HTTP_200_OK)
        response = _delete_refresh_cookie(response)
        return response


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    GET /api/v1/auth/me/ — Returns the current user's profile with roles.
    PATCH /api/v1/auth/me/ — Update current user's profile fields.
    """
    if request.method == 'PATCH':
        user = request.user
        allowed_fields = ['first_name', 'middle_name', 'last_name', 'phone', 'email', 'default_language', 'email_alerts', 'sms_alerts', 'profile_photo']
        for field in allowed_fields:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        serializer = UserSerializer(user)
        return Response(serializer.data)

    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sessions_view(request):
    """
    GET /api/v1/auth/sessions/
    List all active sessions for the current user.
    """
    sessions = UserSession.objects.filter(user=request.user, is_active=True)
    data = [
        {
            'id': str(s.id),
            'device_name': s.device_name or 'Unknown device',
            'device_type': s.device_type,
            'browser': s.browser,
            'os': s.os,
            'ip_address': s.ip_address or 'Unknown',
            'login_at': s.login_at.isoformat(),
            'last_activity_at': s.last_activity_at.isoformat(),
            'is_current': False,
        }
        for s in sessions
    ]

    current_session_id = request.data.get('session_id') or request.query_params.get('session_id')
    if current_session_id:
        for s in data:
            if s['id'] == current_session_id:
                s['is_current'] = True
                break

    return Response({'active_sessions': data, 'count': len(data)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def kill_session_view(request, session_id):
    """
    POST /api/v1/auth/sessions/{session_id}/kill/
    Kill a specific active session.
    """
    try:
        session = UserSession.objects.get(id=session_id, user=request.user, is_active=True)
    except UserSession.DoesNotExist:
        return Response({'detail': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

    session.is_active = False
    session.save(update_fields=['is_active'])

    return Response({'message': 'Session terminated.', 'session_id': session_id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def kill_all_sessions_view(request):
    """
    POST /api/v1/auth/sessions/kill-all/
    Kill all active sessions except the current one.
    """
    current_session_id = request.data.get('session_id')
    killed = _deactivate_user_sessions(request.user, exclude_session_id=current_session_id)

    return Response({'message': f'{killed} session(s) terminated.', 'killed': killed})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    POST /api/v1/auth/change-password/
    Authenticated user changes their own password.
    Kills all other sessions on success.
    Requires: old_password, new_password
    """
    from apps.authentication.serializers import check_password_breach
    from django.contrib.auth.password_validation import validate_password as django_validate_password

    old_password = request.data.get('old_password', '')
    new_password = request.data.get('new_password', '')

    if not old_password or not new_password:
        return Response({'detail': 'Both old_password and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
        return Response({'detail': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    try:
        django_validate_password(new_password, user=user)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    if check_password_breach(new_password):
        return Response({'detail': 'This password has appeared in data breaches. Please choose a different password.'}, status=status.HTTP_400_BAD_REQUEST)

    if not user.check_password(old_password):
        return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.password_changed_at = timezone.now()
    user.must_change_password = False
    user.save(update_fields=['password', 'password_changed_at', 'must_change_password'])

    killed = _deactivate_user_sessions(user)

    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        tokens = OutstandingToken.objects.filter(user=user)
        for token in tokens:
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass

    return Response({
        'message': 'Password changed successfully.',
        'sessions_terminated': killed,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_photo_view(request):
    """
    POST /api/v1/auth/upload-photo/
    Upload a profile photo. Returns the URL to the saved image.
    """
    if 'photo' not in request.FILES:
        return Response({'detail': 'No photo provided.'}, status=status.HTTP_400_BAD_REQUEST)

    photo = request.FILES['photo']
    ext = os.path.splitext(photo.name)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
        return Response({'detail': 'Unsupported file type. Use JPG, PNG, WebP, or GIF.'}, status=status.HTTP_400_BAD_REQUEST)

    if photo.size > 5 * 1024 * 1024:
        return Response({'detail': 'File too large. Maximum size is 5MB.'}, status=status.HTTP_400_BAD_REQUEST)

    upload_dir = os.path.join(settings.MEDIA_ROOT, 'profile_photos')
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, 'wb+') as dest:
        for chunk in photo.chunks():
            dest.write(chunk)

    photo_url = f"media/profile_photos/{filename}"

    user = request.user
    user.profile_photo = photo_url
    user.save(update_fields=['profile_photo'])

    serializer = UserSerializer(user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request_view(request):
    """
    POST /api/v1/auth/password-reset-request/
    Request a password reset email for the given email address.
    """
    email = request.data.get('email')
    if not email:
        return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'detail': 'If an account exists with that email, you will receive a reset link.'}, status=status.HTTP_200_OK)

    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    frontend_url = settings.FRONTEND_URL
    reset_url = f"{frontend_url}/reset-password/{uid}/{token}/"

    subject = "Password Reset Request - School OS"
    message = f"""
    Hello {user.get_full_name() or user.email},

    You requested a password reset for your School OS account. Click the link below to reset your password:
    {reset_url}

    This link will expire in 1 hour.

    If you did not request this, please ignore this email.
    """

    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return Response({'detail': 'If an account exists with that email, you will receive a reset link.'}, status=status.HTTP_200_OK)
    except Exception:
        return Response({'detail': 'Failed to send email. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm_view(request):
    """
    POST /api/v1/auth/password-reset-confirm/
    Confirm password reset with uid and token, and set new password.
    Kills all existing sessions on success.
    """
    from apps.authentication.serializers import check_password_breach
    from django.contrib.auth.password_validation import validate_password as django_validate_password

    uid = request.data.get('uid')
    token = request.data.get('token')
    password = request.data.get('password')

    if not all([uid, token, password]):
        return Response({'detail': 'UID, token, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 8:
        return Response({'detail': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

    if check_password_breach(password):
        return Response({'detail': 'This password has appeared in data breaches. Please choose a different password.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        uid_str = urlsafe_base64_decode(uid).decode()
        user = User.objects.get(pk=uid_str)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({'detail': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        django_validate_password(password, user=user)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.password_changed_at = timezone.now()
    user.must_change_password = False
    user.save(update_fields=['password', 'password_changed_at', 'must_change_password'])

    killed = _deactivate_user_sessions(user)

    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        tokens = OutstandingToken.objects.filter(user=user)
        for t in tokens:
            BlacklistedToken.objects.get_or_create(token=t)
    except Exception:
        pass

    return Response({
        'detail': 'Password has been reset successfully.',
        'sessions_terminated': killed,
    }, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user management.

    POST /users/ — Create user (Admin)
    GET /users/ — List users in tenant
    GET /users/{id}/ — User details
    PATCH /users/{id}/ — Update user
    """
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            return User.objects.filter(
                role_mappings__tenant_id=tenant_id,
                role_mappings__is_active=True,
            ).distinct()
        if self.request.user.is_platform_admin:
            return User.objects.all()
        return User.objects.none()

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'assign_role']:
            return [IsSchoolAdmin()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """POST /users/ — create user; returns the temporary password on screen
        (email delivery is not configured, so the admin must share it manually)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        headers = self.get_success_headers(serializer.data)
        response_data = UserSerializer(user, context=self.get_serializer_context()).data
        response_data['temp_password'] = serializer.validated_data.get('password')
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def assign_role(self, request, id=None):
        """POST /users/{id}/assign-role/ — Assign role within tenant (admin only)."""
        user = self.get_object()
        tenant_id = request.tenant_id
        if not tenant_id:
            return Response({'detail': 'Tenant context required.'}, status=status.HTTP_400_BAD_REQUEST)

        requested_role = request.data.get('role')
        if requested_role not in UserRoleMapping.Role.values:
            return Response({'detail': 'Invalid role.'}, status=status.HTTP_400_BAD_REQUEST)

        # Privilege escalation guard: only platform admin / super_admin can grant admin roles.
        assigner_is_super = (
            request.user.is_platform_admin
            or request.user.role_mappings.filter(
                tenant_id=tenant_id,
                role='super_admin',
                is_active=True,
            ).exists()
        )
        if requested_role in ('admin', 'super_admin') and not assigner_is_super:
            return Response(
                {'detail': 'You do not have permission to assign admin roles.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = UserRoleMappingSerializer(data={
            'user': str(user.id),
            'tenant': tenant_id,
            'role': requested_role,
        })
        serializer.is_valid(raise_exception=True)
        serializer.save(assigned_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsSchoolAdmin])
    def reset_password(self, request, id=None):
        """
        POST /users/{id}/reset-password/
        Admin resets a user's password. Kills all user sessions on success.
        """
        user = self.get_object()

        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(secrets.choice(alphabet) for _ in range(12))

        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.must_change_password = True
        user.save(update_fields=['password', 'password_changed_at', 'must_change_password'])

        killed = _deactivate_user_sessions(user)

        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            tokens = OutstandingToken.objects.filter(user=user)
            for t in tokens:
                BlacklistedToken.objects.get_or_create(token=t)
        except Exception:
            pass

        frontend_url = settings.FRONTEND_URL
        subject = "Your School OS Password Has Been Reset"
        message = (
            f"Hello {user.full_name},\n\n"
            f"Your School OS password has been reset by an administrator.\n\n"
            f"Your new temporary password is: {new_password}\n\n"
            f"Please log in at {frontend_url} and change your password immediately.\n\n"
            f"If you did not request this change, please contact your school administrator."
        )
        try:
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
        except Exception:
            pass

        return Response({
            "message": f"Password reset for {user.full_name}. Temporary password sent to {user.email}.",
            "temporary_password": new_password,
            "must_change_password": True,
            "sessions_terminated": killed,
            "user": {
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
            }
        }, status=status.HTTP_200_OK)
