# School OS Implementation Plan v2

Complete implementation plan derived from the Psychology Map in `research.md`.

---

## PHASE 0: Landing Page Brand Rewrite — "The Notebook Era is Over"

**What:** Replace the hero section and rewrite the Problem section with the enemy narrative. The entire landing page gets a new emotional core.

**Files to modify:**

- `frontend/src/pages/public/LandingPage.tsx`

### A. Hero Section (replace entirely)

- New headline: *"Your school deserves better than a notebook."*
- Subhead: *"Paper registers. Lost records. Midnight report cards. The notebook era is over."*
- Visual: Side-by-side contrast — messy notebook (left, desaturated) vs clean School OS dashboard (right, vibrant)
- Primary CTA: *"Stop the chaos — Start Free"*
- Secondary CTA: *"See what you're escaping from"* (scrolls to Problem section)
- Stats strip stays but reworded to be more emotional

### B. Problem Section (rewrite as "The Enemy")

- Title: *"What The Notebook Costs You"*
- 4 cards, each with a hard-hitting stat:
  - *"10 hours a week on paperwork. That's 21 days a year. Gone."* (icon: `schedule`)
  - *"3 in 10 parents never see their child's report card on time."* (icon: `parent_optimize`)
  - *"Fees collected in cash envelopes. Nobody knows who paid."* (icon: `money_off`)
  - *"A student transfers. Their records? Lost."* (icon: `folder_off`)
- Each card has a red border-left (existing pattern) but with the new copy

### C. "Pick a Side" Section (new, insert after Problem section)

- Two columns: Left = "The Notebook" (gray, chaotic, crossed out), Right = "School OS" (colorful, organized, with checkmarks)
- Items compared: Attendance, Report Cards, Fee Tracking, Communication, Record Keeping
- CTA button at bottom: *"Choose your side"*

### D. Brand Voice Pass

- Rewrite ALL copy on the page to match the new voice: direct, sharp, slightly aggressive
- "School Management Software That Actually Works" → already good, keep or sharpen
- "Replace paper registers..." → replace with enemy narrative
- FAQ: Add a question about "Why the aggressive tone?" — answer: *"Because being polite hasn't fixed the problem. 80% of schools in Cameroon still run on paper. That's not a market opportunity. That's a crisis."*

**No new dependencies needed.**

---

## PHASE 1: Setup Progress Bar — "Clear Path to Start"

**What:** A setup progress bar on the admin dashboard that dynamically shows how much of the school is configured. No forced wizard — the admin completes items at their own pace, whenever they have the data ready.

### Files to create

- `frontend/src/components/admin/SetupProgressBar.tsx` — Progress bar + clickable checklist component

### Files to modify

- `frontend/src/pages/admin/dashboard/DashboardHome.tsx` — Import and render `<SetupProgressBar />` at top, pass existing KPI data as props

### Detailed Flow

1. **Dashboard loads**, `SetupProgressBar` receives `studentCount`, `classCount`, `hasFinance` as props from `DashboardHome`. It independently fetches report card count via `GET /academic/report-cards/`.
2. **Progress bar renders** at the top of the dashboard (before the header) showing:

   1. A horizontal progress bar: filled portion = completed items / 5
   1. Text: *"Your school is X% set up"*
   1. 5 clickable checklist items in a grid:
      - ✅ School info set up (always true if registered) → links to `/admin/settings`
      - ✅/○ Create classes (`classCount > 0`) → links to `/admin/academic/setup`
      - ✅/○ Enroll students (`studentCount > 0`) → links to `/admin/academic/students/new`
      - ✅/○ Generate report cards (fetched from API) → links to `/admin/academic/report-cards`
      - ✅/○ Configure fees (`hasFinance`) → links to `/admin/finance/fee-setup`
3. **Dismissal:** "Hide this" button sets `localStorage('sos-setup-dismissed', 'true')`. Component stops rendering.
4. **Auto-hide:** If all 5 items are complete (100%), the bar does not render at all.
5. **No forced onboarding wizard.** The admin explores and sets up whenever they're ready. The progress bar is a persistent, friendly nudge — not a gate.

---

## PHASE 2: Dashboard Redesign — "Status + Free Time"

**What:** Transform the current admin dashboard from a boring KPI list into an executive command center that looks impressive on screenshots and surfaces the 3 most urgent actions.

**Files modified:**

- `frontend/src/pages/admin/dashboard/DashboardHome.tsx` — Full rewrite

### Dashboard Layout (top to bottom)

**A. Welcome Header (personalized):**

- Time-aware greeting: *"Good morning, [First Name]"* with sun/cloud/moon icon
- School name from `tenants[0].school_name` via auth store (no longer hardcoded)
- *"Your school at a glance"* subtitle
- Action buttons: Export Audit, New Registration

**B. Executive KPI Strip (status play):**

- 4 large stat cards in a row:
  - **Students** (count, blue icon)
  - **Teachers** (count, violet icon)
  - **Attendance Rate** (percentage, color-coded: green >85%, amber 70-85%, red <70%) — fetched from `GET /attendance/sessions/dashboard-stats/`
  - **Fees Collected** (formatted as "8.2M CFA", amber icon, outstanding shown below in red)
- Each card has rounded-2xl corners, subtle icon, hover effects — designed for screenshots
- "Powered by School OS" small watermark below the strip

**C. Quick Actions Panel (free time play):**

- Title: *"What needs your attention today"*
- Dynamic cards based on real API data:
  - If outstanding fees > 0 → *"Send fee reminders"* with amount, links to arrears
  - If students > 0 → *"Generate report cards"*, links to report cards
  - If attendance < 85% → *"Check today's attendance"* with rate, links to attendance
  - If students = 0 → *"Enroll your first student"* (urgent), links to add student
  - If classes = 0 → *"Create your first class"* (urgent), links to academic setup
  - If no finance → *"Configure fee structure"* (urgent), links to fee setup
- Max 3 items shown (most urgent first)
- Each has colored icon, urgency dot (red pulse), detail text, arrow
- If nothing needs attention: *"All clear! Your school is running smoothly."* with checkmark

**D. Quick Navigation Cards:**

- Preserved from original: Register Student, Record Payment, ID Cards, Report Cards, Announcement
- Under a *"Quick access"* heading

**E. Recent Activity Feed:**

- Compact timeline of last 5 audit log entries
- Each row: status icon (green check / red error), description, user + module, relative timestamp ("3h ago")
- "View all" link to `/admin/audit`
- Lazy-loaded — click "Load recent activity" to fetch

**F. System Audit Trail — Collapsible (preserved):**

- Full audit table with all original columns (Action, Module, User, Timestamp, Status)
- Inline Export button in header when expanded
- "View Full History" link

**G. Setup Progress Bar (from Phase 1):**

- Rendered at the very top of the dashboard
- Dismissible, auto-hides at 100%

### New Data Source

- Added `GET /attendance/sessions/dashboard-stats/` to the parallel KPI fetch for attendance rate

**No new dependencies.** All data comes from existing APIs.

---

## PHASE 3: Success Celebrations + Warm Copy — "Confidence" (Done)

**What:** Make every interaction feel rewarding. Replace cold, technical copy with warm, encouraging language.

**Files created:**

- `frontend/src/components/ui/ConfettiBurst.tsx` — Pure CSS confetti celebration component

**Files modified:**

- `frontend/src/pages/admin/academic/ReportCardManagement.tsx` — Confetti + warm toast on generation
- `frontend/src/pages/admin/academic/IDCardGenerator.tsx` — Confetti + warm toast on generation
- `frontend/src/pages/admin/academic/AcademicSetup.tsx` — 4 warm toasts + 4 warm empty states
- `frontend/src/pages/admin/academic/GradingControls.tsx` — Warm toast + warm empty state
- `frontend/src/pages/admin/academic/Timetables.tsx` — Warm toast
- `frontend/src/pages/admin/academic/Examinations.tsx` — Warm toast
- `frontend/src/pages/admin/academic/students/AddStudentPage.tsx` — Warm toast
- `frontend/src/pages/admin/finance/InvoiceManagement.tsx` — 2 warm toasts + warm empty state
- `frontend/src/pages/admin/finance/FinanceTreasury.tsx` — Warm empty state
- `frontend/src/pages/admin/finance/FinanceFeeSetup.tsx` — 2 warm empty states
- `frontend/src/pages/admin/operations/TeacherDirectory.tsx` — Warm empty state
- `frontend/src/pages/admin/operations/FacultyPerformance.tsx` — 2 warm toasts
- `frontend/src/pages/admin/operations/DisciplineAndTransfers.tsx` — Warm toast
- `frontend/src/pages/admin/settings/Settings.tsx` — Warm toast
- `frontend/src/pages/admin/attendance/AttendanceDashboard.tsx` — 2 warm toasts
- `frontend/src/pages/admin/compliance/ComplianceCenter.tsx` — Warm toast
- `frontend/src/components/admin/staff/TeachingAssignmentModal.tsx` — Warm toast
- `frontend/src/pages/parent/ParentSettings.tsx` — Warm toast

### Specific Changes

**A. Success Toast Messages (across all pages):**

| Old                                   | New                                                               |
| ------------------------------------- | ----------------------------------------------------------------- |
| "Report cards generated successfully" | "12 report cards generated! Parents are going to love these."     |
| "Student added successfully"          | "Welcome aboard! [Name] is now registered."                       |
| "Fee reminder sent"                   | "Fee reminder sent to 8 parents — nice work!"                    |
| "ID cards generated"                  | "ID cards ready! [X] students now have their official school ID." |
| "Saved"                               | "All set!"                                                        |

**B. Celebration Moments:**

- After batch report card generation: Show a brief CSS confetti burst (10-15 animated dots falling, 1.5s duration, pure CSS, no library)
- After adding first student: *"Your first student! Every journey starts with one."*
- After generating first report card: *"Your first report card! This is what parents will remember."*
- After collecting first fee: *"First payment recorded! Your school's finances are now digital."*

**C. Empty State Rewrites:**

| Page         | Old                              | New                                                                                  |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------ |
| Report Cards | "No report cards generated yet." | "No report cards yet. Generate your first ones — parents are waiting!" + CTA button |
| Students     | "No students registered yet."    | "Your school roster is empty. Let's add your first student." + CTA button            |
| Teachers     | "No teachers found."             | "No teachers added yet. Build your faculty." + CTA button                            |
| Finance      | "No transactions recorded yet."  | "No payments recorded yet. Set up your fee structure to get started." + CTA button   |
| Audit        | "No audit logs available."       | "Nothing logged yet. Activity will appear here as you use the platform."             |

**D. Color-Coded Urgency System:**

- Dashboard KPIs use: Green (>85%), Amber (70-85%), Red (<70%)
- Fee collection: Green (>80% collected), Amber (50-80%), Red (<50%)
- Never make an entire page red. Amber is sufficient for "needs attention."

**No new dependencies.** Pure copy + CSS changes.

---

## PHASE 4: WhatsApp Report Card Delivery — "Free Time"

**What:** One-click delivery of report cards to parents via WhatsApp.

**Approach:** WhatsApp Business API integration deferred. For now, implement **WhatsApp Web deep link** as the free, immediate solution.

### Files to create

- `frontend/src/services/whatsappApi.ts` — Helper to generate WhatsApp deep links

### Files to modify

- `frontend/src/pages/admin/academic/ReportCardManagement.tsx` — Add "Send via WhatsApp" button per student

### Implementation

- After generating a single report card, show a "Send to Parent" button
- Click opens: `https://wa.me/{phone}?text={encoded_message}` where message includes a brief text + the PDF as an attachment note
- Since WhatsApp Web links can't attach PDFs directly, the flow is:

  1. Generate the PDF (already done)
  2. Show "Send via WhatsApp" button
  3. On click: copy a pre-written message to clipboard + open WhatsApp with parent's number
  4. Message: *"Dear Parent, [Student Name]'s report card for [Term] [Year] is ready. Please collect it from the school office. — [School Name]"*
  5. The PDF is already downloaded on the admin's device; they can forward it manually
- For batch: Generate ZIP → show "Send all via WhatsApp" → iterate through students, opening WhatsApp for each parent with their phone number (with a 2-second delay between each to avoid spam blocking)

**Future:** Replace with WhatsApp Business API when ready (the `whatsappApi.ts` helper makes this a drop-in replacement).

**No new backend changes needed.**

---

## PHASE 5: "School Year in Review" Auto-Generated PDF — "Status" (Done)

**What:** An auto-generated annual summary PDF that school owners can print and frame in their office.

**Files created:**

- `frontend/src/components/admin/SchoolYearReview.tsx` — Styled review page with print-to-PDF support

**Files modified:**

- `frontend/src/services/reportsApi.ts` — Added `getYearReview()` method
- `frontend/src/pages/admin/dashboard/DashboardHome.tsx` — Added "Year Review" quick access card
- `frontend/src/App.tsx` — Added `/admin/year-review` route
- `backend/apps/reports/views.py` — Added `year_review` endpoint
- `backend/apps/reports/urls.py` — Registered `/year-review/` URL

### The PDF Contains

1. **Cover page**: School name, logo, "School Year in Review 2025/2026", generated date
2. **Key metrics**: Total students, teachers, classes, attendance rate, fee collection rate
3. **Academic performance**: Average scores by class, top performers, improvement trends
4. **Financial summary**: Total collected, outstanding, expenses, net
5. **Growth**: New students this year, retention rate
6. **"Powered by School OS"** footer (premium branding)

**Backend endpoint:** `GET /reports/year-review/?academic_year_id=XXX` — returns aggregated data from existing models (students, fees, attendance, report cards). No new models needed.

**PDF generation:** Use the existing report card PDF infrastructure (`report_card_style.py` + `utils.py`) with a new template function.

---

## PHASE 6: Comparison Metrics + Time-Saved Counter — "Retention" (Done)

**What:** Gamification hooks that make users feel their school is improving and that School OS is saving them time.

**Files created:**

- `frontend/src/components/admin/TimeSavedWidget.tsx` — Shows estimated hours saved based on audit log actions
- `frontend/src/components/admin/ComparisonWidget.tsx` — Shows school performance vs platform benchmarks

**Files modified:**

- `frontend/src/pages/admin/dashboard/DashboardHome.tsx` — Added both widgets below KPI strip
- `frontend/src/services/reportsApi.ts` — Added `getComparison()` method
- `backend/apps/reports/views.py` — Added `school_comparison` endpoint
- `backend/apps/reports/urls.py` — Registered `/comparison/` URL

### Time-Saved Counter

- Estimate based on actions taken:
  - Each report card generated = 15 minutes saved (vs manual)
  - Each attendance record = 2 minutes saved
  - Each fee payment recorded = 5 minutes saved
  - Each announcement sent = 10 minutes saved
- Show: *"This month, School OS saved you ~18 hours"*
- Data source: audit logs (count actions by type, multiply by time estimates)
- Store cumulative estimate in localStorage so it persists

### Comparison Metrics (opt-in)

- *"Your school's average: 82%"*
- *"Regional average: 71%"*
- *"You're in the top 15% of schools on School OS"*
- Backend: `GET /reports/comparison/?academic_year_id=XXX` — compares this school's metrics against anonymized aggregate of all schools
- **Privacy:** This requires collecting anonymized metrics. For MVP, can use hardcoded "typical" benchmarks until enough data exists

---

## DEPENDENCY CHANGES

**None required.** All work uses existing dependencies (React, Zustand, Tailwind, axios, lucide-react, Material Symbols). The CSS confetti effect uses pure CSS keyframes. PDF generation uses the existing backend infrastructure.

**Optional:** `canvas-confetti` package (~3KB) for a more polished celebration effect in Phase 3. Not required.

---

## IMPLEMENTATION ORDER

| Phase                                  | Days     | Depends On                  |
| -------------------------------------- | -------- | --------------------------- |
| **0** — Landing Page Rewrite    | 2-3 days | Nothing                     |
| **1** — Setup Progress Bar      | 0.5 days | Nothing                     |
| **2** — Dashboard Redesign      | Done     | Phase 1 (progress bar)      |
| **3** — Success Celebrations    | Done     | Nothing                     |
| **4** — WhatsApp Delivery       | 1-2 days | Nothing                     |
| **5** — Year Review PDF         | Done     | Phase 2 (dashboard button)  |
| **6** — Comparison + Time Saved | Done     | Phase 2 (dashboard widgets) |

**Total: ~3-5 days of work** (Phase 1 + 2 + 3 + 5 + 6 complete)

**Parallelizable:** Phases 0, 1, 3, and 4 can all start simultaneously. Phases 2, 5, 6 are sequential.

**Recommended start:** Phase 0 (Landing Page) + Phase 1 (Setup Progress Bar) in parallel — they're independent and together they create the complete first impression: the landing page hooks them, the progress bar guides setup.
