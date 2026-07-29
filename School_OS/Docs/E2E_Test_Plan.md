# School OS: Comprehensive End-to-End Test Plan

This document serves as the master checklist for verifying the full functionality, security isolation, and data integrity of the School OS platform prior to production deployment.

## Phase 1: Environment & Setup Verification

> [!IMPORTANT]
> Ensure the backend server (`python manage.py runserver`) and frontend development server (`npm run dev`) are both running. Ensure the SQLite database has been migrated and seeded with test data.

- [ ] **Backend API Health**: Navigate to `http://localhost:8000/api/v1/` and confirm the server responds.
- [ ] **Frontend Health**: Navigate to `http://localhost:5173/` and confirm the public landing page loads without console errors.
- [ ] **Database State**: Confirm at least 1 Tenant (e.g., "Saint Joseph") and all test user accounts exist (`admin@...`, `teacher@...`, `parent@...`, `minesec@...`).

---

## Phase 2: Authentication & Gateway Routing

The goal of this phase is to ensure the new Portal Gateway accurately routes users and completely blocks cross-portal contamination.

### 2.1 The Public Gateway
- [ ] Navigate to `/login`. Verify the Portal Gateway (Parent, Faculty, Admin cards) renders correctly.
- [ ] Verify the MINESEC Government Portal is **not** linked or visible on the Gateway.

### 2.2 Role-Based Routing
- [ ] **Admin Login**: Click "Administration" -> verify URL is `/login/admin`. Log in with `admin@saintjoseph.sos` -> verify redirect to `/admin`.
- [ ] **Faculty Login**: Click "Faculty Portal" -> verify URL is `/login/teacher`. Log in with `teacher@saintjoseph.sos` -> verify redirect to `/teacher`.
- [ ] **Parent Login**: Click "Parent Portal" -> verify URL is `/login/parent`. Log in with `parent@example.com` -> verify redirect to `/parent`.
- [ ] **Government Login**: Manually navigate to `/gov/login`. Log in with `minesec@cameroon.gov` -> verify redirect to `/gov`.

### 2.3 Strict Security Isolation
> [!WARNING]
> These negative tests are critical to ensure data is not exposed to the wrong roles.
- [ ] **Cross-Pollination Block**: While logged out, go to `/login/gov` and attempt to log in with the `parent@example.com` account. Verify it explicitly rejects the login with an "Unauthorized" message.
- [ ] **Protected Routes**: Copy the URL `http://localhost:5173/admin/finance`. Open an Incognito window (unauthenticated) and paste it. Verify it redirects to `/login`.

---

## Phase 3: Portal Deep-Dive Tests

### 3.1 Administrator Portal (`/admin`)
- [ ] **Dashboard Render**: Verify KPI cards (Total Students, Revenue, Attendance) populate from the backend.
- [ ] **Academic Setup**: Verify the ability to view/add terms, subjects, and classes.
- [ ] **Faculty Directory**: Ensure the list of teachers belongs ONLY to the active school tenant.
- [ ] **Finance Treasury**: Ensure fee transactions can be recorded and ledger history is visible.

### 3.2 Faculty / Teacher Portal (`/teacher`)
- [ ] **Class Assignment Context**: Verify the dashboard only shows classes the logged-in teacher is officially assigned to.
- [ ] **Logbook Management**: Verify the teacher can create a logbook entry for a specific subject and that it saves successfully.
- [ ] **Timetable**: Check if the teacher's schedule renders correctly based on the `TeachingAssignment` model.

### 3.3 Parent Portal (`/parent`)
- [ ] **Student Data Hydration**: Verify the dashboard correctly pulls data for "John" (or the specific linked ward) without showing other students in the system.
- [ ] **Academic Alignment**: Confirm terminology uses Cameroonian standards ("Sequences 1-6" and "Average /20").
- [ ] **Financial Tracking**: Verify fee history accurately reflects installments paid and balance due.
- [ ] **Reports Page**: Confirm Seq 1/Seq 2 analytics load properly.

### 3.4 Government Portal (`/gov`)
- [ ] **Macro Data Aggregation**: Verify "Total Schools" and "Total Students" counts are accurate sums of the entire SQLite database (across ALL tenants).
- [ ] **Regional Scoping (National)**: As `minesec@cameroon.gov` (National Delegate), verify the Regional Distribution grid shows ALL regions (e.g., Littoral, Center).
- [ ] **Sub-page Navigation**: Click through Regions, Compliance, Alerts, and Monitoring to ensure the shell pages render correctly without breaking the layout.

---

## Phase 4: Multi-Tenancy Boundary Testing

> [!CAUTION]
> Multi-tenant leaks are the highest risk in SaaS platforms. Data from School A must never appear in School B.

- [ ] **Tenant Separation**: Create a second tenant ("Amity International") and a test Admin for it. Log in as Amity Admin and verify that "Saint Joseph" students, teachers, and financial records are completely invisible.
- [ ] **Global Supervisor View**: Log in as `platform@schoolos.sos` (Platform Admin) and verify you can view metadata for BOTH Saint Joseph and Amity International.

---

## Sign-off

**Tester Name**: ___________________________
**Date Completed**: ________________________
**Overall Status**: [ PASS / FAIL / NEEDS WORK ]
