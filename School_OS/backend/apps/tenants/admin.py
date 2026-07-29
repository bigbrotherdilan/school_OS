from django.contrib import admin
from apps.tenants.models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ['school_name', 'education_type', 'region', 'status', 'created_at']
    list_filter = ['education_type', 'status', 'region']
    search_fields = ['school_name', 'slug']
    readonly_fields = ['id', 'created_at', 'updated_at']
