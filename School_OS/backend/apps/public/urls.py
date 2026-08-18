from django.urls import path
from . import views

urlpatterns = [
    path('schools/', views.PublicSchoolListView.as_view(), name='public-school-list'),
    path('schools/<slug:slug>/', views.PublicSchoolProfileView.as_view(), name='public-school-profile'),
    path('enrollment/', views.submit_enrollment_inquiry, name='public-enrollment'),
    path('regions/', views.school_regions, name='public-regions'),
    path('teachers/', views.PublicTeacherListView.as_view(), name='public-teacher-list'),
    path('teachers/contact/', views.contact_teacher, name='public-contact-teacher'),
]
