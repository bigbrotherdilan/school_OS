"""
Student cache invalidation signals.

Student counts on the public directory/profile pages derive from this
model, so enrollment changes must bust the public cache immediately.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.students.models import Student
from apps.tenants.signals import invalidate_school_public_cache


@receiver(post_save, sender=Student)
@receiver(post_delete, sender=Student)
def student_changed(sender, instance, **kwargs):
    invalidate_school_public_cache(getattr(instance, 'tenant', None))
