from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, DocumentCategoryViewSet, IDCardTemplateViewSet, GeneratedIDCardViewSet

router = DefaultRouter()
router.register(r'files', DocumentViewSet, basename='documents')
router.register(r'categories', DocumentCategoryViewSet, basename='document-categories')
router.register(r'id-card-templates', IDCardTemplateViewSet, basename='id-card-templates')
router.register(r'id-cards', GeneratedIDCardViewSet, basename='id-cards')

urlpatterns = [
    path('', include(router.urls)),
]
