"""
School OS — Main URL Configuration
API-First Architecture: All endpoints under /api/v1/
"""
import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve as static_serve

FRONTEND_DIST = settings.BASE_DIR.parent / 'frontend' / 'dist'


urlpatterns = [
    # Django Admin
    path('admin/', admin.site.urls),

    # API v1 — Deep health check
    path('api/v1/', include('apps.core.urls')),
    path('api/v1/', include('apps.authentication.urls')),
    path('api/v1/tenants/', include('apps.tenants.urls')),

    # Future API routes (will be added in subsequent phases)
    path('api/v1/academic/', include('apps.academic.urls')),
    path('api/v1/students/', include('apps.students.urls')),
    path('api/v1/staff/', include('apps.staff.urls')),
    path('api/v1/timetable/', include('apps.timetable.urls')),
    path('api/v1/logbook/', include('apps.logbook.urls')),
    path('api/v1/assessments/', include('apps.assessments.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/finance/', include('apps.finance.urls')),
    path('api/v1/attendance/', include('apps.attendance.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/gov/', include('apps.government.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),

    # Public API — no auth required, uses different prefix for security
    path('pub/v1/', include('apps.public.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Serve frontend assets (JS, CSS, images) from Vite build
if FRONTEND_DIST.exists():
    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', static_serve, {'document_root': str(FRONTEND_DIST / 'assets')}),
        # PWA root files: service worker, manifest, favicon and icons
        re_path(r'^(?P<path>(?:icons/.*|apple-touch-icon\.png|manifest\.json|sw\.js|favicon\.svg))$',
                static_serve, {'document_root': str(FRONTEND_DIST)}),
    ]

# Catch-all: serve React index.html for any non-API, non-admin route
if os.path.exists(FRONTEND_DIST / 'index.html'):
    urlpatterns += [
        re_path(r'^(?!api/|pub/|admin/|media/|static/|assets/).*$', TemplateView.as_view(template_name='index.html'), name='catch-all'),
    ]

# Customize Django admin
admin.site.site_header = 'School OS Administration'
admin.site.site_title = 'School OS'
admin.site.index_title = 'Platform Management'
