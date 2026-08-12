from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.students.views import (
    StudentViewSet, ParentStudentLinkViewSet, DisciplineRecordViewSet,
    TransferRequestViewSet, PromotionHistoryViewSet, ParentDashboardAPIView,
    ParentFeesView, ParentAnalyticsView, ParentPaymentView,
    ParentChildSummaryView, ParentComparisonView, ParentReceiptListView,
    ParentReceiptDownloadView, ParentStatementView,
    upload_student_photo,
)

router = DefaultRouter()
router.register('students', StudentViewSet, basename='students')
router.register('parent-student-links', ParentStudentLinkViewSet, basename='parent-student-links')
router.register('discipline', DisciplineRecordViewSet, basename='discipline')
router.register('transfers', TransferRequestViewSet, basename='transfers')
router.register('promotions', PromotionHistoryViewSet, basename='promotions')

urlpatterns = [
    path('upload-photo/', upload_student_photo, name='student-upload-photo'),
    path('parent-dashboard/', ParentDashboardAPIView.as_view(), name='parent-dashboard'),
    path('parent-fees/', ParentFeesView.as_view(), name='parent-fees'),
    path('parent-analytics/', ParentAnalyticsView.as_view(), name='parent-analytics'),
    path('parent-payment/', ParentPaymentView.as_view(), name='parent-payment'),
    path('parent-receipts/', ParentReceiptListView.as_view(), name='parent-receipts'),
    path('parent-receipts/download/<uuid:transaction_id>/', ParentReceiptDownloadView.as_view(), name='parent-receipt-download'),
    path('parent-receipts/statement/<uuid:invoice_id>/', ParentStatementView.as_view(), name='parent-receipt-statement'),
    path('parent-child-summary/<uuid:student_id>/', ParentChildSummaryView.as_view(), name='parent-child-summary'),
    path('parent-comparison/', ParentComparisonView.as_view(), name='parent-comparison'),
    path('', include(router.urls)),
]
