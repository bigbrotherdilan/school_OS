from django.contrib import admin
from apps.authentication.models import User, UserRoleMapping


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'first_name', 'last_name', 'is_platform_admin', 'is_active', 'date_joined']
    list_filter = ['is_platform_admin', 'is_active', 'default_language']
    search_fields = ['email', 'first_name', 'last_name']
    readonly_fields = ['id', 'date_joined', 'last_login']


@admin.register(UserRoleMapping)
class UserRoleMappingAdmin(admin.ModelAdmin):
    list_display = ['user', 'tenant', 'role', 'is_active', 'assigned_at']
    list_filter = ['role', 'is_active']
    search_fields = ['user__email', 'tenant__school_name']
