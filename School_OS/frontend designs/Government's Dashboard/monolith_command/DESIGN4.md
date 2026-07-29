# Design System Document: The Architectural Monolith

## 1. Overview & Creative North Star: The Architectural Monolith
This design system is engineered for the National Education Command Center. Our Creative North Star is **"The Architectural Monolith."** Like a civic monument, the interface must feel permanent, authoritative, and immovable. We achieve this not through heavy ornamentation, but through structural precision, intentional asymmetry, and "tonal mass."

The system breaks the "standard dashboard" template by treating the screen as a series of carved stone slabs rather than a flat grid. We utilize high-contrast typography scales and layered surfaces to guide the eye through dense data without the cognitive load of traditional borders or cluttered lines.

---

## 2. Colors & Surface Logic
The palette is rooted in institutional trust. We move beyond "flat blue" by utilizing a sophisticated range of container tiers to create a sense of physical depth.

### The Palette
- **Primary Authority:** `primary` (#00236f) and `primary_container` (#1e3a8a). Used for high-level navigation and core brand moments.
- **The Foundation:** `background` (#f7f9fb) and `surface` (#f7f9fb).
- **The Accents (Semantic):** 
    - **Health:** `on_secondary_container` (#57657a) / Custom Emerald.
    - **Warning:** `on_tertiary_container` (#f39461) / `tertiary_fixed` (#ffdbcb).
    - **Critical:** `error` (#ba1a1a).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
- *Instead of a border:* Use a `surface_container_low` section sitting on a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers to define importance:
1. **Base Layer:** `surface` (The floor).
2. **Structural Sections:** `surface_container_low` (Carved out areas).
3. **Primary Content Cards:** `surface_container_lowest` (#ffffff) (Raised elements).
4. **Active/High-Focus Overlays:** `surface_container_high`.

### The "Glass & Gradient" Rule
To escape the "government-default" look, use **Glassmorphism** for floating utility panels (e.g., filter drawers). 
- Use semi-transparent `surface_variant` with a 20px `backdrop-blur`.
- Apply a subtle linear gradient to main CTAs (transitioning from `primary` to `primary_container`) to provide "visual soul."

---

## 3. Typography: The Editorial Voice
We use **Public Sans** for display elements to evoke a modern, civic feel, and **Inter** for data-dense body text to ensure maximum legibility.

- **Display (Lg/Md/Sm):** Used for national-level metrics. High-contrast sizing creates an editorial hierarchy that screams "Authority."
- **Headlines:** `headline-lg` (2rem) for major module titles. Bold and unapologetic.
- **Title (Lg/Md/Sm):** Used for card headings. These should feel like labels in a museum—clear and functional.
- **Body & Labels:** `body-md` (0.875rem) is our workhorse. Use `label-sm` for metadata and micro-copy.

*Design Note: Use wide tracking (letter-spacing: 0.05em) on `label` styles to enhance the "Architectural" feel.*

---

## 4. Elevation & Depth: Tonal Layering
We do not use structural lines. Depth is achieved through **The Layering Principle**.

- **Ambient Shadows:** Only used for truly "floating" elements (Modals, Dropdowns). Use extra-diffused shadows: `box-shadow: 0 20px 40px rgba(15, 23, 42, 0.06);`. The shadow color must be a tinted version of `on_surface`, never pure black.
- **The Ghost Border Fallback:** If a container requires definition against a similar background (e.g., in accessibility edge cases), use the `outline_variant` at **10% opacity**.
- **The Monolith Depth:** A `surface_container_lowest` card placed on a `surface_container_low` background creates a natural, soft lift that mimics ambient light in a physical space.

---

## 5. Components

### Buttons & Interaction
- **Primary:** High-contrast `primary` background. Sharp `sm` (0.125rem) or `md` (0.375rem) corners to maintain the architectural feel.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Interaction:** On hover, shift the background color by one tier (e.g., `surface_container_low` to `surface_container_high`).

### Cards & Data Modules
- **Rule:** Forbid divider lines.
- **Separation:** Use vertical white space (`spacing.10` or `spacing.12`) or `surface` color shifts to separate content blocks. 
- **Header:** Title-sm typography with a `primary` color accent mark (a 4px vertical pill on the left).

### Command Inputs
- **Text Inputs:** Use `surface_container_low` as the background. On focus, transition to `surface_container_highest` with a 2px `primary` bottom-border only.
- **Chips:** Use `secondary_fixed` for inactive filters; `primary` with `on_primary` for active states.

### National Metric Tiles (Custom Component)
Large-scale numerical displays using `display-lg` typography. These should be placed on a `primary_container` background to create a "Command Center" focal point.

---

## 6. Do’s and Don’ts

### Do:
- **Use "Massive" Negative Space:** Give data room to breathe. Use `spacing.20` (4.5rem) between major sections.
- **Embrace Asymmetry:** A 3-column layout where the left column is significantly wider than the right creates a sophisticated, non-templated look.
- **Layering over Outlining:** Always ask, "Can I define this area with a subtle color change instead of a line?"

### Don’t:
- **Don't use Rounded Corners > 8px:** We are building a "Monolith," not a social app. Keep corners `sm` or `md`.
- **Don't use pure Black (#000):** Use `on_surface` (#191c1e) for all "black" text to maintain tonal warmth.
- **Don't use standard Tooltips:** Tooltips should follow the Glassmorphism rule—blurred and sophisticated, not opaque black boxes.