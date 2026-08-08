from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
import csv
from datetime import datetime
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.authentication.permissions import IsSchoolAdminOrBursar


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve audit logs."""
    serializer_class = AuditLogSerializer
    permission_classes = [IsSchoolAdminOrBursar]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = AuditLog.objects.select_related('user')
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        # Filter by module
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)
        # Search
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(description__icontains=search) |
                Q(user__email__icontains=search) |
                Q(endpoint__icontains=search)
            )
        return qs


@api_view(['GET'])
@permission_classes([IsSchoolAdminOrBursar])
def export_system_audit(request):
    """
    Export System Audit logs as CSV.
    """
    tenant_id = request.tenant_id
    qs = AuditLog.objects.all()

    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)

    # Date range filtering
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    # Module filtering
    module = request.query_params.get('module')
    if module:
        qs = qs.filter(module=module)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="system_audit_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'

    writer = csv.writer(response)
    writer.writerow(['Timestamp', 'User', 'Action', 'Module', 'Endpoint', 'Method', 'Status Code', 'IP Address', 'Description'])

    for log in qs[:5000]:  # Limit to 5000 rows for CSV export
        writer.writerow([
            log.created_at.isoformat(),
            log.user.email if log.user else 'System',
            log.action,
            log.module,
            log.endpoint,
            log.method,
            log.status_code or '',
            log.ip_address or '',
            log.description,
        ])

    return response
