"""
Staff Signals — recompute teacher marketplace ratings when reviews change.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.staff.models import PerformanceReview, Teacher


def _recalculate_teacher_rating(sender, instance, **kwargs):
    teacher = Teacher.objects.filter(id=instance.teacher_id).first()
    if teacher:
        teacher.recalculate_rating()


@receiver(post_save, sender=PerformanceReview)
@receiver(post_delete, sender=PerformanceReview)
def recalculate_rating_on_review_change(sender, instance, **kwargs):
    _recalculate_teacher_rating(sender, instance, **kwargs)
