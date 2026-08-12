# Lesson Planner & Work Coverage — Implementation Plan

**Status:** Approved (decisions confirmed 2026-08-11)
**Owner:** School OS core
**Target:** Lessons are planned for the whole school year (every term, every week) and entered into the system up front. Teachers open their term plan, click **Done** on each week they cover (their click is the signature of record — who + when), and admins see live work coverage per class + subject.

---

## 1. What the current system already gives us (don't rebuild)

| Capability | Where it lives today |
| :--- | :--- |
| Per-class + subject + term + week plan rows with a uniqueness constraint | `SchemeOfWork` (`backend/apps/logbook/models.py:5`, `unique_together` on `[tenant, academic_year, term, subject, class_obj, week_number]`) |
| Teacher-scoped read filtering via `TeachingAssignment` | `SchemeOfWorkViewSet.get_queryset` (`logbook/views.py:153`) |
| Idempotent save keyed on the unique week tuple | `perform_create` uses `update_or_create` (`logbook/views.py:169`) |
| Teacher identity + assignment context on every teacher page | `teacherStore.activeAssignment` (`frontend/src/stores/teacherStore.ts`) |
| Admin route for Scheme of Work | `/admin/academic/curriculum` → `CurriculumCoverage.tsx` |
| 2-second debounce auto-save with `saved/saving/unsaved` chip | `TeacherAssessmentsPage` (the pattern the planner should reuse) |
| Signature/lock pattern | `LogbookEntryViewSet.sign` (`logbook/views.py:226`) |

### The core problem
- `TeacherPlannerPage.tsx` is a **mock**: it never loads a plan, hardcodes `week_number: 14`, and collapses the 5E fields into one `objectives` text blob. Every save overwrites the same scheme row.
- `CurriculumCoverage.tsx` (admin) is a **read-only list of raw rows** with fake progress (`pct(s)` returns 0) and dead "Validate Logbooks" / "Upload Scheme" buttons.
- Nothing lets a teacher **record that a week was actually taught** (`SchemeOfWork` has no status, no taught timestamp, no teacher).
- There is no way to **fill a full year's plan up front** (no bulk entry / generate / import).
- The backend has a weird `perform_create` fallback (`Subject.objects.filter(...).first()` when ids are missing) that silently picks the wrong subject/class.

---

## 2. Goals (the ask → deliverables)

1. **Full-year plans, filled from the start.** A plan exists for **every term and every week** of the school year per class + subject. Admins fill it in bulk: a **Generate Term Plan** action creates weeks 1–N with placeholder topics, and a **CSV import** pastes the teacher-produced year plan into the system in one go.
2. **Admins fill; teachers mark done.** Studies Office owns the plan (add / edit / delete weekly rows, generate, import). Teachers see their class + subject plan for the term and click **Done** per week — that click is the **signature of record** (records `taught_by` teacher + `taught_at` timestamp). Teachers can Undo and add teaching notes.
3. **Work coverage is real.** Admin coverage dashboard shows planned vs taught, coverage % per class + subject, the weekly breakdown (which weeks are taught, by whom, when), and a school-wide summary.
4. **The planner page becomes a real tool.** No more mock 5E form — it becomes the teacher's working view of the term plan with Done buttons, notes auto-save, and a term progress header.

### Design principle
The **Scheme of Work row is the lesson unit.** One row = one week of teaching for one class + subject. This matches the classic scheme-of-work model teachers already produce on paper, keeps the existing model + uniqueness constraint, and gives admins a coverage % that is simply `taught weeks / planned weeks`.

---

## 3. Backend design

### 3.1 Model — `SchemeOfWork` extended (`logbook/models.py`)

New fields (all added in migration `0002`):

| Field | Type | Purpose |
| :--- | :--- | :--- |
| `expected_outcome` | Text, blank | What learners should be able to do after the week |
| `essential_knowledge` | Text, blank | Key knowledge / exercises |
| `homework` | Text, blank | Weekly homework |
| `status` | `planned` / `taught`, default `planned` | Lifecycle state (decision 3: planned → taught) |
| `taught_at` | DateTime, null | When the teacher clicked Done |
| `taught_by` | FK `staff.Teacher`, SET_NULL, null | Who signed the week as taught |
| `notes` | Text, blank | Teacher's teaching notes (auto-saved from the planner) |

`unique_together`, ordering, and all existing fields are unchanged. Week numbers repeat per term (1..N each term), which is exactly how a full-year plan is expressed.

### 3.2 Serializers (`logbook/serializers.py`)

Split into two serializers selected by role:

- **`SchemeOfWorkAdminSerializer`** (admins): `subject`, `class_obj`, `academic_year`, `term`, `week_number`, `topic`, `objectives`, `expected_outcome`, `essential_knowledge`, `homework`, `status`, `notes`. Server-owned: `id`, `tenant`, `taught_by`, `taught_at` read-only.
- **`SchemeOfWorkTeacherSerializer`** (teachers): the full plan read-only (including `class_name`, `subject_name`, `term_name`, `teacher_name` from `taught_by`), plus **`notes` writable**. `status` / `taught_by` / `taught_at` are never settable by a teacher via PATCH — only through the `mark_taught` / `mark_planned` actions.

Both add display fields: `class_name`, `subject_name`, `term_name`, `teacher_name` (from `taught_by.user.full_name`).

### 3.3 Views (`logbook/views.py`) — `SchemeOfWorkViewSet` rewrite

Permission model:
- **Admin / super_admin**: full CRUD + `generate` + `import`.
- **Teacher**: list/retrieve their assigned plans, `mark_taught`, `mark_planned`, update `notes`. Any write that isn't the teacher's own assignment is rejected (403).

Queryset: keep the existing admin→all / teacher→assignment-scoped filter, and add query-param filtering: `?subject=`, `?class=`, `?term=`, `?academic_year=`, `?status=`.

`perform_create` / `perform_update`: resolve `subject`, `class_obj`, `term`, `academic_year` **explicitly from the request data** (each must belong to the tenant; missing ids → 400, no more silent `.first()` fallback). Save is idempotent via `update_or_create` on the unique tuple, so admin edits to an existing week update in place.

### 3.4 New endpoints

| Method & Path | Access | Purpose |
| :--- | :--- | :--- |
| `POST /api/v1/logbook/schemes/` | admin | Create / upsert a weekly plan row |
| `PATCH /api/v1/logbook/schemes/{id}/` | admin (plan fields) / teacher (`notes` only) | Edit |
| `DELETE /api/v1/logbook/schemes/{id}/` | admin | Remove a week |
| `POST /api/v1/logbook/schemes/{id}/mark_taught/` | teacher (own assignment) | Click **Done** → status `taught`, records `taught_by` + `taught_at` |
| `POST /api/v1/logbook/schemes/{id}/mark_planned/` | teacher (own assignment) | **Undo** → back to `planned`, clears `taught_by`/`taught_at` |
| `POST /api/v1/logbook/schemes/generate/` | admin | Create weeks 1–N (default 14, `weeks` param) for `subject`+`class_obj`+`term`+`academic_year` with placeholder topics ("Week N — Topic"), skipping weeks that already exist |
| `POST /api/v1/logbook/schemes/import/` | admin | Bulk fill from CSV text: `csv_text` + `subject`+`class_obj`+`term`+`academic_year`. Columns: `week_number,topic,objectives,expected_outcome,essential_knowledge,homework` (header row skipped, parsed with Python `csv`). Upserts; reports created/updated/errors |
| `GET /api/v1/logbook/schemes/coverage/?term=&academic_year=` | admin + teacher | School-wide summary grouped by class + subject: `[{class_id, class_name, subject_id, subject_name, total_weeks, taught_weeks, progress, teacher_name}]` (teacher sees only their own rows) |

The `mark_taught` guard: the teacher must hold a `TeachingAssignment` for `(subject, class_obj)` **and** that assignment's `academic_year` must match the scheme's `academic_year`.

### 3.5 Notes / non-goals
- `CurriculumModule` / `CurriculumLesson` (the subject-level "Program Coverage" page) stays as-is — it's syllabus-level; the new feature is class-level work coverage. No changes to `LogbookEntry`.
- No new app, no new tables, no changes to the timetable models.

---

## 4. Frontend design

### 4.1 `TeacherPlannerPage.tsx` — rewritten, same route `/teacher/planner`

- **Context header**: class + subject from `activeAssignment`, term selector (default = current term by date, fallback term 1), term progress bar (`taught/planned` + %).
- **Week list**: one card per planned week (from `GET /logbook/schemes/?subject=&class=`): week number, topic, objectives, expected outcome, essential knowledge, homework; status badge (**Planned** / **Done**); **"Mark as Done"** button (→ `mark_taught`) and **"Undo"** (→ `mark_planned`); taught-by + taught-at caption; notes textarea with the 2-second debounce auto-save (`PATCH {id}` `notes` only) and `saved/saving/unsaved` chip.
- **Empty state**: "No lessons planned for this class yet — your school office will fill in the year plan." (the `filled from the start` promise, honest when the admin hasn't generated yet).

### 4.2 `CurriculumCoverage.tsx` (admin) — rebuilt, same route `/admin/academic/curriculum`

Two tabs:
- **Work Coverage**: KPIs (planned weeks, taught weeks, remaining, coverage %) for the selected term; school-wide summary table (Class | Subject | Planned | Taught | % | Teacher) from `GET /logbook/schemes/coverage/`; click a class+subject → weekly breakdown table (week, topic, status, taught by, taught at).
- **Scheme Editor**: pick Class + Subject + Term (+ year) → edit table of weekly rows (topic, objectives, expected outcome, essential knowledge, homework) with inline save/delete; **Generate Term Plan** button (weeks 1–14); **Import CSV** button (file → `FileReader` → `csv_text` → `import/`). Uses the existing `api` service and toast patterns.

### 4.3 `useTeacherData.ts` — new methods
- `fetchSchemes(filters)` → `GET /logbook/schemes/`
- `saveScheme(data)` / `deleteScheme(id)` (admin editor)
- `markTaught(id)` / `markPlanned(id)`
- `updateSchemeNotes(id, notes)` (teacher auto-save)
- `generateSchemes(payload)` / `importSchemes(payload)`
- `fetchCoverage(filters)` → `GET /logbook/schemes/coverage/`

### 4.4 Routes & nav
Paths stay the same: teacher `/teacher/planner` (sidebar "Lesson Planner"), admin `/admin/academic/curriculum` (Studies Office → "Scheme of Work"). No new routes.

---

## 5. Validation & edge cases

- **Teacher marks a week not assigned to them** → 403 (assignment guard on subject + class + academic_year).
- **Duplicate week** (admin create/import/generate) → upsert, never a duplicate row.
- **No scheme rows for a class+subject yet** → teacher empty state; admin "Generate Term Plan" affordance.
- **CSV with bad rows** → skipped + reported (`week N skipped: missing topic`), valid rows still saved; response includes `created` / `updated` / `errors` counts.
- **Auto-save vs Done race** → Done click is a discrete action; notes auto-save only fires on `unsaved`, so a click doesn't get overwritten by a stale timer (clear timer on mark).
- **Cross-year plans** → weeks are keyed per term, so a full year = term 1 + 2 + 3 rows; the teacher planner's term selector surfaces them all.
- **Term/year resolution** → active academic year when not specified; current term by date (term containing today), fallback to `order_number=1`.

---

## 6. Rollout & verification

1. Migration `0002` applied.
2. `python manage.py check` clean.
3. Smoke test (API-level, against the live `school_os` DB with `X-Tenant-ID`): admin creates a scheme week; teacher (assigned) sees it; `mark_taught` sets status + `taught_by` + `taught_at`; `mark_planned` undoes; `generate` fills weeks 1–14; `import` parses CSV and upserts; `coverage` returns per-class+subject summary; unassigned teacher gets 403. Test rows cleaned up afterwards.
4. `tsc -b` clean; `npx vite build` exit 0.
5. Manual: admin generates a term plan → teacher sees it in Lesson Planner → clicks Done → admin sees coverage update live.
