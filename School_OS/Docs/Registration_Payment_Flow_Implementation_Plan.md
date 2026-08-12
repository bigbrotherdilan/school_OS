# Registration → Payment Flow — Implementation Plan

**Status:** Proposed
**Owner:** School OS core
**Target:** Admins should register a student, see their placement confirmed on the review card, and be one click away from recording that student's first payment — without ever manually "generating an invoice" first.

---

## 1. What is broken today (confirmed by code review)

### 1.1 Record Payment forces a pre-existing invoice
`RecordTransactionPage.tsx` (frontend) only loads **unpaid invoices** (`GET /finance/invoices/`) and posts `{invoice_id, amount, ...}` to `POST /finance/transactions/`. There is no class → student selector.

- `PaymentTransaction.invoice` is a **required** FK (`finance/models.py:97`).
- `PaymentTransactionSerializer.create` refuses amounts > `invoice.balance` (`serializers.py:106`).
- Invoices are only created via the two manual actions `POST /finance/invoices/generate/` and `POST /finance/invoices/batch-generate/` (`finance/views.py:89`, `:176`).

**Result:** an admin who just registered a student cannot take money for tuition until someone separately visits Fees → Generate Fees for that class/student. That's the "strange method of paying fees" the teacher hit.

### 1.2 Parent details entered at registration are silently discarded
`AddStudentPage.tsx:155-171` sends `parent_name`, `parent_phone`, `parent_email`, `relationship_type` to `POST /students/students/`.

- `StudentCreateSerializer` (`students/serializers.py:36`) does **not** declare those fields → DRF ignores them.
- `StudentViewSet` has **no `create()` override** (`students/views.py:66`) — nothing links the parent.

**Result:** the parent/guardian the admin typed is never saved, no parent account is created, and no `ParentStudentRelationship` is created. The data vanishes silently.

### 1.3 Placement on the review card is broken
The step-5 review card (`AddStudentPage.tsx:442-455`) renders the section with:

```
sections.find(s => s.id === formData.section)?.name === 'anglophone' ? 'Anglo'
  : sections.find(s => s.id === formData.section)?.name === 'francophone' ? 'Franco'
  : 'Not Set'
```

Real section names are things like `"Anglophone Section"` / `"Section Anglophone"`, so this always renders **"Not Set"** even when a section was chosen. The class name and series code resolve, but the row reads `Not Set / Form 1` — the teacher reads this as "placement is not implemented".

### 1.4 No "record payment" affordance after registration
- After `handleSubmit`, the page does `navigate('/admin/academic')` (`AddStudentPage.tsx:175`) — the admin is dropped straight back to the registry.
- The registry row action is a dead `more_horiz` button wired to `handlePendingFeature('Student Options')` (`AcademicManagement.tsx:147`).
- The backend already has `POST /students/students/{id}/verify/` to flip `REGISTERED → ACTIVE` (`students/views.py:101`) but **no frontend calls it**. The intended lifecycle (register → pay → active) is unwired.

---

## 2. Target UX (three journeys)

### Journey A — Register then collect (the main ask)
1. Admin registers the student (steps 1–5). Placement step picks Section → Class → Series.
2. Review card shows **Section / Class / Series** correctly (fix §4.1).
3. Admin confirms registration. Parent fields, if filled, create+link a parent account; success screen shows the student + temporary parent password.
4. Success screen has a **"Record Payment"** button that jumps into the payment flow with this student preselected.
5. Payment flow: **Section/Class → Student → Amount → Method → Confirm → Print Receipt**.
   - If the student has no invoice yet, the system **auto-builds one from the class fee structures** behind the scenes (the admin never "generates fees").
   - First payment auto-flips the student from `REGISTERED` to `ACTIVE` (the old manual `verify` step).

### Journey B — Direct payment (Finance → Record Payment)
1. Bursar/Admin opens Record Payment.
2. Picks **Section → Class → Student** (searchable list, shows admission # + current balance).
3. Sees the fee breakdown (from existing invoice, or from fee-structure quote if none).
4. Enters amount (defaults to balance) + method + reference → Confirm.
5. Success screen: Print/Download Receipt + "Record Another".

### Journey C — Registry quick actions
Each row in the registry gets a working action menu: **Record Payment** and **Activate / Verify** (plus the existing view).

---

## 3. Backend design

No schema migrations required — everything reuses `FeeStructure`, `StudentInvoice`, `PaymentTransaction`, `ParentStudentRelationship`. Changes are new endpoints, a shared parent service, serializer tweaks, and an idempotency guard.

### 3.1 Shared parent-creation service (extract from `onboard_parent`)
Move the parent-account creation logic out of `staff/views.py:115` (`onboard_parent`) into a reusable function, e.g.:

**`apps/authentication/services.py`** (new)
```
def onboard_parent(tenant, *, first_name, last_name, email, phone='',
                   default_language='en', links=(), assigned_by=None,
                   relationship_type='guardian') -> (User, temp_password, created_links)
```
- Creates the `User`, sets `must_change_password=True`, creates the `parent` `UserRoleMapping` at the creating tenant, and creates `ParentStudentRelationship` rows for each `(student_id, relationship_type)`.
- Raises `ValidationError` on duplicate email or a student that isn't in the tenant.
- `onboard_parent` (staff) is rewritten to call this service so both entry points behave identically.

### 3.2 Student registration creates + links the parent
**`apps/students/serializers.py` — `StudentCreateSerializer`:**
```
parent_name, parent_phone, parent_email, relationship_type  (all optional, write-only)
```
**`apps/students/views.py` — `StudentViewSet.create`:**
- Validate placement: `stream` must belong to the same tenant as the class; `series.stream` must match `stream` (if provided).
- Create the student (existing logic).
- If `parent_name` and `parent_phone` **and** `parent_email` are provided → call `onboard_parent(...)` with `links=[{student_id, relationship_type}]` and attach `{parent: {email, temp_password}, linked: true}` to the response payload.
- If only partial parent data is given → 400 with a clear message ("Email, name, and phone are required to create the parent account") so data can't silently drop.
- Wrap the whole thing in `transaction.atomic()` (already imported in this module).

**No invoice at registration (confirmed).** The payable is only ever created lazily by `record/` (§3.3).

### 3.3 Payment record endpoint — class/student-first
New endpoint, standalone APIView, bursar-or-admin write permission (`CanWriteFinance`):

**`POST /api/v1/finance/payments/record/`** (add to `finance/urls.py`)
```
{
  student_id: <uuid>,            # REQUIRED
  amount: number,                # REQUIRED, > 0
  method: 'cash'|'bank'|'momo'|'cheque',
  reference: str, notes: str,
  due_date: 'YYYY-MM-DD' | null  # only honored when a NEW invoice is created
}
```
**`apps/finance/views.py` — `PaymentRecordView` (new)**, logic (all inside `transaction.atomic`):
1. Load student (must belong to `request.tenant`) and the active `AcademicYear` (fallback: latest by `-created_at`, same as `generate`).
2. **Find-or-create invoice** (reuse a shared helper `_ensure_invoice(student, year, due_date=None)` extracted from `StudentInvoiceViewSet.generate`):
   - If an uncancelled invoice already exists for this student + year **covering these categories** → reuse it (no duplicate, matching today's guard at `views.py:125-144`).
   - Else create invoice + line items from `FeeStructure` (class-specific or `target_class IS NULL`), `total_amount = Σ`.
   - If no structures exist → 400: "No fee structure configured for {class}. Set one up under Finance → Fee Setup first." (clear first-run message)
3. **Create the payment** via the existing `PaymentTransactionSerializer.create` (keeps `amount_paid_after` snapshot, `balance_after`, `receipt_url`, overpay guard, `recorded_by`).
4. **Activate the student** on first payment: if `student.status == 'registered'` → `student.status = 'active'` (mirrors the `verify` action). Return `activated: true` in the payload.
5. Call `notify_payment_received(payment, created_by=request.user)`.
6. Return:
```
{
  transaction: <PaymentTransactionSerializer>,
  invoice: <StudentInvoiceSerializer>,
  created_invoice: true|false,
  activated: true|false,
  receipt_url: '/api/v1/finance/transactions/{id}/receipt/',
  statement_url: '/api/v1/finance/invoices/{id}/statement/'
}
```

### 3.4 Payment quote endpoint (fee breakdown for the UI)
**`GET /api/v1/finance/payments/quote/?student=<uuid>`** (same file; read permission `IsSchoolAdminOrBursar`)
```
{
  student: { id, full_name, admission_number, class_display, status },
  invoice: { id, invoice_number, total_amount, amount_paid, balance, status } | null,
  fees: [{ category_display, amount, is_mandatory }],   # from structures if no invoice
  total: <invoice.total or Σ fees>,
  has_invoice: bool
}
```
Frontend uses this to render the "amount due" and fee breakdown without guessing.

### 3.5 Extracted invoice helper (DRY)
Extract the fee-structure→invoice creation block currently duplicated in `generate` and `batch_generate` (`finance/views.py:146-166` and `:231-252`) into:
```
def _build_invoice_from_structures(tenant, student, year, due_date) -> StudentInvoice
```
`generate`, `batch_generate`, and `PaymentRecordView` all call it. Duplicate-category guard stays.

### 3.6 Admission number redesign (confirmed)
Current `SOS-{year}-{uuid[:8]}` becomes `{INITIALS}-{YEAR}-{SECTION}-{SEQ}`:
- `INITIALS` — derived from `tenant.school_name` (first letters of significant words, uppercase, max 4; fallback: first 3 letters). Unique per school in practice, so schools never share number prefixes.
- `YEAR` — enrolment year.
- `SECTION` — stream section code (e.g. `ANG`, `FRANCO`, `TECH`), `GEN` when the student has no section.
- `SEQ` — per (tenant, year, section), zero-padded to 4.

Implementation: `apps/students/utils.py` `generate_admission_number(student)` called from `Student.save()` when blank; new `manage.py renumber_students` command to backfill existing rows (sequence preserved per current year/section; legacy unplaced students get `GEN`). Globally unique constraint is safe because the initials prefix differs per school; a same-initials school pair is handled by the per-tenant sequence + the tenant scoping.

### 3.7 Permissions recap| Endpoint | Method | Permission |
| :--- | :--- | :--- |
| `/finance/payments/record/` | POST | `CanWriteFinance` (bursar always; admin when `finance_recording='admin_and_bursar'`) |
| `/finance/payments/quote/` | GET | `IsSchoolAdminOrBursar` |
| `POST /students/students/` (create) | POST | existing `IsAdminOrTeacher` (unchanged) |

---

## 4. Frontend design

### 4.1 Fix placement on the review card (small, isolated)
`AddStudentPage.tsx:442-455` — replace the fragile `=== 'anglophone'` ternary with the real section name:
```
<span className="text-sm font-black text-primary">
  {sections.find(s => s.id === formData.section)?.name || 'Not Set'}
  <span className="mx-2 opacity-20">/</span>
  {classes.find(c => c.id === formData.current_class)?.name || 'Unassigned'}
  {formData.series && (<><span className="mx-2 opacity-20">/</span>{series.find(s => s.id === formData.series)?.code}</>)}
</span>
```

### 4.2 Registration success screen (instead of navigate-away)
`AddStudentPage.tsx`:
- Replace `navigate('/admin/academic')` in `handleSubmit` with a `registeredStudent` state holding `{id, full_name, admission_number, class_display, parent_email?, temp_password?}`.
- New success view (replaces the step container) using existing design language:
  - Green confirmation header + student summary (name, admission #, **placement: Section / Class / Series**).
  - If a parent was created: `CredentialsCard` (reused from `AddParentPage`) showing parent email + temporary password.
  - Buttons: **Record Payment** (primary) → `navigate('/admin/finance/transactions/new', { state: { studentId } })`; **Back to Registry** (secondary); optional "Create fee invoice now" stays on step 5 as a checkbox.

### 4.3 Record Transaction Page — rework into class → student → amount
Rewrite `RecordTransactionPage.tsx`:
1. **Step 1 — Section/Class:** load sections + classes (`/academic/sections/`, `/academic/classes/`), filter classes by stream. Preselect from `location.state.studentId` if arriving from registration.
2. **Step 2 — Student:** load `/students/students/?current_class=<class_id>` (already supported via `filterset_fields`). Searchable list; each row shows `full_name`, `admission_number`, current balance. On select → call `/finance/payments/quote/?student=<id>`.
3. **Step 3 — Amount & method:** show quote (fee breakdown, balance, or "no fee structure configured" warning), amount (default balance), method, reference, notes (existing fields).
4. **Submit:** `POST /finance/payments/record/`. **Success screen:** reuse the existing print/download receipt UI (RecordTransactionPage currently has this — keep it), plus show `created_invoice` / `activated` badges ("Invoice auto-created", "Student activated") and a **Record Another** button.
- Keep `/bursar/transactions/new` route (same component, already registered at `App.tsx:321`).

### 4.4 Registry quick actions
`AcademicManagement.tsx` — replace the dead `more_horiz` with an actions cell:
- **Record Payment** → `navigate('/admin/finance/transactions/new', { state: { studentId: stu.id } })`.
- **Activate** (only when `status === 'registered'`) → `POST /students/students/{id}/verify/` + toast + refresh list.
- Keep a kebab for future (profile, documents) — or drop it entirely.

### 4.5 API service additions
Add to a finance API module (or inline in pages, matching existing pattern):
```
financeApi.recordPayment(payload)   // POST /finance/payments/record/
financeApi.quoteForStudent(id)      // GET  /finance/payments/quote/
financeApi.verifyStudent(id)        // POST /students/students/{id}/verify/
```

---

## 5. Data & edge cases

| Case | Behaviour |
| :--- | :--- |
| Student has an existing invoice for the year (paid or partial) | Reused — payment applies against its balance; `created_invoice=false`. No duplicate fee line items (existing guard). |
| No fee structures for the class | 400 with actionable message + link to Fee Setup. Registration still succeeds; payment simply can't be recorded yet. |
| No active academic year | Fallback to latest year (same as `generate`); if none at all, 400 "No academic year configured." |
| Amount > balance (existing invoice) | Rejected by `PaymentTransactionSerializer` (existing behaviour, `serializers.py:106`). |
| Amount > structure total (new invoice) | Rejected by the same cap after the invoice is built from structures. |
| Installment on auto-created invoice | Fully supported — invoice created with `total=Σ fees`, first payment marks `partial`, receipt prints running balance (receipts feature already shipped). |
| Duplicate parent email | `onboard_parent` raises — registration fails atomically with "A user with this email already exists." (No orphan student.) |
| Partial parent data (email but no name) | 400 before student creation; explicit message. |
| `registered` student, any payment | `activated=true`, student flips to `active`. Idempotent (only from `registered`). |
| Two admins record concurrently | Both run inside `transaction.atomic`; duplicate-invoice guard uses the same `InvoiceLineItem` existence check as today, so a second attempt reuses the first invoice instead of double-billing. |
| Bursar-only school | `record/` respects `CanWriteFinance` — admins see read-only quote but get the existing "restricted to the bursar" notice. |

---

## 6. Verification / test plan

1. **Backend** (`backend`, after changes): `python manage.py check`.
2. **API smoke tests** (temp script like the receipts work, using `admin@saintjoseph.sos`):
   - `POST /finance/payments/quote/?student=<registered-no-invoice>` → returns quote from structures.
   - `POST /finance/payments/record/` with a fresh student → 201, `created_invoice=true`, `activated=true`, invoice + receipt created; `GET /finance/transactions/{id}/receipt/` → 200 PDF.
   - Repeat `record/` for a second installment → reuses same invoice, `created_invoice=false`, invoice status `partial`, receipt balance correct.
   - `POST /students/students/` with full parent data → student + parent user + link created; parent temp password returned; duplicate email → atomic 400, no student row.
   - Overpay → 400. No structures → 400 message.
3. **Frontend**: `npm run build` (tsc + vite) and eslint on changed files (note: the admin finance pages already carry pre-existing `no-explicit-any` lint debt).
4. **Manual UX**: register a student with parent + placement → review card shows Section/Class/Series → Record Payment → pick section/class → student preselected → quote → pay → print receipt → registry row shows ACTIVE.

---

## 7. Decisions (confirmed 2026-08-11)

1. **No invoice at registration** — the invoice is never a manual step. `record/` lazily finds-or-creates the invoice **the moment a payment is recorded** (invisible plumbing; the admin only ever sees a payment record). No "Create invoice now" checkbox.
2. **Parent details: optional, all-or-nothing** — blank = skip; if any of name/email/phone filled, all three required, then a parent account is created + linked atomically with the student.
3. **Record Payment entry points** — working registry row menu + the post-registration success screen. No new student profile page in this iteration.
4. **Admission number redesign** — format becomes `{SCHOOL-INITIALS}-{YEAR}-{SECTION}-{SEQ}` (e.g. `SJCS-2026-ANG-0001`). Initials derived from `tenant.school_name`, sequence per (tenant, year, section). A management command renumbers existing students.
5. **Auto-created invoice due date** — today.
