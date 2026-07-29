# Design System Specification: The Institutional Ledger

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Architectural Monolith."** 

In an institutional environment, software must feel as stable and authoritative as the physical stone of a university hall, yet as fluid as modern digital data. We move beyond the "generic SaaS" look by rejecting the cluttered grid in favor of **intentional negative space** and **tonal layering**. This system treats data as an editorial centerpiece—clean, high-contrast, and deeply structured. We achieve "government-grade professionalism" not through complexity, but through the sophisticated elimination of the unnecessary.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep authority and high-utility status indicators. We utilize a refined Material Design 3 tonal approach to ensure the UI feels "built," not "painted."

### Palette Strategy
*   **Primary (Authority):** `primary` (#00236f) and `primary_container` (#1E3A8A). Use these to anchor the user’s eye on institutional actions.
*   **Secondary (Financial Health):** `secondary` (#006c49). Reserved exclusively for positive growth, tuition cycles, and fiscal stability.
*   **Tertiary (The Alert System):** `on_tertiary_container` (#EF9900) for pending states and `error` (#BA1A1A) for urgent faculty or safety alerts.

### The "No-Line" Rule
**1px solid borders are strictly prohibited for sectioning.** 
Visual boundaries must be defined through background color shifts. Use `surface_container_low` for sections sitting on a `background` (#F7F9FB). This creates a sophisticated, "app-like" feel that mimics high-end editorial layouts rather than a spreadsheet.

### Surface Hierarchy & Nesting
Treat the dashboard as a series of nested physical layers. 
1.  **Level 0 (Base):** `background` (#F7F9FB) – The canvas.
2.  **Level 1 (Sectioning):** `surface_container_low` (#F2F4F6) – Large structural zones.
3.  **Level 2 (The Card):** `surface_container_lowest` (#FFFFFF) – The primary data container. 
By placing a white card on an off-white section, we create a "soft lift" that defines the workspace without visual noise.

### Signature Textures
Main CTAs should utilize a subtle linear gradient transitioning from `primary` to `primary_container` (135° angle). This adds a "visual soul" and depth that differentiates the interface from flat, budget-grade software.

---

## 3. Typography: The Editorial Scale
We use **Inter** exclusively. To achieve "Institutional Authority," we leverage extreme weight contrast and generous leading.

*   **Display (Metrics):** `display-md` (2.75rem, Semi-Bold, -0.02em tracking). Used for high-level KPIs (e.g., Total Enrollment).
*   **Headlines (Navigation):** `headline-sm` (1.5rem, Medium). Used for module titles.
*   **Titles (Content):** `title-md` (1.125rem, Semi-Bold). Used for card headers.
*   **Body (Data):** `body-md` (0.875rem, Regular, 1.5 line-height). The workhorse for all institutional records.

**Editorial Rule:** Always pair a `title-md` header with a `label-sm` (uppercase, 0.05em letter-spacing) sub-header to create a clear, tiered hierarchy of information.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** and **Ambient Light**, never through heavy, muddy shadows.

*   **The Layering Principle:** Avoid shadows for static cards. Rely on the transition from `surface_container_low` to `surface_container_lowest` for definition.
*   **Ambient Shadows:** For floating elements (Modals/Dropdowns), use: `box-shadow: 0 20px 25px -5px rgba(25, 28, 30, 0.04), 0 10px 10px -5px rgba(25, 28, 30, 0.02);`. The shadow color must be a tinted version of `on_surface` to mimic natural light.
*   **The "Ghost Border":** If a data table requires containment, use a 1px border using `outline_variant` at **15% opacity**. 100% opaque lines are forbidden.
*   **Glassmorphism:** Use for floating action bars: `surface_container_lowest` with 80% opacity and a `backdrop-filter: blur(12px)`.

---

## 5. Components
All components utilize the **`xl` (1.5rem)** or **`lg` (1rem)** roundedness scale to soften the "industrial" nature of data-heavy dashboards.

*   **The Persistent Sidebar:** High-contrast. Use `inverse_surface` (#2D3133) for the background and `inverse_primary` for the active state indicator. This provides a "dark mode" anchor to the left that frames the content area.
*   **Institutional Cards:** Use `rounded-xl` (1.5rem). Forbid the use of divider lines within cards. Separate content using `spacing-6` (1.5rem) or a `surface_variant` background tint for header areas.
*   **Buttons:** 
    *   *Primary:* `primary_container` background, `on_primary` text. No border.
    *   *Secondary:* `surface_container_highest` background, `on_surface` text.
*   **Input Fields:** Use `surface_container_lowest` with a "Ghost Border." On focus, the border should transition to `primary` at 2px thickness.
*   **Data Chips:** Use `secondary_fixed` (#6FFBBE) for financial "Paid" statuses and `tertiary_fixed` (#FFDDB8) for "Pending." These should be low-saturation to keep the focus on the data, not the badge.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `spacing-12` (3rem) for the outer padding of the dashboard to allow the "Architectural Monolith" to breathe.
*   **Do** use asymmetrical layouts for the header section (e.g., a large greeting on the left, three small KPIs on the right).
*   **Do** ensure all interactive elements have a minimum height of `spacing-10` (2.5rem) for accessibility and touch-readiness.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#191C1E) for a softer, more premium reading experience.
*   **Don't** use zebra-striping for tables. Instead, use a `surface_variant` hover state to highlight the active row.
*   **Don't** use standard blue for links. Use `primary` (#00236F) with a `surface_tint` underline for a bespoke institutional look.