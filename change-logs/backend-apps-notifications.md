# Change Log: backend/apps/notifications

## 2026-08-04
- Fixed announcement publishing by assigning the current tenant and authenticated user during announcement creation.
- Made the announcement serializer treat tenant and created_by as server-managed fields so create requests no longer fail validation.
- Adjusted announcement visibility so teachers receive both general announcements and teacher-targeted announcements.
- Fixed quick-message sending by assigning the current tenant and sender during direct-message creation and making those fields server-managed.
- Added regression tests covering announcement creation, teacher visibility, and direct-message sending through the notifications API.
- Reason: the admin communications publish action and quick-message flow were both failing because the backend expected tenant and creator context that the frontend request did not supply.
