from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TimetableViewSet, TimeSlotViewSet, LessonViewSet, TeacherUnavailabilityViewSet,
    StudentGroupViewSet, RoomViewSet, TeacherAllocationViewSet,
)

router = DefaultRouter()
router.register(r'timetables', TimetableViewSet, basename='timetables')
router.register(r'time-slots', TimeSlotViewSet, basename='time-slots')
router.register(r'lessons', LessonViewSet, basename='lessons')
router.register(r'unavailability', TeacherUnavailabilityViewSet, basename='unavailability')
router.register(r'student-groups', StudentGroupViewSet, basename='student-groups')
router.register(r'rooms', RoomViewSet, basename='rooms')
router.register(r'allocations', TeacherAllocationViewSet, basename='allocations')

urlpatterns = [
    path('', include(router.urls)),
]
