from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnnouncementViewSet, DirectMessageViewSet, EmailSettingViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r'announcements', AnnouncementViewSet, basename='announcements')
router.register(r'messages', DirectMessageViewSet, basename='messages')
router.register(r'email-settings', EmailSettingViewSet, basename='email-settings')
router.register(r'notifications', NotificationViewSet, basename='notifications')

urlpatterns = [
    path('', include(router.urls)),
]
