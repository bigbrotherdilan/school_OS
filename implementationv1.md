# School OS — Implementation Plan v1

## What This Plan Does
This document outlines security upgrades for School OS. Every change here makes the
platform harder to break into and safer for users. Below each change is a simple
explanation of what it does and why it matters.

---

## 1. Shorter Sessions for Finance (30 Minutes)

**What changes:** When someone uses the finance section (fees, payments, expenses),
their login session expires after 30 minutes instead of the usual 2 hours.

**Why:** Money-related pages need tighter security. If a bursar walks away from
their desk, the finance session dies fast so no one else can use it.

**How it works:**
- A new middleware checks the time on finance requests
- If the token is older than 30 min, the user must log in again
- Non-finance pages still use the normal 2-hour window
- The frontend will redirect users to re-authenticate when entering finance pages
  with an expired session

---

## 2. Device Tracking — Know Every Device

**What changes:** Every time someone logs in, the system records what device they
used (browser, operating system, phone/tablet/desktop, IP address).

**Why:** If a hacker logs in from a strange device, you can see it immediately.
Users can also see where they're logged in.

**What we store per session:**
- Device name (e.g., "Chrome 120 on Windows 11")
- Device type (mobile / desktop / tablet)
- Browser name
- Operating system
- IP address
- Login time
- Last activity time

**New model — `UserSession`:** A database table that tracks every active login
session. When you log out or get kicked, the session is marked inactive.

---

## 3. Limit to 2 Devices Per User

**What changes:** A user can only be logged in on 2 devices at the same time.
Trying a 3rd device triggers a special flow.

**Why:** Limits the damage if someone's password is stolen — the thief can only
use one device alongside the real user.

**The login flow when limit is hit:**

1. User types email + password correctly
2. Server confirms the password is right but sees 2 active devices already
3. Server does **NOT** log the user in yet — instead returns:
   - A list of the 2 active devices (name, IP, last active time)
   - A temporary `login_token` (short-lived, single-use)
4. The user sees on screen: *"You're already logged in on 2 devices.
   Which one do you want to disconnect?"*
5. User clicks "Kill & Login"
6. Frontend sends the `login_token` to a confirm endpoint
7. Server disconnects the old sessions, creates the new one, returns the login tokens
8. Everything is logged in the audit trail

**If the user closes the page without confirming:** No login happens.
The `login_token` expires in 5 minutes.

---

## 4. Password Change Kills All Sessions Immediately

**What changes:** When a user changes their password (or an admin resets it),
every single active session dies immediately — even on other devices.

**Why:** If someone's account is compromised and they change the password,
the hacker's session dies right away, not after 2 hours when the token expires.

**How it works:**
- A new field `password_changed_at` is added to the User model
- Every JWT token carries a timestamp of when the password was last changed
- A custom authentication class checks on every API request:
  - *"Was the password changed AFTER this token was issued?"*
  - If yes → reject the token → user must log in again
- On password change:
  1. Update `password_changed_at` to now
  2. Deactivate all `UserSession` records for that user
  3. Blacklist all refresh tokens
  4. Log the action in the audit trail

---

## 5. Fees Can Already Be Filtered by Status ✅

**Already works.** No changes needed.

The finance invoices endpoint already supports:
```
GET /api/v1/finance/invoices/?status=unpaid
GET /api/v1/finance/invoices/?status=paid
GET /api/v1/finance/invoices/?status=partial
GET /api/v1/finance/invoices/?status=draft
GET /api/v1/finance/invoices/?status=cancelled
```

---

## 6. Tenant Isolation — No Peeking Between Schools

**Current problem found:** The public API was accidentally blocked by the
tenant middleware — it required an `X-Tenant-ID` header even for pages
where anyone should have access (school directory, enrollment form).

**Fix 1 — Public API exemption:**
- The tenant middleware will skip the `/pub/` path so visitors can browse
  schools without needing any header or login

**Fix 2 — Double-check tenant access:**
- New middleware verifies that when an authenticated user sends an
  `X-Tenant-ID`, they actually have a role in that school
- If they don't belong there, the request is rejected

**Fix 3 — Safer updates:**
- `BaseTenantViewSet` (which most views extend) will verify tenant
  ownership before allowing updates or deletes
- This prevents accidental data leaks even if a developer makes a mistake

---

## 7. Public API Moves to a Different Path

**Current:** `/api/v1/public/schools/`, `/api/v1/public/enrollment/`, etc.

**New:** `/pub/v1/schools/`, `/pub/v1/enrollment/`, etc.

**Why:** Attackers scan predictable URL patterns. If they see `/api/v1/`
they know it's a Django REST API. By using a completely different prefix,
we hide the technology stack and make it harder to find our public endpoints.

**Other differences from private APIs:**
- Response format is different (private: DRF pagination, public: custom format)
- Error messages are generic (no stack traces or details)
- No `X-Tenant-ID` header needed
- No `Authorization` header needed

---

## 8. Public API Security — Maximum Protection

Since public endpoints have no login requirement, they need extra safeguards:

| Measure | What it does |
|---------|--------------|
| **Stricter rate limits** | 20 requests per minute, 200 per hour per IP address |
| **Input sanitization** | Strip HTML tags from all form submissions — no `<script>` tags allowed |
| **Small payload limit** | Max 10KB on public POST forms — prevents large malicious uploads |
| **Data minimization** | Public responses only show what visitors need (school name, region, type) — no internal IDs, emails, or phone numbers |
| **IP blacklisting** | After 10 failed attempts in 1 hour, that IP is blocked temporarily |
| **Content-Type enforcement** | Only accept `application/json` on POST — reject XML, form-encoded, etc. |
| **Honeypot fields** | Hidden form fields that humans don't see but bots fill in — catches automated submissions |
| **No sensitive data** | Public serializers reviewed to ensure they never leak private info |
| **Audit logging** | Every public form submission is logged with IP and timestamp |
| **Generic headers** | Response headers don't reveal Django, Python, or server version |

---

## File Change Summary

| File | Change |
|------|--------|
| `backend/apps/authentication/models.py` | Add `password_changed_at` + `UserSession` model |
| `backend/apps/authentication/views.py` | New login flow, confirm-kill endpoint, password change kills sessions |
| `backend/apps/authentication/serializers.py` | Device info in JWT, password_changed_at claim |
| `backend/apps/authentication/urls.py` | New routes for sessions |
| `backend/apps/authentication/backends.py` (new) | Custom JWT auth that checks password_changed_at |
| `backend/apps/tenants/middleware.py` | Fix: add `/pub/` to exempt paths, tenant isolation check |
| `backend/config/settings.py` | Add finance timeout, max sessions, per-IP throttling |
| `backend/apps/core/middleware.py` | Add `FinanceSessionMiddleware` |
| `backend/apps/public/urls.py` | Change path to `/pub/v1/` |
| `backend/apps/public/serializers.py` | Data minimization review |
| `backend/config/urls.py` | Update public URL routing |
| `frontend/src/services/api.ts` | Send device info, handle 2-step login flow |
| `frontend/src/stores/authStore.ts` | Store device info |
| `frontend/src/pages/auth/Login.tsx` | Device limit confirmation dialog |

---

## Order of Implementation

1. **Models first** — `password_changed_at`, `UserSession`, migration
2. **Custom JWT auth** — check password_changed_at on every request
3. **Login flow** — device capture, 2-step login, confirm-kill
4. **Password change** — session invalidation + token blacklist
5. **Finance timeout** — middleware checks token age
6. **Public API** — move to `/pub/`, add security hardening
7. **Tenant isolation** — fix exemptions, add double-check
8. **Frontend** — update Login page to handle device limit dialog
