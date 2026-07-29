# School_OS Security & Reliability Hardening Plan

**Date:** July 28, 2026
**Goal:** Government-grade security, zero-downtime awareness, error tracing in < 60 seconds
**Status:** PENDING APPROVAL

---

## Executive Summary

After auditing the entire codebase (16 Django apps, React/TypeScript frontend), the application has a **solid foundation** — JWT auth, RBAC, multi-tenant isolation, audit middleware, security headers, and CORS are all in place. However, there are critical gaps that would disqualify government use: no monitoring/alerting, no centralized logging, no error tracking, no tests, broken login throttle, tokens in localStorage, no React Error Boundaries, and secrets management weaknesses.

This plan addresses every gap in priority order. **Nothing gets implemented until you approve.**

---

## PHASE 1: CRITICAL — Immediate Threat Fixes (Days 1-3)

### 1.1 Fix Broken Login Rate Limiting
**Problem:** Login endpoint has `throttle_classes = []` which disables ALL rate limiting. Brute-force attacks are unblocked.
**Fix:**
- Remove `throttle_classes = []` from `SOSLoginView`
- Replace with explicit `[AnonRateThrottle]` using the `login` scope
- Add per-IP throttle for password-reset endpoints (5/minute)
- Add per-IP throttle for public enrollment endpoint (10/minute)

### 1.2 Stop Returning Temporary Passwords in API Responses
**Problem:** `staff/views.py` (lines 79, 163, 248) and `authentication/views.py` (line 313) return `temp_password` in JSON. If API responses are logged (proxies, gateways), all passwords are stored in plaintext.
**Fix:**
- Remove `temp_password` from all API response bodies
- Send temporary passwords via email only (using the existing `send_mail` infrastructure)
- For bulk import: log passwords to a secure audit log, not the HTTP response
- Frontend: replace plaintext password display with "Password sent to email" confirmation

### 1.3 Regenerate and Secure Secrets
**Problem:** `backend/.env` contains `DJANGO_SECRET_KEY=sos-test-secret-key-2026-production` — a predictable, weak key. Seed scripts contain hardcoded passwords (`admin123456`, `teacher123`).
**Fix:**
- Generate a cryptographically random SECRET_KEY (50+ chars)
- Remove seed scripts from Dockerfile CMD (currently runs `seed_all` on every container start)
- Add `.env` to a secrets manager pattern (document for deployment)
- Rotate all database credentials for any deployed instances

### 1.4 Token Storage Security
**Problem:** Both access and refresh JWT tokens are stored in `localStorage` (Zustand persist). Any XSS attack steals both tokens, including long-lived refresh tokens.
**Fix:**
- Backend: Issue refresh tokens as `HttpOnly`, `Secure`, `SameSite=Strict` cookies
- Backend: Keep access tokens in response body (short-lived, 2hr)
- Frontend: Read access token from response body, store in memory only (not localStorage)
- Frontend: Remove refresh token from Zustand/localStorage entirely
- Frontend: Axios interceptor reads refresh token from cookie for silent refresh

---

## PHASE 2: MONITORING & OBSERVABILITY (Days 4-7)

### 2.1 Centralized Structured Logging (Backend)
**Problem:** No `LOGGING` dict in Django settings. No structured logging. Only ad-hoc `getLogger` in 1 file. You cannot diagnose anything.
**Implementation:**
- Add Django `LOGGING` configuration to `settings.py` with structured JSON format
- Use `python-json-logger` for machine-parseable logs
- Log levels: DEBUG (dev), INFO (prod), WARNING/ERROR/CRITICAL (always)
- Log format: `{"timestamp": "...", "level": "...", "module": "...", "request_id": "...", "user_id": "...", "tenant_id": "...", "message": "...", "traceback": "..."}`
- Console output in production (captured by platform logs)
- File output for development (`server.log`, `server_err.log`)
- Integrate existing `X-Request-ID` middleware into log context (already generates IDs)
- Add user_id and tenant_id to log context via middleware

### 2.2 Frontend Error Tracking with Sentry
**Problem:** Zero visibility into frontend crashes. No error boundaries. Users hit white screens with no recovery.
**Implementation:**
- Integrate `@sentry/react` for error tracking and performance monitoring
- Configure Sentry DSN via `VITE_SENTRY_DSN` environment variable
- Initialize in `main.tsx` with:
  - `tracesSampleRate: 0.1` (10% performance traces)
  - `replaysSessionSampleRate: 0.01` (1% session replays for errors)
  - `attachStacktrace: true`
  - Environment tag (`development`/`production`)
- Sentry captures: unhandled errors, promise rejections, React component errors
- Custom tags: `tenant_id`, `user_role` for filtering

### 2.3 Backend Error Tracking with Sentry
**Integration:**
- Install `sentry-sdk` with Django integration
- Initialize in `settings.py`:
  ```python
  sentry_sdk.init(
      dsn=env("SENTRY_DSN", default=""),
      traces_sample_rate=0.1,
      integrations=[DjangoIntegration()],
      environment="production" if not DEBUG else "development",
  )
  ```
- Capture all ERROR and CRITICAL level logs
- Add user context: `sentry_sdk.set_user({"id": user.id, "email": user.email})`
- Add tenant context: `sentry_sdk.set_tag("tenant_id", tenant_id)`

### 2.4 Health Check Enhancement
**Problem:** Current `/api/v1/health/` returns only `{ "status": "ok" }`. Not useful for monitoring.
**Fix:** Enhanced health check that verifies:
- Database connectivity (run a simple query)
- Redis connectivity (if used for caching)
- Disk space check
- Memory usage
- Return: `{"status": "healthy|degraded|unhealthy", "checks": {...}, "version": "...", "uptime": ...}`

### 2.5 Alerting Pipeline
**Problem:** Even with logging and Sentry, nobody gets woken up at 2 AM.
**Implementation:**
- Sentry alert rules:
  - New error type introduced → email + Slack notification
  - Error count > 50 in 5 minutes → critical alert
  - Response time p95 > 2 seconds for 5 minutes → performance alert
- Backend health check:
  - Deploy a cron job (or platform-native) that hits `/api/v1/health/` every 60 seconds
  - If status is not "healthy" for 3 consecutive checks → PagerDuty/email alert
- Database connection pool monitoring:
  - Log warnings when connection count exceeds 80% of pool limit
  - Alert on connection failures

---

## PHASE 3: ERROR HANDLING & TRACING (Days 7-10)

### 3.1 React Error Boundaries
**Problem:** Zero Error Boundaries. A single component crash kills the entire React tree (white screen).
**Implementation:**
- Create `ErrorBoundary` component at `src/components/ui/ErrorBoundary.tsx`:
  - Catches JavaScript errors in child components
  - Displays fallback UI with error details (dev) or generic message (prod)
  - "Report Error" button that sends to Sentry
  - "Reload Page" button
  - "Go to Dashboard" link
- Wrap at these levels:
  - Global: `<ErrorBoundary>` around `<App />` in `main.tsx`
  - Per-portal: Wrap each layout (AdminLayout, TeacherLayout, ParentLayout, etc.)
  - Per-page-critical: Wrap sensitive pages (Finance, Assessments, Report Cards)
- Async error handling: Add global `unhandledrejection` listener in `main.tsx`

### 3.2 Backend Custom Exception Handler
**Problem:** DRF's default exception handler leaks framework internals. `str(e)` in catch blocks exposes database details, file paths, and query errors.
**Fix:**
- Create custom `exception_handler` in `apps/core/exceptions.py`:
  - Map known exceptions to user-friendly messages
  - Log full traceback internally (to Sentry + structured logs)
  - Return generic messages to client:
    - `400`: "Invalid request data"
    - `403`: "Permission denied"
    - `404`: "Resource not found"
    - `500`: "Internal server error. Reference: {request_id}"
  - Include `X-Request-ID` in every error response for traceability
- Register in settings: `EXCEPTION_HANDLER = 'apps.core.exceptions.custom_exception_handler'`
- Replace all `str(e)` in view catch blocks with generic messages

### 3.3 60-Second Error Tracing Workflow
**Problem:** "How do we trace an error in less than 60 seconds?"
**Implementation:** This is the workflow, not code:
1. **Step 1 (5 sec):** User reports error → support provides `X-Request-ID` from the response header
2. **Step 2 (10 sec):** Search Sentry by request ID or error fingerprint → see full stack trace, breadcrumbs, user context, tenant context
3. **Step 3 (15 sec):** Sentry links to the exact code location in GitHub
4. **Step 4 (10 sec):** Check structured logs in platform dashboard filtered by `request_id` → see full request lifecycle
5. **Step 5 (10 sec):** Check audit log (existing `AuditMiddleware`) for the user's action sequence
6. **Step 6 (10 sec):** If database issue, query logs show the exact query (from structured logging)

**For this to work, every component above must be implemented.**

### 3.4 Frontend Console Cleanup
**Problem:** 83 `console.log/error/warn` statements leak sensitive data in production. DevTools expose everything.
**Fix:**
- Install `vite-plugin-remove-console`
- Configure in `vite.config.ts` to strip all `console.*` calls in production builds
- Replace critical console.error calls with Sentry error reporting:
  ```typescript
  import * as Sentry from '@sentry/react';
  Sentry.captureException(error);
  ```
- Keep console statements only for development (the plugin removes them in prod)

---

## PHASE 4: INPUT VALIDATION & API SECURITY (Days 10-14)

### 4.1 Backend Input Validation Hardening
**Problem:** Multiple views bypass serializer validation and accept raw `request.data`. File uploads check only extension, not content.
**Fix:**
- **`me_view` PATCH:** Create `ProfileUpdateSerializer` with explicit field types and validation
- **`finance/batch_generate`:** Create `BatchGenerateSerializer` with UUID validation for `class_id`, `fee_structure_ids`, date validation for `due_date`
- **`reports/batch_generate`:** Create `ReportBatchSerializer` with required field validation
- **`public/submit_enrollment_inquiry`:** Add length limits (name: 200, message: 5000), sanitize HTML, add rate limiting
- **File uploads:** Validate file content using Pillow's `Image.open()` to verify it's actually an image (not just extension check). Use `image.verify()` for integrity check.
- **Document uploads:** Add file type whitelist (PDF, DOCX, XLSX, PNG, JPG) and content-type validation
- **Replace `fields = '__all__'`** in all serializers with explicit field lists (16 serializers across 8 apps)

### 4.2 Request Size Limits
**Current state:** `DATA_UPLOAD_MAX_MEMORY_SIZE = 10MB` (good)
**Additional:**
- Add per-endpoint payload size limits for bulk operations
- Limit CSV upload to 5MB and 10,000 rows
- Limit batch operations to 100 items per request

### 4.3 Input Sanitization
**Problem:** No XSS sanitization for rich text fields (announcement bodies, logbook notes, comments)
**Fix:**
- Install `bleach` library
- Create utility function `sanitize_html(dirty_text)` that strips dangerous tags/attributes
- Apply to all text fields that accept user-generated content:
  - Announcements body
  - Logbook entries
  - Comments/notes fields
  - Any future rich text fields

---

## PHASE 5: FRONTEND SECURITY HARDENING (Days 14-17)

### 5.1 Content Security Policy (CSP)
**Problem:** No CSP headers. No defense-in-depth against XSS.
**Fix:**
- Add CSP via Django middleware (not meta tag, for flexibility):
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://sentry.io;
  frame-ancestors 'none';
  ```
- Add to `SecurityHeadersMiddleware`
- Report violations to Sentry via `report-uri` directive

### 5.2 Form Validation Library
**Problem:** Frontend validation is ad-hoc (HTML `required`, some manual checks). No schema-based validation.
**Fix:**
- Install `zod` for TypeScript-first schema validation
- Create validation schemas for all forms:
  - Login (email format, password min-length)
  - Student CRUD (name length, email format, date ranges)
  - Finance (amount > 0, date formats, balance checks)
  - Assessment (marks 0-100, weight 0-100)
  - Enrollment (all required fields, phone format)
- Integrate with form submissions (show field-level errors before API call)

### 5.3 Fix Hardcoded URLs
**Problem:** `TeacherMarketplace.tsx` (line 65) uses `http://localhost:8000`. `ProfileEditor.tsx` (line 38) hardcodes localhost for media URLs.
**Fix:**
- Replace all `http://localhost:8000` with `import.meta.env.VITE_API_URL`
- Use the existing `api`/`publicApi` axios instances instead of raw `fetch()`
- Create a `getMediaUrl(path)` utility that uses the configured base URL

### 5.4 Remove Sensitive Data from Console
Already covered in 3.4 (vite-plugin-remove-console).

---

## PHASE 6: TESTING STRATEGY (Days 17-25)

### 6.1 Backend Unit Tests
**Current state:** ZERO tests. This is unacceptable for government use.
**Implementation:**
- Install `pytest` + `pytest-django` + `factory-boy` + `coverage`
- Test coverage targets:
  - Authentication: 100% (login, logout, refresh, password reset, RBAC)
  - Finance: 95% (invoice generation, payment processing, balance calculations)
  - Students: 95% (CRUD, promotion, enrollment)
  - Attendance: 90% (session management, record submission)
  - Government: 90% (monitoring, compliance, dashboard)
- Key test categories:
  - Permission tests (every endpoint × every role = allowed/denied)
  - Validation tests (invalid input → proper error codes)
  - Tenant isolation tests (user from school A cannot access school B data)
  - Edge cases (empty payloads, oversized data, concurrent requests)

### 6.2 Frontend Unit Tests
**Implementation:**
- Install `vitest` + `@testing-library/react` + `@testing-library/jest-dom`
- Test coverage targets:
  - Auth store: 100% (login, logout, token management, role validation)
  - ProtectedRoute: 100% (redirect logic, role checking)
  - API service: 90% (interceptors, error handling, token refresh)
  - Critical form components: 80%
- Key test categories:
  - Route protection (unauthenticated → redirect, wrong role → redirect)
  - Token refresh (expired token → auto-refresh → retry)
  - Error boundary (component crash → fallback UI)

### 6.3 Integration Tests
**Implementation:**
- Install `pytest-django` with `TransactionTestCase`
- Test full flows:
  - Admin login → create student → assign to class → verify audit log
  - Teacher login → submit attendance → verify government monitoring sees it
  - Parent login → view child data → verify only their children visible
  - Bulk CSV import → verify all records created → verify error handling for bad rows

### 6.4 Security Tests
**Implementation:**
- SQL injection: Attempt raw SQL in all input fields → verify ORM protection
- XSS: Attempt `<script>` tags in all text fields → verify sanitization
- CSRF: Attempt cross-origin POST without token → verify protection
- IDOR: Attempt to access other tenant's resources → verify 403
- Auth: Attempt access with expired/invalid/missing tokens → verify 401
- Rate limiting: Send 100 login attempts in 1 minute → verify throttling

---

## PHASE 7: DEPENDENCY & INFRASTRUCTURE SECURITY (Days 25-28)

### 7.1 Pin Dependencies
**Problem:** All `requirements.txt` entries use `>=` without upper bounds. A `pip install` could pull breaking versions.
**Fix:**
- Pin exact versions in `requirements.txt` (generate `pip freeze` output)
- Pin exact versions in `frontend/package.json` (use `npm install --save-exact`)
- Create `requirements.lock` and `package-lock.json` (already exists for npm)

### 7.2 Dependency Vulnerability Scanning
**Implementation:**
- Backend: Add `pip-audit` to CI pipeline (checks PyPI vulnerability database)
- Frontend: Add `npm audit --audit-level=high` to CI pipeline
- GitHub: Enable Dependabot for automatic security PRs
- Schedule: Weekly automated scans, alerts to team

### 7.3 Dockerfile Hardening
**Problems:** Runs as root, runs seed scripts in production, no health check.
**Fix:**
- Add non-root user: `RUN adduser --disabled-password appuser && USER appuser`
- Remove `seed_all` from CMD (only run manually during setup)
- Add `HEALTHCHECK` instruction
- Use multi-stage build to reduce image size
- Pin base image version (not `python:3.11`, use `python:3.11.9-slim`)

### 7.4 Production Environment Checklist
- `DEBUG=False` (verified)
- `SECRET_KEY` = cryptographically random 50+ char string
- `ALLOWED_HOSTS` = only production domain(s)
- `CORS_ALLOWED_ORIGINS` = only production frontend URL
- `DATABASE_URL` = production PostgreSQL with strong password
- `SENTRY_DSN` = configured
- `EMAIL_*` = production SMTP credentials
- HTTPS enforced at load balancer/reverse proxy level

---

## PHASE 8: COMPLIANCE & DOCUMENTATION (Days 28-30)

### 8.1 Security Documentation
- Update `Docs/Security&Complience.md` with:
  - Authentication flow diagram
  - Authorization matrix (role × resource → allowed/denied)
  - Data flow diagram (frontend → API → database → audit log)
  - Incident response procedure
  - Secret rotation schedule

### 8.2 API Security Documentation
- Update `Docs/Api_contract_specification.md` with:
  - Rate limits per endpoint
  - Required headers (`Authorization`, `X-Tenant-ID`)
  - Error response formats (standardized)
  - Deprecation policy

### 8.3 Deployment Security Checklist
Create `Docs/DEPLOYMENT_SECURITY_CHECKLIST.md`:
- [ ] Secrets in environment variables (not in code)
- [ ] HTTPS enabled with valid certificate
- [ ] Database not publicly accessible
- [ ] Sentry configured and receiving errors
- [ ] Logging configured with structured JSON
- [ ] Rate limiting active on all endpoints
- [ ] CSP headers configured
- [ ] Error boundaries wrapping all portals
- [ ] Test suite passing with >80% coverage
- [ ] No `console.log` in production build
- [ ] No seed data in production database
- [ ] Backup and recovery tested

---

## Summary: What You Get After This Plan

| Capability | Before | After |
|---|---|---|
| **Error detection** | User complains at 9 AM | Sentry alert at 2:01 AM |
| **Error tracing** | Days of guessing | 60 seconds via request ID + Sentry |
| **Login brute-force** | Unlimited attempts | 10/minute with IP tracking |
| **XSS defense** | React auto-escape only | CSP + sanitization + Error Boundaries |
| **Token theft** | Steal from localStorage | HttpOnly cookie + in-memory access token |
| **Secrets** | Predictable key in .env | Cryptographic key, env-only, rotation plan |
| **Test coverage** | 0% | >80% with security-specific tests |
| **Dependency safety** | Unpinned, unscanned | Pinned, audited, Dependabot-enabled |
| **Error messages** | Database internals leaked | Generic messages + request ID for tracing |
| **Frontend crashes** | White screen, no recovery | Error boundary with retry + Sentry capture |
| **Audit trail** | Middleware logs actions | Structured logs + Sentry + audit trail correlated |

---

## Implementation Order (Recommended)

1. **Week 1:** Phase 1 (Critical fixes) + Phase 2 (Monitoring) — Get visibility immediately
2. **Week 2:** Phase 3 (Error handling) + Phase 4 (Input validation) — Harden the core
3. **Week 3:** Phase 5 (Frontend security) + Phase 6 (Testing) — Secure the surface
4. **Week 4:** Phase 7 (Infrastructure) + Phase 8 (Documentation) — Professional polish

**Total estimated effort: 30 working days**

---

## APPROVAL REQUIRED

- [ ] Phase 1: Critical Threat Fixes
- [ ] Phase 2: Monitoring & Observability
- [ ] Phase 3: Error Handling & Tracing
- [ ] Phase 4: Input Validation & API Security
- [ ] Phase 5: Frontend Security Hardening
- [ ] Phase 6: Testing Strategy
- [ ] Phase 7: Dependency & Infrastructure Security
- [ ] Phase 8: Compliance & Documentation

**Approve all phases to begin, or approve individual phases to prioritize.**
