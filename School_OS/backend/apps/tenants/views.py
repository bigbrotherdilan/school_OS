from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from PIL import Image
import os
import uuid
from apps.tenants.models import Tenant, TenantConfig
from apps.authentication.permissions import IsPlatformAdmin, IsSchoolAdmin
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

    def _resolve_tenant_context(self):
        """The tenant middleware skips /api/v1/tenants*, so restore the
        request tenant context from this URL's tenant id. This lets
        tenant-scoped permissions (e.g. IsSchoolAdmin) work on these routes."""
        if getattr(self.request, 'tenant_id', None):
            return
        raw = self.kwargs.get(self.lookup_field)
        if not raw:
            return
        try:
            tenant = Tenant.objects.filter(
                id=raw, status='active'
            ).first()
        except (ValueError, ValidationError):
            return
        if tenant is not None:
            self.request.tenant = tenant
            self.request.tenant_id = str(tenant.id)

    def get_permissions(self):
        self._resolve_tenant_context()
        if self.action in ['list', 'retrieve', 'config']:
            return [IsAuthenticated()]
        if self.action in ['theme', 'logo', 'school_info']:
            return [IsAuthenticated(), IsSchoolAdmin()]
        if self.action == 'school_config':
            if self.request.method == 'PATCH':
                return [IsAuthenticated(), IsSchoolAdmin()]
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsPlatformAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return TenantListSerializer
        return TenantSerializer

    def get_object(self):
        self._resolve_tenant_context()
        return super().get_object()

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

    @action(detail=True, methods=['post'])
    def logo(self, request, id=None):
        """
        Upload a school logo to object storage (S3-compatible bucket).
        Only the resulting URL is stored in the database.
        POST /tenants/{id}/logo/  (multipart 'file')
        """
        tenant = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            img = Image.open(file)
            img.verify()
        except Exception:
            return Response(
                {'detail': 'Upload a valid image file (PNG, JPG, WebP, GIF or SVG).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file.seek(0)

        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'):
            ext = '.png'

        fname = f'{tenant.slug}-{uuid.uuid4().hex[:10]}{ext}'
        path = default_storage.save(f'logos/{fname}', file)
        tenant.logo_url = default_storage.url(path)
        tenant.save()

        return Response({
            'logo_url': tenant.logo_url,
            'logo_path': path,
        })

    @action(detail=True, methods=['get', 'patch'])
    def school_info(self, request, id=None):
        """
        GET  /tenants/{id}/school-info/ — Return editable school fields.
        PATCH /tenants/{id}/school-info/ — Update school name, motto,
               contact info, school_type, session_type, etc.
        """
        tenant = self.get_object()

        if request.method == 'PATCH':
            allowed = [
                'school_name', 'motto', 'phone', 'email', 'address',
                'region', 'division', 'country', 'postal_code',
                'school_type', 'session_type', 'education_type',
            ]
            for field in allowed:
                if field in request.data:
                    setattr(tenant, field, request.data[field])
            try:
                tenant.full_clean()
                tenant.save()
            except ValidationError as e:
                return Response({'detail': e.message_dict}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TenantSerializer(tenant).data)

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
