"""
Core Views — System health check and infrastructure status.
Deep health check for load balancers, uptime monitors, and ops dashboards.
"""
import os
import time
import logging

from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection

logger = logging.getLogger(__name__)


class BaseTenantViewSet(viewsets.ModelViewSet):
    """
    Abstract ViewSet to enforce tenant filtering and ownership.
    All data access is scoped to the current tenant.
    """
    from apps.authentication.permissions import IsSchoolAdmin
    permission_classes = [IsSchoolAdmin]
    lookup_field = 'id'
    allow_delete = True

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return self.queryset.none()
        return self.queryset.filter(tenant_id=tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)

    def perform_update(self, serializer):
        instance = self.get_object()
        if str(instance.tenant_id) != self.request.tenant_id:
            raise PermissionDenied('You do not have permission to modify this resource.')
        serializer.save()

    def perform_destroy(self, instance):
        if not self.allow_delete:
            raise PermissionDenied(
                'Deletion is not allowed for this resource. '
                'Use cancellation or deactivation instead.'
            )
        if str(instance.tenant_id) != self.request.tenant_id:
            raise PermissionDenied('You do not have permission to delete this resource.')
        instance.delete()


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Deep health check for load balancers and monitoring."""
    checks = {}
    healthy = True

    # Database check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {str(e)}'
        healthy = False

    # Redis check (optional — only if REDIS_URL is configured and redis lib available)
    redis_url = os.environ.get('REDIS_URL', '') or os.environ.get('CACHE_REDIS_URL', '')
    if redis_url:
        try:
            import redis as redis_lib
            r = redis_lib.from_url(redis_url)
            r.ping()
            checks['redis'] = 'ok'
        except ImportError:
            checks['redis'] = 'warning: redis library not installed'
        except Exception as e:
            checks['redis'] = f'warning: {str(e)}'

    status_code = 200 if healthy else 503
    return Response({
        'status': 'healthy' if healthy else 'degraded',
        'checks': checks,
        'timestamp': time.time(),
    }, status=status_code)
