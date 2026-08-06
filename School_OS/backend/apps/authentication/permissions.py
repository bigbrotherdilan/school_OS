"""
Authentication Permissions — RBAC for School OS
"""
from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """Only platform-level super admins."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_platform_admin
        )


class IsSchoolAdmin(BasePermission):
    """User must be an admin for the current tenant."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_platform_admin:
            return True
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return False
        return request.user.role_mappings.filter(
            tenant_id=tenant_id,
            role__in=['admin', 'super_admin'],
            is_active=True,
        ).exists()


class IsSchoolAdminOrBursar(BasePermission):
    """User must be an admin or bursar for the current tenant (finance treasury access)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_platform_admin:
            return True
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return False
        return request.user.role_mappings.filter(
            tenant_id=tenant_id,
            role__in=['admin', 'super_admin', 'bursar'],
            is_active=True,
        ).exists()


class IsTeacher(BasePermission):
    """User must be a teacher for the current tenant."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_platform_admin:
            return True
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return False
        return request.user.role_mappings.filter(
            tenant_id=tenant_id,
            role='teacher',
            is_active=True,
        ).exists()


class IsParent(BasePermission):
    """User must be a parent for the current tenant."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return False
        return request.user.role_mappings.filter(
            tenant_id=tenant_id,
            role='parent',
            is_active=True,
        ).exists()


class IsGovernment(BasePermission):
    """User must have government/ministry role."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role_mappings.filter(
            role='government',
            is_active=True,
        ).exists()


class IsSchoolMember(BasePermission):
    """User must have any role in the current tenant."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_platform_admin:
            return True
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return False
        return request.user.role_mappings.filter(
            tenant_id=tenant_id,
            is_active=True,
        ).exists()


class IsAdminOrTeacher(BasePermission):
    """User must be admin or teacher for the current tenant."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_platform_admin:
            return True
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            return False
        return request.user.role_mappings.filter(
            tenant_id=tenant_id,
            role__in=['admin', 'teacher', 'super_admin'],
            is_active=True,
        ).exists()
