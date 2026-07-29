from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'user', 'action', 'module', 'endpoint', 'status_code', 'ip_address']
    list_filter = ['action', 'module', 'status_code', 'created_at']
    search_fields = ['description', 'endpoint', 'user__email']
    readonly_fields = [
        'id', 'user', 'tenant_id', 'action', 'module', 'object_type', 'object_id',
        'description', 'endpoint', 'method', 'status_code', 'ip_address', 'metadata', 'created_at',
    ]
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
