from django.apps import AppConfig


class AssessmentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.assessments'
    verbose_name = 'Assessments & Marks'

    def ready(self):
        import apps.assessments.signals  # noqa: F401
