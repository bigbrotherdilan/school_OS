"""
Tenant cache invalidation signals.

The tenant lookup (middleware), public school directory/profile pages,
and regions endpoint are all cached. Any change to a Tenant must drop
those keys so the directory reflects the update immediately.
"""
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.tenants.models import Tenant

TENANT_CACHE_TTL = 300


def invalidate_school_public_cache(tenant):
    """
    Bust every cached artifact that derives from a school's data:
    the tenant lookup, the public profile page, and the versioned
    directory/regions caches. Call with any model instance that exposes
    .id and .slug (a Tenant) or one with a tenant attribute.
    """
    if tenant is None:
        return
    if getattr(tenant, 'id', None):
        cache.delete(f'tenant:{tenant.id}')
    slug = getattr(tenant, 'slug', None) or getattr(getattr(tenant, 'tenant', None), 'slug', None)
    if slug:
        cache.delete(f'public:school:{slug}')
    version = int(cache.get('public_schools_version', 0) or 0)
    cache.set('public_schools_version', version + 1, TENANT_CACHE_TTL)


def _invalidate_tenant_cache(instance):
    invalidate_school_public_cache(instance)


@receiver(post_save, sender=Tenant)
def tenant_saved(sender, instance, **kwargs):
    _invalidate_tenant_cache(instance)


@receiver(post_delete, sender=Tenant)
def tenant_deleted(sender, instance, **kwargs):
    _invalidate_tenant_cache(instance)
