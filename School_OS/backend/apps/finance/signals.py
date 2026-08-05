"""
Finance cache invalidation signals.

Fee structures are shown on the public school profile page, so changes
must bust the public cache immediately.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.finance.models import FeeStructure
from apps.tenants.signals import invalidate_school_public_cache


@receiver(post_save, sender=FeeStructure)
@receiver(post_delete, sender=FeeStructure)
def fee_structure_changed(sender, instance, **kwargs):
    invalidate_school_public_cache(getattr(instance, 'tenant', None))