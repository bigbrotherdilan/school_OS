"""
Custom Email Backend — reads per-tenant DB settings, falls back to env vars.
"""
from django.core.mail.backends.smtp import EmailBackend as SMTPBackend
from django.conf import settings


class TenantEmailBackend(SMTPBackend):
    """
    Uses tenant-specific EmailSetting if available.
    The host/user/pass are passed via init kwargs from the view
    when sending tenant-scoped emails.
    """

    def __init__(self, host=None, port=None, username=None, password=None,
                 use_tls=None, fail_silently=False, **kwargs):
        self.host = host or settings.EMAIL_HOST
        self.port = port or settings.EMAIL_PORT
        self.username = username or settings.EMAIL_HOST_USER
        self.password = password or settings.EMAIL_HOST_PASSWORD
        self.use_tls = use_tls if use_tls is not None else settings.EMAIL_USE_TLS
        self.fail_silently = fail_silently
        self.use_ssl = kwargs.pop('use_ssl', settings.EMAIL_USE_SSL if hasattr(settings, 'EMAIL_USE_SSL') else False)
        self.timeout = kwargs.pop('timeout', settings.EMAIL_TIMEOUT if hasattr(settings, 'EMAIL_TIMEOUT') else None)
        self.ssl_keyfile = kwargs.pop('ssl_keyfile', None)
        self.ssl_certfile = kwargs.pop('ssl_certfile', None)
