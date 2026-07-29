from django.urls import path
from .views import export_ministry_report, recalculate_compliance, NationalDashboardAPIView, MonitoringAPIView

urlpatterns = [
    path('export/', export_ministry_report, name='ministry-export'),
    path('recalculate/', recalculate_compliance, name='recalculate-compliance'),
    path('dashboard/', NationalDashboardAPIView.as_view(), name='national-dashboard'),
    path('monitoring/', MonitoringAPIView.as_view(), name='gov-monitoring'),
]
