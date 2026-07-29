from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.tenants.models import Tenant, TenantConfig
from apps.authentication.permissions import IsPlatformAdmin
from apps.tenants.serializers import (
    TenantSerializer,
    TenantListSerializer,
    TenantThemeSerializer,
    TenantConfigSerializer,
)


class TenantViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing school tenants.
    
    POST /tenants/ — Create school (SuperAdmin only)
    GET /tenants/ — List schools
    GET /tenants/{id}/ — School details
    PATCH /tenants/{id}/ — Update school config
    POST /tenants/{id}/theme/ — Update branding
    """
    queryset = Tenant.objects.all()
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.action == 'list':
            return TenantListSerializer
        return TenantSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'config', 'school_config']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsPlatformAdmin()]

    def perform_create(self, serializer):
        serializer.save(status='active')

    @action(detail=True, methods=['post', 'patch'])
    def theme(self, request, id=None):
        """Update tenant theme and branding."""
        tenant = self.get_object()
        serializer = TenantThemeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if 'logo_url' in serializer.validated_data:
            tenant.logo_url = serializer.validated_data['logo_url']
        if 'theme_config' in serializer.validated_data:
            tenant.theme_config = serializer.validated_data['theme_config']
        if 'motto' in serializer.validated_data:
            tenant.motto = serializer.validated_data['motto']
        tenant.save()

        return Response(TenantSerializer(tenant).data)

    @action(detail=True, methods=['get'])
    def config(self, request, id=None):
        """Get tenant configuration for frontend theme loading."""
        tenant = self.get_object()
        return Response({
            'id': str(tenant.id),
            'school_name': tenant.school_name,
            'education_type': tenant.education_type,
            'is_bilingual': tenant.is_bilingual,
            'theme': tenant.default_theme,
            'logo_url': tenant.logo_url or '',
            'motto': tenant.motto,
        })

    @action(detail=True, methods=['get', 'patch'])
    def school_config(self, request, id=None):
        """
        GET /tenants/{id}/school-config/ — Returns school-level settings
        PATCH /tenants/{id}/school-config/ — Updates school-level settings
        """
        tenant = self.get_object()
        config = TenantConfig.get_for_tenant(tenant)

        if request.method == 'PATCH':
            serializer = TenantConfigSerializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        return Response(TenantConfigSerializer(config).data)
