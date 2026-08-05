"""
School OS (SOS) — Django Settings
National Multi-Tenant Education Operating System
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY environment variable is required.")

DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() == 'true'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# ──────────────────────────────────────────────
# Application Definition
# ──────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    # SOS Apps
    'apps.core.apps.CoreConfig',
    'apps.authentication.apps.AuthenticationConfig',
    'apps.tenants.apps.TenantsConfig',
    'apps.academic.apps.AcademicConfig',
    'apps.students.apps.StudentsConfig',
    'apps.staff.apps.StaffConfig',
    'apps.timetable.apps.TimetableConfig',
    'apps.logbook.apps.LogbookConfig',
    'apps.assessments.apps.AssessmentsConfig',
    'apps.reports.apps.ReportsConfig',
    'apps.finance.apps.FinanceConfig',
    'apps.attendance.apps.AttendanceConfig',
    'apps.notifications.apps.NotificationsConfig',
    'apps.documents.apps.DocumentsConfig',
    'apps.government.apps.GovernmentConfig',
    'apps.audit.apps.AuditConfig',
    'apps.public.apps.PublicConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'apps.core.middleware.SecurityHeadersMiddleware',
    'apps.core.middleware.RequestIDMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # SOS Custom Middleware
    'apps.tenants.middleware.TenantMiddleware',
    'apps.core.middleware.FinanceSessionMiddleware',
    'apps.audit.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates', BASE_DIR.parent / 'frontend' / 'dist'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ──────────────────────────────────────────────
# Database — PostgreSQL in production, SQLite in dev
# ──────────────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    # Parse postgres://user:pass@host:port/db into Django format
    import urllib.parse
    url = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': url.path[1:],
            'USER': url.username or '',
            'PASSWORD': url.password or '',
            'HOST': url.hostname or 'localhost',
            'PORT': url.port or '5432',
            # Keep DB connections alive across requests. Critical for the
            # mark-entry burst (all teachers submitting within the same days):
            # otherwise every request pays a fresh connection + auth handshake.
            'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', '60')),
            'CONN_HEALTH_CHECKS': True,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ──────────────────────────────────────────────
# Caching — LocMemCache by default, Redis in production
# Every cache miss on the hot paths (tenant resolution, analytics metadata,
# public school pages, auto-save reads) is a DB round-trip we can avoid.
# ──────────────────────────────────────────────
CACHE_REDIS_URL = os.environ.get('CACHE_REDIS_URL')
if CACHE_REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': os.environ.get(
                'DJANGO_CACHE_BACKEND', 'django_redis.cache.RedisCache'),
            'LOCATION': CACHE_REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'PARSER_CLASS': 'redis.connection.HiredisParser',
            },
            'TIMEOUT': 300,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'school-os-cache',
            'TIMEOUT': 300,
        }
    }

# ──────────────────────────────────────────────
# Custom User Model
# ──────────────────────────────────────────────
AUTH_USER_MODEL = 'authentication.User'

# ──────────────────────────────────────────────
# Password Validation
# ──────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ──────────────────────────────────────────────
# Internationalization
# ──────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Douala'
USE_I18N = True
USE_TZ = True

# ──────────────────────────────────────────────
# Static & Media Files
# ──────────────────────────────────────────────
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# WhiteNoise — serve static files in production
STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ──────────────────────────────────────────────
# CORS — Allow React frontend
# ──────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:3000'
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

# Restrict allowed HTTP methods
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Limit exposed headers to only what frontend needs
CORS_EXPOSE_HEADERS = [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
]

from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-tenant-id',
    'x-session-id',
]

# ──────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.authentication.backends.SOSJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'login': '10/minute',
        'public': '20/minute',
        'enrollment_per_school': '5/minute',
        # Mark auto-save fires ~1 request/2s while typing → 1000/hr would
        # throttle teachers mid-entry. Dedicated high cap for that endpoint.
        'mark_entry': '6000/hour',
    },
}

if DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ]

# ──────────────────────────────────────────────
# JWT Configuration
# ──────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_OBTAIN_SERIALIZER': 'apps.authentication.serializers.SOSTokenObtainPairSerializer',
}

# ──────────────────────────────────────────────
# Security Settings (production)
# ──────────────────────────────────────────────
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Referrer Policy - only send origin on cross-origin requests
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    # Permissions Policy - restrict browser features
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
    SECURE_CROSS_ORIGIN_EMBEDDER_POLICY = 'require-corp'

# ──────────────────────────────────────────────
# File Upload Limits
# ──────────────────────────────────────────────
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# ──────────────────────────────────────────────
# SOS Security Configuration
# ──────────────────────────────────────────────
# Maximum active sessions per user (0 = unlimited)
MAX_SESSIONS_PER_USER = 2
# Finance endpoints require token issued within this window
FINANCE_TOKEN_MAX_AGE = timedelta(minutes=30)

# ──────────────────────────────────────────────
# SOS Platform Configuration
# ──────────────────────────────────────────────
SOS_CONFIG = {
    'PLATFORM_NAME': 'School OS',
    'PLATFORM_VERSION': '1.0.0',
    'DEFAULT_LANGUAGE': 'en',
    'SUPPORTED_LANGUAGES': ['en', 'fr'],
    'MAX_UPLOAD_SIZE_MB': 10,
    'STUDENT_ID_PREFIX': 'STU',
    'TEACHER_ID_PREFIX': 'TCH',
}

# ──────────────────────────────────────────────
# Email Configuration
# ──────────────────────────────────────────────
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'true').lower() == 'true'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@schoolos.sos')

# Frontend URL for password reset links
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
