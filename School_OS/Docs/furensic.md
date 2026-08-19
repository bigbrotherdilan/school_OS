 We need to treat this as a **pre-production technical audit of a real SaaS product handling school, student, parent and financial data**.

Your architecture document gives us the baseline: 17 Django apps, 68 models, ~113 APIs, 70+ React pages, 84+ routes, six portals, multi-tenancy, RBAC, finance, audit logging, PWA, AWS infrastructure, etc.

## I want you to run the audit in parallel

Give your agents the following **six independent missions**. Do **not** let them modify the code yet. We want diagnosis first.

---

### AGENT 1 — BACKEND & DATABASE AUDITOR

> **Mission: Audit the entire School OS backend for production readiness.**
>
> You have access to the complete School OS repository.
>
> Do NOT modify any files.
>
> Audit:
>
> 1. All 17 Django apps.
> 2. All models and model relationships.
> 3. Migrations.
> 4. Django settings.
> 5. DRF serializers.
> 6. ViewSets/views.
> 7. URLs/routes.
> 8. Service layers.
> 9. Middleware.
> 10. Database queries.
> 11. Transactions.
> 12. Validation.
> 13. Error handling.
> 14. Race conditions.
> 15. N+1 queries.
> 16. Missing database indexes.
> 17. Missing constraints.
> 18. Foreign-key integrity.
> 19. Soft deletion/data-retention behavior where relevant.
> 20. Audit logging.
>
> Pay particular attention to the multi-tenant architecture. Every tenant-scoped resource must be impossible for one school to access through another school, including through nested relationships, query parameters, object IDs, custom actions, exports, reports and bulk operations.
>
> Test whether the claimed `X-Tenant-ID` enforcement actually provides security rather than merely relying on the frontend to provide the correct tenant.
>
> Examine authentication and authorization independently. Do not assume that because a permission class exists, the permission model is correct.
>
> Look for:
>
> * IDOR vulnerabilities
> * privilege escalation
> * tenant isolation failures
> * insecure object references
> * unauthorized bulk operations
> * unsafe queryset usage
> * missing transaction.atomic boundaries
> * inconsistent financial state
> * duplicate records
> * race conditions
> * incorrect cascading behavior
> * dangerous deletes
> * inefficient queries
> * missing indexes
> * data integrity problems
>
> Run the existing test suite and inspect test coverage.
>
> Produce a report containing:
>
> **A. Critical findings**
> **B. High-risk findings**
> **C. Medium-risk findings**
> **D. Low-risk findings**
> **E. Missing tests**
> **F. Performance concerns**
> **G. Database concerns**
> **H. Recommended fixes**
>
> For every finding, provide:
>
> * exact file
> * exact class/function/model
> * line number where possible
> * what is wrong
> * why it matters
> * realistic exploitation/failure scenario
> * recommended solution
> * severity: CRITICAL/HIGH/MEDIUM/LOW
>
> Do not praise the architecture unless the implementation actually proves the claim.

---

# AGENT 2 — SECURITY & TENANT ISOLATION AUDITOR

This one should be **aggressive**.

> **Mission: Attempt to break School OS.**
>
> Do NOT modify the repository.
>
> Assume this application will eventually contain sensitive student, parent, teacher and financial information.
>
> Your job is to behave like an external security engineer performing a hostile pre-production audit.
>
> Investigate:
>
> ### Authentication
>
> * JWT implementation
> * access/refresh token handling
> * token blacklisting
> * password reset
> * invitation flow
> * session management
> * account lockout
> * password policies
> * token expiration
> * password-change enforcement
>
> ### Authorization
>
> Attempt to determine whether:
>
> * parents can access another parent's child
> * students can access other students
> * teachers can access unrelated classes
> * bursars can access administrative functionality
> * admins can access platform-level functionality
> * ordinary users can impersonate higher roles
> * government users can access unauthorized schools
>
> ### Multi-tenancy
>
> Attempt to break tenant isolation through:
>
> * URL IDs
> * UUIDs
> * query parameters
> * POST bodies
> * PATCH bodies
> * DELETE requests
> * nested resources
> * search endpoints
> * filters
> * reports
> * exports
> * analytics
> * document URLs
> * file downloads
> * custom actions
> * bulk operations
> * parent global access
>
> The architecture claims that every model is tenant-scoped and that TenantMiddleware enforces the `X-Tenant-ID` relationship. Verify the implementation rather than trusting the documentation.
>
> ### Web security
>
> Audit:
>
> * CSRF
> * CORS
> * CSP
> * XSS
> * SQL injection
> * SSRF
> * clickjacking
> * insecure file uploads
> * path traversal
> * unsafe redirects
> * exposed secrets
> * debug configuration
> * sensitive error messages
> * rate limiting
> * brute force
> * enumeration
>
> ### Files/S3
>
> Attempt to determine whether private student documents, report cards, IDs and photos can be accessed without authorization.
>
> ### Finance
>
> Determine whether someone can:
>
> * modify payment amounts
> * mark an invoice as paid
> * forge payment status
> * reuse transaction IDs
> * create duplicate payments
> * access another student's invoice
> * manipulate receipts
> * bypass finance-specific authentication
>
> Produce an attack-oriented report with reproducible steps wherever possible.
>
> Severity must be:
>
> **CRITICAL / HIGH / MEDIUM / LOW / INFORMATIONAL**
>
> Do not merely identify theoretical vulnerabilities. Prove them wherever possible.

---

# AGENT 3 — FRONTEND / UX / ROLE PORTAL AUDITOR

> **Mission: Audit the React frontend as a production application.**
>
> Do NOT modify files.
>
> Audit all six portals:
>
> * Admin
> * Teacher
> * Parent
> * Bursar
> * Government
> * Public
>
> The architecture claims 70+ React pages and 84+ routes.
>
> Verify that every route correctly enforces authentication and role access.
>
> Look for:
>
> * frontend-only security assumptions
> * routes accessible without authorization
> * stale tenant state
> * incorrect tenant switching
> * broken logout behavior
> * token refresh problems
> * race conditions
> * stale Zustand state
> * accidental data leakage
> * incorrect loading states
> * broken error handling
> * forms that allow invalid data
> * missing confirmation for destructive operations
> * duplicate submissions
> * poor mobile behavior
> * PWA problems
> * offline inconsistencies
> * accessibility problems
> * untranslated strings
> * English/French inconsistencies
> * dead routes
> * broken API integrations
> * hardcoded data
> * fake/demo data remaining in production screens
> * console errors
> * performance problems
>
> Test every major workflow from the perspective of the actual user.
>
> Specifically test:
>
> **Admin**
>
> * onboarding school
> * academic setup
> * students
> * teachers
> * timetable
> * finance
> * reports
> * settings
>
> **Teacher**
>
> * timetable
> * attendance
> * assessments
> * marks
> * logbook
>
> **Parent**
>
> * children
> * results
> * attendance
> * invoices
> * payments
> * receipts
>
> **Bursar**
>
> * invoices
> * payments
> * arrears
> * expenses
> * ledger
>
> **Government**
>
> * school monitoring
> * inspections
> * compliance
>
> **Public**
>
> * school directory
> * public pages
>
> Report every broken or incomplete workflow.

---

# AGENT 4 — FINANCE + MoMo SPECIALIST

This is particularly important because **this is the major feature you already identified as unfinished**.

> **Mission: Audit the entire School OS financial subsystem and design a production-grade payment integration assessment.**
>
> Do NOT modify the code.
>
> First understand the existing finance domain:
>
> `FeeStructure → StudentInvoice → InvoiceLineItem → PaymentTransaction → Receipt`
>
> The architecture currently supports MTN Mobile Money, Orange Money, bank transfer and cash.
>
> Audit:
>
> * fee structures
> * fee categories
> * invoices
> * invoice line items
> * payments
> * receipts
> * expenses
> * arrears
> * transaction history
> * financial reporting
> * finance permissions
> * finance session/token mechanism
>
> Determine whether the accounting state remains correct under:
>
> * duplicate payment
> * failed payment
> * cancelled payment
> * timeout
> * partial payment
> * overpayment
> * payment reversal
> * webhook replay
> * network failure
> * user closing the browser
> * provider timeout
> * provider success but School OS timeout
> * School OS success but response lost
>
> Then audit the existing MTN MoMo and Orange Money integration code.
>
> Determine:
>
> 1. What is already implemented.
> 2. What is mocked.
> 3. What is incomplete.
> 4. What credentials/configuration are required.
> 5. Whether callbacks/webhooks are implemented.
> 6. Whether payment verification occurs server-side.
> 7. Whether transaction IDs are stored.
> 8. Whether idempotency exists.
> 9. Whether signatures/authentication are verified.
> 10. Whether payment status can be forged from the frontend.
> 11. Whether reconciliation is possible.
>
> DO NOT assume the integration is "active" merely because an integration class exists.
>
> Produce:
>
> **Current payment architecture**
>
> **What actually works**
>
> **What is mocked**
>
> **What is missing**
>
> **Security risks**
>
> **Accounting/data-integrity risks**
>
> **Exact implementation required to reach production**
>
> Also estimate the complexity of completing MTN MoMo and Orange Money separately.

---

# AGENT 5 — AWS / DEVOPS / PRODUCTION AUDITOR

> **Mission: Determine whether School OS can safely be deployed to AWS and operated as a real SaaS.**
>
> Do NOT modify anything.
>
> Audit the repository's deployment configuration against the architecture document.
>
> The documented production architecture uses Docker, Gunicorn, Nginx, PostgreSQL, Redis and S3.
>
> Inspect:
>
> * Dockerfile
> * docker-compose
> * Procfile
> * environment variables
> * production settings
> * database configuration
> * Redis
> * S3
> * CORS
> * CSRF
> * HTTPS
> * Nginx
> * Gunicorn
> * static files
> * media files
> * logging
> * health checks
> * migrations
> * backups
> * database restoration
> * secrets
> * monitoring
> * error tracking
> * deployment process
> * rollback process
> * scaling
>
> Specifically answer:
>
> **Can this safely run on one AWS EC2 instance for the first schools?**
>
> If yes:
>
> * what instance size?
> * what should run on it?
> * what should NOT run on it?
> * what managed AWS services should be introduced immediately?
>
> Then answer:
>
> **What happens when we reach 10 schools?**
>
> **100 schools?**
>
> **1,000 schools?**
>
> Identify the first architectural bottlenecks.
>
> Also inspect whether the application's synchronous architecture creates operational problems. The architecture explicitly states that reports and timetable generation currently run synchronously with no Celery/queue.
>
> Do not recommend AWS services simply because they exist. Recommend them only when justified by an identified requirement.

---

# AGENT 6 — PRODUCT / WORKFLOW / REAL-SCHOOL QA AUDITOR

This one should think like a **school administrator**, not a programmer.

> **Mission: Determine whether School OS actually works as a school operating system from the perspective of real users.**
>
> Do NOT modify the application.
>
> Treat the product as if a real Cameroonian school is going to use it tomorrow.
>
> Build realistic end-to-end scenarios.
>
> ### Scenario 1 — New school
>
> Start with an empty school.
>
> Configure:
>
> * school
> * academic year
> * terms
> * sections
> * classes
> * subjects
> * teachers
> * students
> * parents
> * fees
> * timetable
>
> Determine whether the workflow is logical and complete.
>
> ### Scenario 2 — New student
>
> Enroll a student and parent.
>
> Assign class.
>
> Assign subjects.
>
> Generate fees.
>
> Generate invoice.
>
> Record payment.
>
> Produce receipt.
>
> View the information from the parent account.
>
> ### Scenario 3 — Academic term
>
> Teacher:
>
> * views timetable
> * takes attendance
> * enters marks
> * updates logbook
>
> Admin:
>
> * reviews performance
> * generates reports
>
> Parent:
>
> * sees attendance
> * sees results
> * sees financial status
>
> ### Scenario 4 — Student promotion
>
> Determine whether end-of-year promotion is coherent and whether historical records remain intact.
>
> ### Scenario 5 — Financial reconciliation
>
> Determine whether a bursar can understand exactly:
>
> * what was billed
> * what was paid
> * what remains
> * who paid
> * when they paid
> * how they paid
> * which receipt was issued
>
> ### Scenario 6 — Failure
>
> Simulate:
>
> * duplicate submission
> * network failure
> * invalid data
> * deleted record
> * unauthorized access
> * payment failure
>
> Determine whether the system recovers gracefully.
>
> Focus especially on **workflow completeness**, not individual screens.
>
> Report:
>
> * broken workflows
> * confusing workflows
> * missing functionality
> * unnecessary complexity
> * dangerous workflows
> * terminology problems
> * Cameroon-specific gaps
> * parent usability problems
> * teacher usability problems
> * bursar usability problems
>
> Classify each issue as:
>
> **BLOCKER / CRITICAL / HIGH / MEDIUM / LOW**

---

# One more agent — THE ARCHITECT

If you have a seventh agent available, give it this job **after the other six have completed**:

> **Mission: Act as the chief software architect and synthesize the six School OS audit reports.**
>
> Do not simply summarize them.
>
> Cross-reference the findings.
>
> Identify:
>
> 1. Issues independently discovered by multiple agents.
> 2. Contradictions between the architecture document and actual implementation.
> 3. Critical dependencies between fixes.
> 4. Security issues that must be fixed before deployment.
> 5. Data-integrity issues that must be fixed before real schools use the system.
> 6. Payment issues blocking commercial launch.
> 7. Infrastructure issues blocking production.
> 8. UX issues blocking pilot deployment.
> 9. Features that can safely wait until after launch.
>
> Then create four categories:
>
> ### P0 — MUST FIX BEFORE ANY REAL SCHOOL
>
> ### P1 — MUST FIX BEFORE PAID COMMERCIAL LAUNCH
>
> ### P2 — SHOULD FIX DURING EARLY PRODUCTION
>
> ### P3 — FUTURE PRODUCT DEVELOPMENT
>
> For every P0/P1 issue provide:
>
> * issue
> * evidence
> * affected component
> * risk
> * proposed fix
> * dependencies
> * estimated implementation complexity
>
> Finally answer one question:
>
> **"If we had to put one real school onto School OS in the next 30 days, what exactly would prevent us from doing it safely?"**

---

## And one rule for all agents

**Do not let them fix anything yet.**

I want the first pass to be **forensic**.

Otherwise an agent will see a problem, silently change the code, and then tell us:

> "Everything looks good."

That's useless for what we're trying to accomplish.

We need:

**Current implementation → Evidence → Failure → Risk → Priority → Fix**

Only **after we have the combined audit** will we start giving agents implementation tasks.

### What I want you to bring back to me

You don't need to paste six enormous reports into the chat individually.

Have your agents save their reports, then give me the **combined findings**, preferably with the exact files/line references from the repository.

The architecture document is now our baseline, including the documented security layers, multi-tenancy, PWA behavior and deployment architecture.

**Let's try to break School OS before a customer does.** That's the audit I want.
