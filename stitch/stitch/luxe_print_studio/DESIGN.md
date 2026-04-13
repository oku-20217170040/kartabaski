# Design System Strategy: The Editorial Printmaster

## 1. Overview & Creative North Star

**Creative North Star: "The Tactile Gallery"**
This design system moves beyond the utility of a standard printing service and enters the realm of a high-end lifestyle brand. The "Tactile Gallery" concept treats every digital interface like a premium printed specimen—think heavy-stock card, matte finishes, and intentional white space found in architectural journals.

By breaking away from rigid, boxy grids, we employ **intentional asymmetry** and **layered depth**. We replace harsh lines with tonal transitions, mimicking the way light hits a stack of premium paper. This approach elevates the printing business from a "copy shop" to a "creative partner," blending the freshness of organic commerce with the precision of professional production.

---

## 2. Colors

The palette is rooted in a "Modern Naturalist" aesthetic—fresh greens for growth and gold tones for premium craftsmanship, set against a neutral, high-end base.

### The Palette (Material Design Tokens)
*   **Primary (`#006D2F`):** Deep Forest Green. Used for authoritative actions and brand anchoring.
*   **Primary Container (`#25D366`):** Vibrant Mint. Used for highlights and "Fresh" indicators.
*   **Secondary (`#755B00`):** Muted Gold. Represents the luxury of custom printing.
*   **Surface / Background (`#F9F9F9`):** A warm, off-white that prevents screen fatigue and feels like premium unbleached paper.

### Strategic Color Rules
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. To separate the Hero from the Product Grid, transition from `surface` to `surface-container-low`. Use color shifts, not strokes, to define the architecture.
*   **Surface Hierarchy & Nesting:** Treat the UI as a physical stack.
    *   *Base:* `surface`
    *   *Section:* `surface-container-low`
    *   *Interactive Card:* `surface-container-lowest` (pure white) to make it "pop" forward.
*   **The "Glass & Gradient" Rule:** Floating navigation bars or product overlays should use **Glassmorphism**. Apply `surface` at 70% opacity with a `24px` backdrop blur to maintain context while ensuring legibility.
*   **Signature Textures:** For main CTAs, use a subtle linear gradient from `primary` to `primary_container` (angled at 135°) to give the button a "lithographic" depth that flat colors lack.

---

## 3. Typography

The system uses a high-contrast pairing of **Plus Jakarta Sans** for editorial impact and **Inter** for functional clarity.

*   **Display-LG (Plus Jakarta Sans, 3.5rem):** Reserved for bold brand statements. Use tight letter-spacing (-0.04em) to create a "custom-printed" feel.
*   **Headline-MD (Plus Jakarta Sans, 1.75rem):** Used for section headers. Always paired with generous top-margin to breathe.
*   **Body-LG (Inter, 1rem):** The workhorse for product descriptions. High line-height (1.6) is mandatory to mimic high-end magazine layouts.
*   **Label-MD (Inter, 0.75rem):** All-caps with increased letter-spacing (+0.05em) for technical printing specs (e.g., "GSM," "FINISH," "DPI").

---

## 4. Elevation & Depth

We move away from the "shadow-heavy" look of 2010s material design into **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-high` background. The eye perceives the lighter color as being closer to the viewer. This is our primary method of elevation.
*   **Ambient Shadows:** When a shadow is required (e.g., a floating "Upload Artwork" button), use a multi-layered shadow: `0px 10px 40px rgba(26, 28, 28, 0.06)`. It must feel like soft, ambient room light, never a dark smudge.
*   **The "Ghost Border" Fallback:** If a layout requires a boundary (like a search input), use the `outline-variant` token at **15% opacity**. It should be felt rather than seen.
*   **Glassmorphism:** Use for "Quick View" modals. A semi-transparent `surface-container-lowest` with a heavy blur creates a sophisticated "frosted acrylic" effect, common in high-end print shop interiors.

---

## 5. Components

### Buttons
*   **Primary:** Gradient (`primary` to `primary_container`), `xl` roundedness, bold `label-md` text.
*   **Secondary:** `surface-container-high` background with `on-surface` text. No border.
*   **Tertiary:** Text-only with a 2px underline in `secondary_fixed` that expands on hover.

### Cards (Product & Service)
*   Forbid divider lines. Use `md` or `lg` roundedness. 
*   **Structure:** Image at the top, followed by a `surface-container-lowest` content area. Use vertical white space (`24px`) to separate the title from the price.

### Selection Chips
*   Used for selecting paper weight or finish.
*   **Unselected:** `surface-container-high` with `on-surface-variant` text.
*   **Selected:** `primary` background with `on-primary` text. `full` roundedness for a pill shape.

### Input Fields (Order Customization)
*   Minimalist style. No background fill. Only a "Ghost Border" bottom-line.
*   Labels should use `label-sm` in `secondary` color to act as a sophisticated accent.

### Interactive Printing-Specific Components
*   **The "Texture Toggle":** A specialized radio button group that uses macro-photography of paper textures as the background of the toggle options (Matte vs. Glossy).
*   **The "Live-Price" Floating Bar:** A glassmorphic bar at the bottom of the screen that updates the total cost as the user changes printing specs.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins. If a section header is left-aligned, try right-aligning the "View All" link to create a dynamic visual path.
*   **Do** use `primary_fixed` (light green) as a background for promotional banners to keep the "Fresh" energy of the brand.
*   **Do** prioritize high-quality imagery of paper textures and ink finishes. The UI is the frame; the product is the art.

### Don't:
*   **Don't** use 100% black (`#000000`). Use `on-background` (`#1A1C1C`) to maintain a soft, premium ink feel.
*   **Don't** use standard `16px` padding everywhere. Vary padding (e.g., `32px` on sides, `64px` on top/bottom) to create an editorial rhythm.
*   **Don't** use dividers or "rules" to separate list items. Use a slight background shift on hover to indicate interactivity.