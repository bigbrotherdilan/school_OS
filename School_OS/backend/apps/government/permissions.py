from rest_framework import permissions

class IsGovernmentOfficial(permissions.BasePermission):
    """
    Allows access only to government officials.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'is_government_official', False))
