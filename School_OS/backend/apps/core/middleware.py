"""
Security Middleware — Adds additional security headers.
"""
import re
import uuid
from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone
from django.conf import settings
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import AccessToken


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Adds security headers to all responses:
    - Permissions-Policy: Controls browser features
    - Cross-Origin-Opener-Policy: Isolates browsing context
    - Cross-Origin-Embedder-Policy: Requires explicit permission for cross-origin resources
    """

    def process_response(self, request, response):
        # Permissions Policy - restrict browser features
        # Disable features not needed by the application
        permissions_policy = (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=(), "
            "interest-cohort=(), "
            "display-capture=(), "
            "fullscreen=(), "
            "picture-in-picture=(), "
            "web-share=()"
        )
        response['Permissions-Policy'] = permissions_policy

        # Cross-Origin-Opener-Policy - helps prevent cross-origin attacks
        if 'Cross-Origin-Opener-Policy' not in response:
            response['Cross-Origin-Opener-Policy'] = 'same-origin'

        # Cross-Origin-Embedder-Policy - requires CORP for cross-origin resources
        if 'Cross-Origin-Embedder-Policy' not in response:
            response['Cross-Origin-Embedder-Policy'] = 'require-corp'

        # Referrer-Policy - controlled via SECURE_REFERRER_POLICY in settings
        # but ensure it's set for all responses
        if 'Referrer-Policy' not in response:
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # X-Content-Type-Options - prevent MIME type sniffing
        if 'X-Content-Type-Options' not in response:
            response['X-Content-Type-Options'] = 'nosniff'

        # X-Frame-Options - prevent clickjacking
        if 'X-Frame-Options' not in response:
            response['X-Frame-Options'] = 'DENY'

        # X-XSS-Protection - enable XSS filtering (legacy but still useful)
        if 'X-XSS-Protection' not in response:
            response['X-XSS-Protection'] = '1; mode=block'

        # Content-Security-Policy - restrict resource loading
        if 'Content-Security-Policy' not in response:
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://api.pwnedpasswords.com; "
                "font-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )

        return response


class RequestIDMiddleware(MiddlewareMixin):
    """
    Adds a unique Request-ID header to all requests and responses.
    Useful for distributed tracing and debugging.
    """
    
    def process_request(self, request):
        # Sanitize incoming request ID — must be alphanumeric/dash, 1-64 chars
        request_id = request.META.get('HTTP_X_REQUEST_ID', '')
        if not request_id or not re.match(r'^[a-zA-Z0-9\-]{1,64}$', request_id):
            request_id = uuid.uuid4().hex[:16]
        request.request_id = request_id
        request.META['HTTP_X_REQUEST_ID'] = request_id
        return None
    
    def process_response(self, request, response):
        # Add request ID to response headers
        request_id = getattr(request, 'request_id', uuid.uuid4().hex[:16])
        response['X-Request-ID'] = request_id
        return response


class FinanceSessionMiddleware(MiddlewareMixin):
    """
    Enforces a shorter token lifetime for finance endpoints.
    If the access token was issued more than FINANCE_TOKEN_MAX_AGE ago,
    the request is rejected with a 401, requiring re-authentication.
    """

    FINANCE_PATHS = [
        '/api/v1/finance/',
    ]

    def process_request(self, request):
        path = request.path
        is_finance = any(path.startswith(p) for p in self.FINANCE_PATHS)
        if not is_finance:
            return None

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        try:
            token_str = auth_header.split(' ', 1)[1]
            token = AccessToken(token_str)
            iat = token.get('iat')
            if iat:
                token_issued = timezone.datetime.fromtimestamp(
                    iat, tz=timezone.get_current_timezone()
                )
                max_age = getattr(settings, 'FINANCE_TOKEN_MAX_AGE', None)
                if max_age and (timezone.now() - token_issued) > max_age:
                    from django.http import JsonResponse
                    return JsonResponse(
                        {
                            'detail': 'Finance session has expired. Please log in again.',
                            'code': 'finance_session_expired',
                        },
                        status=401,
                    )
        except Exception:
            pass

        return None