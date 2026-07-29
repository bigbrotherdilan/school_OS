from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchoolPerformanceReportViewSet, year_review, school_comparison
from .report_card_views import ReportCardViewSet, ReportCardTemplateViewSet
from .analytics_views import (
    exam_performance_overview,
    subject_performance_detail,
    class_performance_detail,
    teacher_analytics_summary,
    analytics_metadata,
)

router = DefaultRouter()
router.register(r'performance', SchoolPerformanceReportViewSet, basename='performance-reports')

report_card_router = DefaultRouter()
report_card_router.register(r'report-cards', ReportCardViewSet, basename='report-cards')
report_card_router.register(r'report-card-templates', ReportCardTemplateViewSet, basename='report-card-templates')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(report_card_router.urls)),
    path('year-review/', year_review, name='year-review'),
    path('comparison/', school_comparison, name='school-comparison'),
    # Analytics endpoints
    path('analytics/exam-performance/', exam_performance_overview, name='exam-performance'),
    path('analytics/subject-performance/', subject_performance_detail, name='subject-performance'),
    path('analytics/class-performance/', class_performance_detail, name='class-performance'),
    path('analytics/teacher-summary/', teacher_analytics_summary, name='teacher-summary'),
    path('analytics/metadata/', analytics_metadata, name='analytics-metadata'),
]
