"""
Academic cache invalidation signals.

Analytics filter dropdowns and the public directory counts are derived
from these reference records. Any change must refresh the cache instantly
instead of waiting for the TTL to expire.
"""
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.academic.models import AcademicYear, Term, Class, Subject
from apps.tenants.signals import invalidate_school_public_cache


def _tenant_id_for(instance):
    tenant_id = getattr(instance, 'tenant_id', None)
    if tenant_id:
        return tenant_id
    academic_year = getattr(instance, 'academic_year', None)
    return getattr(academic_year, 'tenant_id', None)


def _clear_metadata_cache(instance):
    tenant_id = _tenant_id_for(instance)
    if tenant_id:
        cache.delete(f'analytics_metadata:{tenant_id}')


@receiver(post_save, sender=AcademicYear)
@receiver(post_delete, sender=AcademicYear)
def academic_year_changed(sender, instance, **kwargs):
    _clear_metadata_cache(instance)


@receiver(post_save, sender=Term)
@receiver(post_delete, sender=Term)
def term_changed(sender, instance, **kwargs):
    _clear_metadata_cache(instance)


@receiver(post_save, sender=Class)
@receiver(post_delete, sender=Class)
def class_changed(sender, instance, **kwargs):
    _clear_metadata_cache(instance)
    invalidate_school_public_cache(getattr(instance, 'tenant', None))


@receiver(post_save, sender=Subject)
@receiver(post_delete, sender=Subject)
def subject_changed(sender, instance, **kwargs):
    _clear_metadata_cache(instance)