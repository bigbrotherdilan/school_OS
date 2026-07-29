from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnnouncementViewSet, DirectMessageViewSet

router = DefaultRouter()
router.register(r'announcements', AnnouncementViewSet, basename='announcements')
router.register(r'messages', DirectMessageViewSet, basename='messages')

urlpatterns = [
    path('', include(router.urls)),
]
