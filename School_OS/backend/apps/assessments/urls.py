from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MarkEntryWindowViewSet, ExamViewSet, ExamResultViewSet

router = DefaultRouter()
router.register(r'mark-windows', MarkEntryWindowViewSet, basename='mark-windows')
router.register(r'exams', ExamViewSet, basename='exams')
router.register(r'results', ExamResultViewSet, basename='results')

urlpatterns = [
    path('', include(router.urls)),
]
