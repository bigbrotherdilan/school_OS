# Change Log: frontend/src/pages/teacher/dashboard/TeacherDashboardHome.tsx

## 2026-08-04
- Updated `openWindows` state population to safely parse both paginated (`res.data.results`) and unpaginated (`res.data`) API responses.
- Added console logging for failed mark window requests to aid debugging.
- Updated "Enter marks" item under Today's Checklist to dynamically show open window count and highlight as urgent when windows are active.
- Reason: Open mark windows were not correctly extracted if the API returned an array instead of a paginated object, and checklist feedback was static.
