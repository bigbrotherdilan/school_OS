from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.government.views import (
    export_ministry_report, recalculate_compliance,
    NationalDashboardAPIView, MonitoringAPIView,
    InspectionViewSet, InspectionFindingViewSet,
    CorrectiveActionViewSet, InspectionDocumentViewSet,
    InspectionScheduleViewSet, InspectorDashboardAPIView
)

router = DefaultRouter()
router.register('inspections', InspectionViewSet, basename='inspection')
router.register('findings', InspectionFindingViewSet, basename='finding')
router.register('corrective-actions', CorrectiveActionViewSet, basename='corrective-action')
router.register('documents', InspectionDocumentViewSet, basename='inspection-document')
router.register('schedules', InspectionScheduleViewSet, basename='inspection-schedule')

urlpatterns = [
    path('', include(router.urls)),
    path('export/', export_ministry_report, name='ministry-export'),
    path('recalculate/', recalculate_compliance, name='recalculate-compliance'),
    path('dashboard/', NationalDashboardAPIView.as_view(), name='national-dashboard'),
    path('monitoring/', MonitoringAPIView.as_view(), name='gov-monitoring'),
    path('inspector-dashboard/', InspectorDashboardAPIView.as_view(), name='inspector-dashboard'),
]