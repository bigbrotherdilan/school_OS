from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.staff.views import TeacherViewSet, TeachingAssignmentViewSet, LeaveRequestViewSet, PerformanceReviewViewSet, onboard_bursar, onboard_parent

router = DefaultRouter()
router.register('teachers', TeacherViewSet, basename='teachers')
router.register('assignments', TeachingAssignmentViewSet, basename='teaching-assignments')
router.register('leave-requests', LeaveRequestViewSet, basename='leave-requests')
router.register('performance-reviews', PerformanceReviewViewSet, basename='performance-reviews')

urlpatterns = [
    path('bursars/onboard/', onboard_bursar, name='bursar-onboard'),
    path('parents/onboard/', onboard_parent, name='parent-onboard'),
    path('', include(router.urls)),
]
