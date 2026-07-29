"""
Assessment Signals — Auto-create term exams when terms are created.
Each term gets one exam. Teachers enter marks per sequence within that exam.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='academic.Term')
def auto_create_term_exam(sender, instance, created, **kwargs):
    """
    When a Term is created, auto-create its term exam.
    Each term = one exam (e.g., '1st Term Exam', '2nd Term Exam', '3rd Term Exam').
    """
    if not created:
        return

    from apps.assessments.models import Exam

    TERM_NAMES = {
        1: '1st Term Exam',
        2: '2nd Term Exam',
        3: '3rd Term Exam',
    }

    name = TERM_NAMES.get(instance.order_number, f'{instance.name} Exam')

    Exam.objects.get_or_create(
        tenant=instance.academic_year.tenant,
        term=instance,
        defaults={
            'academic_year': instance.academic_year,
            'name': name,
            'exam_type': 'termly',
            'weight': 33.33,
        },
    )
