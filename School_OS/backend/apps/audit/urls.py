from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import export_system_audit, AuditLogViewSet

router = DefaultRouter()
router.register(r'logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = [
    path('export/', export_system_audit, name='system-audit-export'),
    path('', include(router.urls)),
]
