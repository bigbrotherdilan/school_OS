# 🔐 Security Plan — School OS

Status: **Not yet implemented — awaiting approval.**
Date: 2026-08-01
Audit scope: backend, frontend, deployment configs (3 parallel audits + manual verification).

---

## Critical findings (fix before anything else)

### 🔴 1. Credentials + database URL committed in repository
`DEPLOYMENT.md` contains plaintext passwords (admin/teacher at both schools) and the public
PostgreSQL URL of the production database. Repo access = school admin access + direct DB access.

**Proposed fix (A1):** Remove credentials/URL from `DEPLOYMENT.md`; rotate all seeded passwords;
document only roles (credentials issued out-of-band).
- Pros: stops the single most dangerous exposure; minutes of work.
- Cons: documented passwords stop working; testers need new ones.
- Alternative: keep as-is. Risk = unacceptable.

### 🔴 2. Payment endpoint is fake money + no ownership check
`initiate_payment` (finance/views.py) auto-confirms payment without any mobile-money provider
or webhook, and lets any logged-in user pay off *any* invoice, not just their own child's.
An attacker can zero out every student's balance. Also: fake revenue in production.

**Proposed fix (A2):** Enforce ownership (parent may pay only own child's invoices; no non-parent
payers). Keep payments mock-but-honest; real MTN MoMo/Orange Money integration deferred
(needs merchant accounts, webhooks, secret validation — separate project).
- Alternative: build full payment integration now. Pros: real money. Cons: weeks of work,
  external approvals, more attack surface. Recommend defer.

### 🔴 3. User-account IDOR → account takeover
User-management API lets any logged-in user (parent/student) read and edit any user record in
the school, including the admin's email. Change email → "forgot password" → own the admin account.

**Proposed fix (A3):** Restrict to admins or self; validate role transitions.

### 🔴 4. Document access levels not enforced
Document "confidential" flag never checked — anyone in school can download anything.

**Proposed fix (A4):** Enforce access levels; downloads require auth; serve via authenticated
endpoint, not public file URLs.

## High findings

| # | Issue | Risk | Proposed fix |
|---|---|---|---|
| 5 | Uploads not really validated (photo = extension only; documents = nothing) | Stored XSS / malware | Pillow content verify + document allowlist + `nosniff` header |
| 6 | Student files public in dev / broken + erased in prod | Data leak; broken feature; no file backups | S3/object storage for media + authenticated serving |
| 7 | `/admin/` exposed in prod, no throttle/allowlist | Brute-force door | Change URL, restrict by IP in prod, rate limit |
| 8 | No backup strategy (ephemeral disk, no dump) | Total data loss on deploy wipe/corruption | Daily `pg_dump` to durable storage + media to S3 |
| 9 | Finance totals + audit logs visible to all school members | Privacy/business leak | Admin/bursar only |
| 10 | Access JWT in localStorage (zustand persist `sos-auth-storage`) | Extension/XSS theft | Move to memory; re-issue via refresh cookie on reload (refresh token already cookie-only) |

## Medium findings

- SMTP password stored plaintext in DB, returned to browser → encrypt at rest, never expose.
- Refresh token stored in `UserSession.refresh_token_hash` → store hash only.
- No Content-Security-Policy → add via existing middleware.
- Password-reset endpoint has no per-email rate limit → throttle.
- Lockout error reveals account existence → generic message.
- Error responses leak internals in prod → keep DEBUG off (already default False) + generic 500s.
- Tenant contact list open to any user → limited view for non-members.
- Enrollment inquiry stores children's PII in announcements → mask/truncate.
- Debug logging enabled → adjust in prod.
- `SECURE_PROXY_SSL_HEADER` not set → HTTPS misdetected behind proxy.
- Email change without verification → require password + verification.
- SQLite silent fallback in prod → fail fast.

## Low findings

- No CSP meta tag in frontend (covered by middleware fix).
- Stale sessions listed in profile after session kill (cosmetic).

## Already solid ✅

- Passwords hashed (PBKDF2), `validate_password` enforced (M4 done).
- JWT 2h access + rotating refresh, blacklist on rotate (C2/H1/H2 done).
- Login throttle + 5-attempt lockout (M1 done).
- Tenant isolation everywhere; refresh token excluded from login body (M3 done).
- Security headers on; secrets out of `.env` in repo; no XSS sinks; no hardcoded frontend secrets.
- `assign_role` privilege escalation closed (C1 done). `DEBUG` default False (H3 done).

## Phases

1. **Phase 1 — Stop the bleeding (Critical, ~2 days):** A1 credentials rotation, A2 payment
   ownership, A3 IDOR fix, A4 document access.
2. **Phase 2 — Defense in depth (High, ~3 days):** B1 backups (pg_dump + S3), B2 upload
   hardening, B3 admin protection, B4 token out of localStorage, B5 CSP.
3. **Phase 3 — Access tightening (Medium, ~2 days):** finance/audit visibility, directory,
   SMTP encryption, refresh hash, generic lockout errors, email-change verification, SQLite
   fail-fast, proxy SSL header.
4. **Phase 4 — Ongoing:** monthly `npm audit` + `pip-audit`, audit-log failed logins, 90-day
   password rotation, deploy checklist.

**Ordering principle:** Phase 1 stops active attacks today; Phase 2 limits damage; Phase 3
removes remaining weaknesses; Phase 4 keeps it that way.

## Deferred / out of scope

- Real MTN MoMo / Orange Money integration (requires merchant accounts; payments stay mock-but-honest).
- 2FA for admins (candidate for later phase).
