"""
Tenant Middleware — Enforces tenant context on every request.
Extracts X-Tenant-ID header and injects tenant into request.
"""
from django.core.cache import cache
from django.http import JsonResponse
from apps.tenants.models import Tenant

TENANT_CACHE_TTL = 60


# Paths that don't require tenant context
TENANT_EXEMPT_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/tenants',
    '/api/v1/gov/',
    '/api/v1/health',
    '/pub/',
    '/admin/',
    '/static/',
    '/media/',
]


class TenantMiddleware:
    """
    Extracts X-Tenant-ID from request headers and attaches
    the tenant object to request.tenant for downstream use.
    
    All endpoints require tenant context except auth and platform-level routes.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        request.tenant_id = None

        # Skip tenant enforcement for exempt paths
        path = request.path
        if any(path.startswith(exempt) for exempt in TENANT_EXEMPT_PATHS):
            return self.get_response(request)

        # Extract tenant ID from header
        tenant_id = request.headers.get('X-Tenant-ID')

        if not tenant_id:
            return JsonResponse(
                {'error': 'X-Tenant-ID header is required.'},
                status=400,
            )

        try:
            # Cached tenant lookup avoids a DB round-trip on every request.
            # Invalidated via post_save/post_delete signals on Tenant.
            cache_key = f'tenant:{tenant_id}'
            tenant = cache.get(cache_key)
            if tenant is None:
                try:
                    tenant = Tenant.objects.get(id=tenant_id, status='active')
                except (Tenant.DoesNotExist, ValueError):
                    tenant = None
                if tenant is not None:
                    cache.set(cache_key, tenant, TENANT_CACHE_TTL)

            if tenant is None or tenant.status != Tenant.Status.ACTIVE:
                raise Tenant.DoesNotExist

            request.tenant = tenant
            request.tenant_id = str(tenant.id)
        except (Tenant.DoesNotExist, ValueError):
            return JsonResponse(
                {'error': 'Invalid or inactive tenant.'},
                status=403,
            )

        # Tenant isolation double-check: verify the authenticated user
        # actually has a role in this tenant
        if hasattr(request, 'user') and request.user.is_authenticated:
            has_access = request.user.role_mappings.filter(
                tenant_id=tenant_id,
                is_active=True,
            ).exists()
            if not has_access and not request.user.is_platform_admin:
                return JsonResponse(
                    {'error': 'Access denied. You do not belong to this school.'},
                    status=403,
                )

        return self.get_response(request)
