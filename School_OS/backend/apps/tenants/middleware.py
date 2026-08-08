"""
Tenant Middleware — Enforces tenant context on every request.
Extracts X-Tenant-ID header and injects tenant into request.
"""
from django.core.cache import cache
from django.core.exceptions import ValidationError
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

# Parent endpoints are global: a parent may view data for their own linked
# children in ANY school, without a role mapping in that school. Access is
# granted only on these paths; everything else still requires a local mapping.
PARENT_GLOBAL_PATHS = [
    '/api/v1/students/parent-dashboard/',
    '/api/v1/students/parent-fees/',
    '/api/v1/students/parent-analytics/',
    '/api/v1/students/parent-payment/',
    '/api/v1/students/parent-child-summary/',
    '/api/v1/students/parent-comparison/',
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

        # Skip tenant enforcement for non-API paths (SPA shell, PWA assets,
        # static files) and the explicitly exempt API routes
        path = request.path
        if not path.startswith('/api/'):
            return self.get_response(request)
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
                except (Tenant.DoesNotExist, ValueError, ValidationError):
                    tenant = None
                if tenant is not None:
                    cache.set(cache_key, tenant, TENANT_CACHE_TTL)

            if tenant is None or tenant.status != Tenant.Status.ACTIVE:
                raise Tenant.DoesNotExist

            request.tenant = tenant
            request.tenant_id = str(tenant.id)
        except (Tenant.DoesNotExist, ValueError, ValidationError):
            return JsonResponse(
                {'error': 'Invalid or inactive tenant.'},
                status=403,
            )

        # Tenant isolation double-check: verify the authenticated user
        # actually has a role in this tenant.
        # Exception: users holding the parent role (any school) may access the
        # parent-scoped endpoints for any tenant — their data is strictly
        # scoped to ParentStudentRelationship(parent_user=request.user).
        if hasattr(request, 'user') and request.user.is_authenticated:
            has_access = request.user.role_mappings.filter(
                tenant_id=tenant_id,
                is_active=True,
            ).exists()
            if not has_access:
                is_global_parent = request.user.role_mappings.filter(
                    role='parent',
                    is_active=True,
                ).exists()
                is_parent_path = any(
                    path.startswith(prefix) for prefix in PARENT_GLOBAL_PATHS
                )
                if not request.user.is_platform_admin and not (is_global_parent and is_parent_path):
                    return JsonResponse(
                        {'error': 'Access denied. You do not belong to this school.'},
                        status=403,
                    )

        return self.get_response(request)
