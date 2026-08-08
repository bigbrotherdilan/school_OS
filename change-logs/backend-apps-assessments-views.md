# Change Log: backend/apps/assessments/views.py

## 2026-08-04
- Added fallback for `tenant_id` to `self.request.user.tenant_id` in `MarkEntryWindowViewSet.get_queryset` when `request.tenant_id` is missing.
- Added `.select_related('sequence', 'sequence__term')` to `MarkEntryWindow` queryset for query optimization and relationship prefetching.
- Reason: Open mark windows were not showing on the teacher dashboard if `tenant_id` attribute was unpopulated on the request object.
