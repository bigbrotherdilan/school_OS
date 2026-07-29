# Design System Strategy: The Focused Academic

## 1. Overview & Creative North Star: "The Digital Atheneum"
This design system is built to transform the chaotic classroom environment into a sanctuary of high-performance focus. Our Creative North Star is **"The Digital Atheneum"**—a space that feels as authoritative as a private library but as efficient as a modern flight deck.

To move beyond the "standard dashboard" look, this system rejects the rigid, boxy constraints of traditional SaaS. We embrace **Editorial Asymmetry**: using large `display-lg` typography to anchor views and generous, non-uniform whitespace (`spacing.16` to `spacing.24`) to create "breathing zones." We treat the UI not as a grid of data, but as a curated collection of academic insights, utilizing layered surfaces and soft, ambient depth to guide the teacher’s eye toward what matters most.

---

## 2. Color & Tonal Depth
We leverage a sophisticated palette where color represents "status" without screaming for attention.

### The Palette
- **Primary (Authority):** `primary` (#00236f) and `primary_container` (#1E3A8A). Use these for high-level navigation and core identity.
- **Secondary (Completion):** `secondary` (#006c49). Use for "Task Complete" states to instill a sense of calm achievement.
- **Tertiary (Urgency):** `tertiary_fixed_dim` (#FFB95F). Use for pending items to provide a warm, non-alarming nudge.
- **Error (Action Required):** `error` (#BA1A1A). Use sparingly for missing assignments or critical alerts.

### The "No-Line" Rule
**Borders are prohibited for sectioning.** To define the architecture of a page, use background color shifts. A `surface_container_low` section sitting on a `surface` background provides all the separation a professional eye needs. This creates a "seamless" interface that reduces visual noise and cognitive load.

### Signature Textures & Glassmorphism
To achieve a premium feel, floating elements (like mobile FABs or top-layer modals) should utilize **Glassmorphism**. Use a semi-transparent `surface_container_lowest` (80% opacity) with a `backdrop-blur` of 12px. For main CTAs, apply a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle to add "visual soul."

---

## 3. Typography: Editorial Authority
We use **Inter** exclusively, but we treat it with editorial intent. The hierarchy is designed to be "Inspector-Ready"—meaning a principal should be able to read the room's status from three feet away.

- **Display Scale:** Use `display-md` for dashboard greetings or empty-state headers. This provides a bold, confident anchor for the layout.
- **Headline & Title:** `headline-sm` is your workhorse for card titles. It should be paired with `spacing.3` padding to ensure the text has room to breathe.
- **Body & Label:** Use `body-md` for student data. `label-sm` is reserved for "metadata" (timestamps, ID numbers), set in `on_surface_variant` to recede visually.

**Style Note:** Always use a "Leaded" approach. Increase the line-height of `body-lg` to ensure that long-form teacher notes or curriculum descriptions remain legible during a busy transition period.

---

## 4. Elevation & Depth: The Layering Principle
Depth in this system is achieved through **Tonal Layering** rather than structural lines.

- **The Stack:** 
  - Level 0 (Base): `surface` (#F7F9FB)
  - Level 1 (Sectioning): `surface_container_low`
  - Level 2 (Cards/Content): `surface_container_lowest` (#FFFFFF)
- **Ambient Shadows:** When a component must "float" (e.g., an active assignment card), use a shadow with a 24px blur, 0px spread, and 4% opacity of the `on_surface` color. It should feel like a natural shadow cast on a paper sheet, not a digital effect.
- **The "Ghost Border" Fallback:** If a container requires extra definition (e.g., high-contrast accessibility), use the `outline_variant` at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components & Primitive Logic

### Cards & Lists (The Academic Record)
Cards must use `rounded.lg` (1rem) for a soft, approachable feel. 
- **Constraint:** **Forbid divider lines.** Separate list items using `spacing.2.5` of vertical whitespace. 
- **The "Active State":** An active list item should shift background to `primary_fixed` rather than gaining a border.

### Buttons (Tactile Action)
- **Primary:** Gradient fill (`primary` to `primary_container`), `rounded.full`, and `spacing.4` horizontal padding.
- **Secondary:** Transparent background with a `Ghost Border` and `on_primary_fixed_variant` text.
- **Touch Targets:** For teachers on the move, no interactive element should be smaller than 44x44px, regardless of its visual size.

### Input Fields (Effortless Data)
Inputs use `surface_container_highest` with a `rounded.sm` (0.25rem) corner. The focus state shouldn't just change the border color; it should trigger a subtle `surface_bright` background shift to "illuminate" the active field.

### Specialized Component: The "Focus Scrubber"
A horizontal scrollable chip-bar using `secondary_container` for quick-filtering classes. This allows for rapid thumb-navigation on tablets without the cognitive load of a dropdown menu.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `spacing.12` or `spacing.16` between major sections to emphasize the "Focused" spirit.
- **Do** use asymmetrical layouts (e.g., a wide 2/3 column for the main feed and a narrow 1/3 for "Quick Actions").
- **Do** favor `surface_tint` for subtle iconography to maintain a monochromatic, calm vibe.

### Don't
- **Don't** use pure black (#000000). Use `on_surface` (#191C1E) for high-contrast text.
- **Don't** use 1px solid dividers. They create "visual friction" that contradicts the "Flow" spirit.
- **Don't** cram data. If a table feels tight, move to a "List Card" format with increased vertical spacing.
- **Don't** use "Alert Red" for anything other than a literal missing requirement or system error. Keep the environment "Calm."