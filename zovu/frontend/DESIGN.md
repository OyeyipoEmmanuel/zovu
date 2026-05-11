---
name: Economic Clarity
colors:
  surface: '#101412'
  surface-dim: '#101412'
  surface-bright: '#363a37'
  surface-container-lowest: '#0b0f0d'
  surface-container-low: '#181d1a'
  surface-container: '#1c211e'
  surface-container-high: '#272b28'
  surface-container-highest: '#323633'
  on-surface: '#e0e3de'
  on-surface-variant: '#bfc9c0'
  inverse-surface: '#e0e3de'
  inverse-on-surface: '#2d312e'
  outline: '#89938b'
  outline-variant: '#3f4943'
  surface-tint: '#8ad6ae'
  primary: '#8ad6ae'
  on-primary: '#003823'
  primary-container: '#1a6b4a'
  on-primary-container: '#9be9bf'
  inverse-primary: '#1a6b4a'
  secondary: '#ffb95c'
  on-secondary: '#462a00'
  secondary-container: '#e29202'
  on-secondary-container: '#523200'
  tertiary: '#ffb3b3'
  on-tertiary: '#581b1f'
  tertiary-container: '#92484a'
  on-tertiary-container: '#ffcccc'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a5f3c9'
  primary-fixed-dim: '#8ad6ae'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005235'
  secondary-fixed: '#ffddb7'
  secondary-fixed-dim: '#ffb95c'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b3'
  on-tertiary-fixed: '#3c060c'
  on-tertiary-fixed-variant: '#753134'
  background: '#101412'
  on-background: '#e0e3de'
  surface-variant: '#323633'
typography:
  display-lg:
    fontFamily: Syne
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Syne
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Syne
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin: 24px
---

## Brand & Style

The design system is rooted in the intersection of high-tier Apple-inspired precision and the specific functional needs of African economic inclusion. The aesthetic is strictly dark mode, prioritizing visual comfort and focus for long-term usage. It avoids the typical "neon-fintech" tropes, opting instead for a "Deep Forest" palette that evokes stability, growth, and maturity.

The personality is authoritative yet invisible; the UI should step back to let the data lead. We utilize a **Minimalist-High-Contrast** style where depth is communicated through tonal shifts rather than shadows, and importance is signaled through crisp borders and intentional hits of amber. The emotional response should be one of "Institutional Trust"—reliable enough for a bank, but modern enough for a digital-first economy.

## Colors

This design system utilizes a strictly restricted color palette to maintain high information density without visual fatigue.

- **Background & Surface:** `#0D0D0D` serves as the canvas. Surface containers (`#161616` and `#1C1C1C`) create hierarchy through "stepping," where elements closer to the user are slightly lighter.
- **Brand Green:** `#1A6B4A` is used for primary actions and success states. It represents the "Forest" of the African economy—deep, rooted, and prosperous.
- **Amber Accent:** `#F4A11D` is reserved for critical attention points, active states, and warnings. It provides the necessary "pop" against the dark background.
- **Borders:** `#2A2A2A` is the structural backbone. It provides definition for cards and inputs without the clutter of drop shadows.

## Typography

The typographic strategy balances the expressive, geometric nature of **Syne** for headlines with the utilitarian clarity of **DM Sans** for data and body text.

- **Headlines:** Use Syne to provide a distinct, editorial feel. Its unique letterforms give the platform a modern, premium character.
- **Body & Data:** DM Sans is used for all transactional data and descriptions. Its low-contrast and neutral metrics ensure readability when viewing complex financial tables or Nigerian Naira (₦) denominations.
- **Scale:** Large display titles are used sparingly to introduce main sections, while most functional navigation relies on labels and body-medium weights.

## Layout & Spacing

This design system uses an **8px grid system** to ensure mathematical consistency. The layout philosophy is a **12-column fluid grid** for desktop and a **4-column grid** for mobile.

- **Margins & Gutters:** Mobile views use 24px side margins to feel spacious and high-end. Gutters are fixed at 16px to maintain density in data-heavy views.
- **Rhythm:** Vertical spacing between cards should follow the `lg` (40px) token, while internal card padding should strictly use `md` (24px) for a "breathable" feel.
- **Alignment:** All text and components must be baseline-aligned to the grid. Avoid centering elements; left-alignment is the standard for economic data to assist with scanning.

## Elevation & Depth

In line with the "Function over Flair" philosophy, this design system rejects traditional shadows. Depth is achieved through **Tonal Layering** and **Subtle Outlines**.

- **Level 0 (Base):** `#0D0D0D` - The background.
- **Level 1 (Cards/Sections):** `#161616` - Used for the primary content containers.
- **Level 2 (Modals/Overlays):** `#1C1C1C` - Used for elements that temporarily float over the UI.
- **Borders:** Every interactive element or container must have a `1px` solid border of `#2A2A2A`. This "Ghost Border" technique replaces shadows, providing a crisp, architectural structure that remains visible even on low-quality mobile screens.
- **Interaction:** On hover or active states, the border-color may shift to `#1A6B4A` or `#F5F5F5` to provide immediate feedback without changing the layout's physical footprint.

## Shapes

The shape language is inspired by the "Squircle" geometry found in Apple's hardware and software. It avoids both the harshness of sharp corners and the playfulness of fully round pills.

- **Default (0.5rem):** Used for standard buttons, input fields, and small cards.
- **Large (1rem):** Used for primary content containers and dashboard widgets.
- **Extra Large (1.5rem):** Reserved for bottom sheets or promotional banners.
- **Consistency:** All nested elements (like a button inside a card) must have a slightly smaller radius than their container to maintain optical harmony.

## Components

### Buttons
- **Primary:** Solid `#1A6B4A` with `#F5F5F5` text. No gradients.
- **Secondary:** Outline only (`#2A2A2A`) with `#F5F5F5` text.
- **Tertiary:** Text-only in `#A0A0A0`, shifting to `#F5F5F5` on hover.

### Cards
- Cards must use the `#161616` surface with a `#2A2A2A` border. 
- Padding is strictly `24px`. 
- Headlines inside cards use Syne (Headline-MD) while labels use DM Sans (Label-SM).

### Input Fields
- Background: `#0D0D0D` (recessed into the card).
- Border: `#2A2A2A`.
- Focus State: Border changes to `#F4A11D` (Amber) to signify "Action."
- Labels: Always visible above the field in `#A0A0A0`. No floating labels.

### Data Visualizations
- Focus on Nigerian Naira (₦) formatting: `₦1,240,000.00`.
- Use the Amber (`#F4A11D`) for trend lines or progress bars to ensure high contrast against the Forest Green.
- Lists and tables should use thin `#2A2A2A` separators and no zebra-striping.

### Chips & Tags
- Used for transaction statuses (e.g., "Pending," "Settled").
- Minimalist style: Subtle background of the status color at 10% opacity with a high-contrast label. No borders on chips.