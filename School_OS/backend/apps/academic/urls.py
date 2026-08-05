from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.academic.views import (
    AcademicYearViewSet, TermViewSet, SequenceViewSet, CycleViewSet,
    SectionViewSet, SeriesViewSet, ClassViewSet,
    SubjectViewSet, ClassSubjectViewSet, SectionSubjectViewSet,
)

router = DefaultRouter()
router.register('academic-years', AcademicYearViewSet, basename='academic-years')
router.register('terms', TermViewSet, basename='academic-terms')
router.register('sequences', SequenceViewSet, basename='academic-sequences')
router.register('cycles', CycleViewSet, basename='academic-cycles')
router.register('sections', SectionViewSet, basename='academic-sections')
router.register('series', SeriesViewSet, basename='academic-series')
router.register('classes', ClassViewSet, basename='academic-classes')
router.register('subjects', SubjectViewSet, basename='academic-subjects')
router.register('class-subjects', ClassSubjectViewSet, basename='academic-class-subjects')
router.register('section-subjects', SectionSubjectViewSet, basename='academic-section-subjects')

urlpatterns = [
    path('', include(router.urls)),
]
