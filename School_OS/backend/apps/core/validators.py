"""
Shared DRF validators — School OS
"""
from rest_framework.validators import UniqueTogetherValidator


class NullableUniqueTogetherValidator(UniqueTogetherValidator):
    """unique_together whose optional fields are nullable. DRF's default
    validator force-implies `required` on every field in `unique_together`
    (see `enforce_required_fields`), which would reject valid rows where
    optional fields such as `series`/`student_group` are NULL. NULLs are
    distinct in Postgres unique constraints, so the implied-required
    enforcement is skipped and the uniqueness check itself only runs when
    every field is provided (matching NULL for NULL)."""

    def enforce_required_fields(self, attrs, serializer):
        pass

    def filter_queryset(self, attrs, queryset, serializer):
        for field_name in self.fields:
            source = serializer.fields[field_name].source
            if source in attrs and attrs[source] is not None:
                queryset = queryset.filter(**{source: attrs[source]})
            else:
                queryset = queryset.filter(**{source + '__isnull': True})
        return queryset
