from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchemeOfWorkViewSet, LogbookEntryViewSet,
    CurriculumModuleViewSet, CurriculumLessonViewSet
)

router = DefaultRouter()
router.register(r'schemes', SchemeOfWorkViewSet, basename='schemes')
router.register(r'entries', LogbookEntryViewSet, basename='entries')
router.register(r'modules', CurriculumModuleViewSet, basename='modules')
router.register(r'lessons', CurriculumLessonViewSet, basename='lessons')

urlpatterns = [
    path('', include(router.urls)),
]
