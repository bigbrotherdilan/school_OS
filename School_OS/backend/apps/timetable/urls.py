from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimetableViewSet, TimeSlotViewSet

router = DefaultRouter()
router.register(r'timetables', TimetableViewSet, basename='timetables')
router.register(r'time-slots', TimeSlotViewSet, basename='time-slots')

urlpatterns = [
    path('', include(router.urls)),
]
