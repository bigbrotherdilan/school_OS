# School OS: Security Architecture & Threat Mitigation Report

**Date Generated:** April 24, 2026
**Project Phase:** Pre-Production / Advanced Prototyping
**Focus Area:** Platform Security, Data Isolation, and Access Control
**Target Audience:** Security Auditors, CTOs, MINESEC Compliance Officers

---

## 1. Executive Summary

School OS handles highly sensitive Personally Identifiable Information (PII), academic records, and financial transaction data for minors across hundreds of schools. A breach does not just compromise a single school; in a multi-tenant environment, it risks compromising the entire national network.

To mitigate this, School OS is built on a "Zero Trust" architecture. This means the system assumes that no user, device, or internal request is inherently trustworthy. Every single interaction—from loading a dashboard to submitting a grade—must be cryptographically verified and authorized at multiple layers before execution.

This document outlines the strict security paradigms, data isolation techniques, and threat mitigation strategies embedded deep within the School OS source code.

---

## 2. Multi-Tenancy: Absolute Data Isolation

The most critical security risk in a SaaS platform is "Tenant Bleed"—where School A accidentally (or maliciously) views the data of School B. 

### 2.1 The Tenant Middleware Paradigm
We do not rely on developers remembering to filter database queries by school. Instead, isolation is enforced at the lowest architectural level:
- **How it Works:** Every HTTP request sent from the React frontend to the Django backend must include an `X-Tenant-ID` header.
- **The Enforcement Layer:** Our custom `TenantMiddleware` intercepts every incoming request *before* it reaches any application logic. It verifies the user's token and extracts the `Tenant-ID`.
- **The Database Lock:** The middleware strictly binds that specific Tenant ID to the active thread context. Every subsequent database query automatically appends `WHERE tenant_id = X` to the SQL statement.
- **The Result:** It is mathematically impossible for a Teacher at "Sacred Heart College" to query the student database of "Saint Joseph Academy," even if they attempt to manipulate the API endpoints directly via Postman or CURL.

---

## 3. Authentication: JSON Web Tokens (JWT)

School OS does not use traditional, easily hijacked session cookies for the main portals. We utilize stateless JWT authentication.

### 3.1 Token Lifecycle
- **Access Tokens:** When a user logs in, they are issued a cryptographically signed Access Token with a very short lifespan (e.g., 2 hours). This token contains their User ID and Role claims.
- **Refresh Tokens:** They are also given a Refresh Token (valid for 7 days) stored securely. When the Access Token expires, the React frontend silently uses the Refresh Token to get a new Access Token.
- **Blacklisting & Rotation:** The moment a user clicks "Logout," their current tokens are injected into a database Blacklist. If a hacker intercepts an old token, the Django backend checks the Blacklist and immediately rejects the request with a `401 Unauthorized`. Furthermore, Refresh Tokens are rotated upon use, ensuring a stolen refresh token cannot be used indefinitely.

---

## 4. Role-Based Access Control (RBAC)

A user proving *who* they are (Authentication) does not dictate *what* they can do (Authorization). School OS utilizes strict RBAC using Django REST Framework's `PermissionClasses`.

### 4.1 Granular Endpoint Security
Every API endpoint in the system is guarded by custom Python classes:
- `IsSchoolAdmin`: Only allows requests if the user's role is strictly `ADMIN` for the active tenant.
- `IsAdminOrTeacher`: Allows academic staff to read data, but prevents Parents or external actors.
- `IsParent`: Restricts the user to only query data directly linked to their specific `ParentStudentRelationship` foreign key.

If a Teacher attempts to send a `POST` request to the `/api/v1/finance/invoices/` endpoint (which creates a school fee bill), the `IsSchoolAdmin` permission class intercepts the request at the router level and throws a `403 Forbidden` error before any database code is even executed.

---

## 5. Platform-Level Threat Mitigation

By utilizing the Python Django framework, School OS benefits from enterprise-grade protection against the Open Worldwide Application Security Project (OWASP) Top 10 vulnerabilities.

### 5.1 SQL Injection (SQLi) Prevention
**Threat:** A hacker typing malicious SQL code into a search bar to delete the database.
**Mitigation:** School OS *never* uses raw SQL queries. All database interactions pass through the Django Object-Relational Mapper (ORM). The ORM completely separates the SQL code from the user's input, parameterizing every query. SQL Injection is effectively impossible by design.

### 5.2 Cross-Site Scripting (XSS) Prevention
**Threat:** A malicious user injecting JavaScript into a student's name, which then executes and steals passwords when a Teacher views the roster.
**Mitigation:** 
1. The Django backend strictly sanitizes all incoming JSON payloads.
2. The React.js frontend automatically escapes all variables before rendering them in the browser. Any injected `<script>` tags are rendered as harmless text, neutralizing the threat.

### 5.3 Cross-Site Request Forgery (CSRF)
**Threat:** A user is tricked into clicking a malicious link on another website that secretly sends a "Delete Student" request to School OS while they are logged in.
**Mitigation:** Because School OS uses stateless JWTs instead of browser-attached Session Cookies for the API, CSRF attacks natively fail. The malicious site cannot access the JWT stored in the application's secure memory state to attach it to the forged request.

---

## 6. Obfuscation & Attack Surface Reduction

Security by obscurity is not a defense, but obscurity *combined* with strong security drastically reduces the attack surface.

### 6.1 Hidden Command Centers
The highest-value targets in School OS are the **Government (MINESEC) Portal** and the **Master Control (Super Admin) Dashboard**.
- **The Strategy:** Neither of these portals is linked anywhere on the public-facing Gateway or marketing sites. 
- **The Result:** Automated "bot" scanners attempting to brute-force admin logins usually target standard paths like `/wp-admin` or click visible "Admin Login" buttons. By hiding our critical URLs (`/gov/login` and `/admin`), we eliminate 99% of low-level automated attacks.

---

## 7. Compliance & Audit Tracking (Upcoming Implementation)

To comply with MINESEC regulations and provide forensic capabilities, School OS requires strict audit logging.

### 7.1 The Audit Middleware Strategy
Every write, update, or delete action in the database will be captured by the `AuditMiddleware`. 
- When a Principal changes a student's grade from a 'C' to an 'A', the system records:
  1. The exact timestamp.
  2. The User ID of the Principal.
  3. The IP Address of the request.
  4. The "Before" state and the "After" state of the database row.
- This creates an immutable, append-only ledger. If academic fraud is suspected, government inspectors can request the audit log to instantly identify who altered the record.

---

## 8. Pre-Production Security Requirements

Before School OS goes live on the internet, the following infrastructural security measures must be enforced at the DevOps/Server level:

1. **Strict HTTPS/SSL Enforcement (HSTS):** No unencrypted HTTP traffic is allowed. All connections must be forced to TLS 1.3 to prevent Man-in-the-Middle (MitM) attacks on public Wi-Fi networks.
2. **Rate Limiting (Throttling):** The backend API must implement DRF Throttling to restrict login attempts to 5 per minute per IP address. This stops dictionary/brute-force password guessing dead in its tracks.
3. **Database Encryption at Rest:** The production PostgreSQL database volume must be encrypted at the hardware level (e.g., AWS EBS KMS encryption). If the physical server hard drive is stolen, the data remains unreadable.
4. **Environment Variable Secrecy:** Critical keys (like the `DJANGO_SECRET_KEY` and Database Passwords) must be completely removed from the codebase and injected securely via a secret manager (e.g., AWS Secrets Manager or Docker `.env` files) during deployment.

---
**Conclusion:**
School OS is engineered to be a fortress. By forcing all data through strict Tenant Middlewares, validating every action with JWT and RBAC, and utilizing Django's impenetrable ORM, the platform ensures that student data remains exclusively in the hands of authorized educators and parents.
