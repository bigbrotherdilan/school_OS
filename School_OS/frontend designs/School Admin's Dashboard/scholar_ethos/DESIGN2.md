# Design System Specification: Educational Operating Environment

## 1. Overview & Creative North Star
### The Creative North Star: "The Digital Curator"
This design system rejects the cluttered, bureaucratic aesthetic of traditional school management software. Instead, it adopts the persona of **The Digital Curator**: an interface that feels like a premium, quiet workspace. It combines the industrial reliability of a utility (Google Workspace) with the editorial elegance of a modern publication (Stripe/Notion).

To move beyond "standard" UI, we utilize **Intentional Asymmetry**. We break the rigid grid by using oversized typography to anchor layouts, allowing white space to act as a functional element rather than a void. The goal is a "High-Trust" environment where every pixel feels intentional, reducing cognitive load for educators and students alike.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep, authoritative blues and high-energy teals, balanced by a sophisticated neutral foundation.

### The "No-Line" Rule
**Borders are prohibited for sectioning.** To define boundaries, designers must use background color shifts (e.g., a `surface-container-low` card sitting on a `surface` background). Contrast is achieved through tonal depth, not 1px strokes.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, physical layers. 
- **Base Layer:** `surface` (#f7f9fb)
- **Content Blocks:** `surface-container-low` (#f2f4f6)
- **Interactive Cards:** `surface-container-lowest` (#ffffff)
- **Elevated Modals:** `surface-bright` (#f7f9fb) with Glassmorphism.

### The "Glass & Gradient" Rule
To avoid a flat "template" look, use **Backdrop Blurs** (`blur-xl`) on floating navigation bars and modals. 
- **Signature CTA Texture:** For primary actions, use a subtle linear gradient: `primary` (#00236f) to `primary-container` (#1e3a8a) at a 135-degree angle. This adds a "soul" to the button that flat hex codes cannot replicate.

---

## 3. Typography: Editorial Authority
We use **Inter** exclusively to maintain a monotype-inspired clarity, utilizing its variable weight axis to create hierarchy.

| Level | Token | Size | Weight | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | 3.5rem | 700 | -0.04em | Hero stats, Welcome headers |
| **Headline** | `headline-md`| 1.75rem | 600 | -0.02em | Section titles, Dashboard widgets |
| **Title** | `title-lg` | 1.375rem| 500 | 0 | Card titles, Modal headers |
| **Body** | `body-lg` | 1rem | 400 | 0 | General reading, Student bios |
| **Label** | `label-md` | 0.75rem | 600 | 0.05em | ALL CAPS; Metadata, Tags |

**Editorial Strategy:** Use `display-lg` in close proximity to `body-sm` to create a high-contrast, professional tension that feels "designed" rather than "defaulted."

---

## 4. Elevation & Depth
### The Layering Principle
Depth is achieved through **Tonal Layering**. Instead of a shadow, place a `surface-container-lowest` card (Pure White) onto a `surface-container` background. This creates a soft, natural lift suitable for fast-loading, mobile-first environments.

### Ambient Shadows
When a floating effect is required (e.g., a mobile FAB or a dropdown), use **Ambient Shadows**:
- **Color:** Tinted with `on-surface` at 6% opacity.
- **Values:** `0px 20px 40px rgba(25, 28, 30, 0.06)`
- **The "Ghost Border" Fallback:** If a container lacks contrast on low-end mobile screens, use a "Ghost Border": `outline-variant` at **10% opacity**. Never use 100% opaque borders.

---

## 5. Component Logic
### Buttons: The "Soft-Touch" Action
- **Primary:** Gradient (`primary` to `primary-container`), `rounded-md` (0.75rem), white text.
- **Secondary:** `secondary-container` background with `on-secondary-container` text. No border.
- **Tertiary:** Ghost style. `primary` text, no background until hover (`surface-container-low`).

### Input Fields: The "Quiet" Input
Inputs should not look like "boxes." Use `surface-container-highest` as a background with a `title-sm` label placed *above* the field, never inside as a placeholder. On focus, transition the background to `surface-container-lowest` and add a 2px `surface-tint` bottom-only highlight.

### Cards & Lists: The "Breathable" Container
- **Forbid Dividers:** Do not use lines to separate list items. Use **Vertical White Space** (`spacing-4` / 1.4rem) to create separation.
- **Interactive State:** On hover/tap, a card should shift from `surface-container-low` to `surface-container-lowest`.

### Specialized Component: The "Status Ribbon"
Instead of bulky badges, use a 4px vertical accent line on the left of a card using `tertiary` (Amber) or `secondary` (Teal) to denote priority or status without cluttering the layout.

---

## 6. Do’s and Don’ts

### Do
- **DO** use the `24` (8.5rem) spacing token for top-level page margins to create an elite, spacious feel.
- **DO** utilize `secondary-fixed-dim` for "Success" states to maintain the Teal brand identity.
- **DO** optimize for African markets by keeping heavy imagery to a minimum, relying on CSS-based shapes and typography for visual interest.

### Don't
- **DON'T** use pure black (#000000) for text. Use `on-surface` (#191c1e) to maintain a soft, premium contrast.
- **DON'T** use the `none` roundedness token. Every interactive element must have at least a `sm` (0.25rem) radius to feel "approachable."
- **DON'T** use "Standard" Material ripples. Use subtle opacity fades (0.1s ease-in-out) for a more sophisticated transition.

---

## 7. Spacing & Rhythm
The system operates on a responsive scale designed for mobile-first utility.
- **Container Padding:** Mobile (`spacing-3`), Desktop (`spacing-6`).
- **Section Gaps:** Always use `spacing-10` or higher to ensure the "No Clutter" mandate is met.