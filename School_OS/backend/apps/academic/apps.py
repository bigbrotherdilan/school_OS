from django.apps import AppConfig


class AcademicConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.academic'
    label = 'academic'

    def ready(self):
        from apps.academic import signals  # noqa: F401
