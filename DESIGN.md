# Sekai Viewer Reborn Design System

## 1. Atmosphere & Identity

Sekai Viewer Reborn feels like a clean, content-first catalog shell: calm, practical, and lightly elevated rather than flashy. The signature is tonal depth — cards, insets, and badges separate mostly through subtle surface mixing, soft borders, and restrained accent gradients instead of heavy shadows or decorative motion.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Primary accent | --color-primary | oklch(58% 0.233 277.117) | oklch(58% 0.233 277.117) | Interactive emphasis, active badges |
| Primary text | --color-primary-content | oklch(96% 0.018 272.314) | oklch(96% 0.018 272.314) | Text on primary surfaces |
| Base surface | --color-base-100 | oklch(100% 0 0) | oklch(24.5% 0.018 252.42) | Main page background and cards |
| Secondary surface | --color-base-200 | oklch(98% 0 0) | oklch(18.4% 0.015 253.1) | Inset panels, thumbnail shells |
| Tertiary surface | --color-base-300 | oklch(95% 0 0) | oklch(14.8% 0.012 254.09) | Borders, deeper surface steps |
| Base text | --color-base-content | oklch(21% 0.006 285.885) | oklch(97.807% 0.029 256.847) | Primary copy and labels |

### Rules

- Surfaces use soft tonal separation first; borders are used sparingly for structure.
- Accent color is reserved for interactive states and active chips.
- Do not introduce raw colors outside the existing app palette unless the palette is expanded here first.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| H2 | 18px / 1.125rem | 600 | 1.35 | 0 | Card titles |
| Body | 16px / 1rem | 400 | 1.5 | 0 | Default body copy |
| Body/sm | 14px / 0.875rem | 400 | 1.5 | 0 | Secondary info |
| Caption | 12px / 0.75rem | 500 | 1.4 | 0.02em | Labels, badges, metadata |
| Overline | 11px / 0.6875rem | 600 | 1.3 | 0.08em | Uppercase section labels |

### Font Stack

- Primary: system sans stack provided by the app/tailwind defaults
- Mono: system monospace stack when needed for numeric labels or diagnostics

### Rules

- Keep labels compact; avoid oversized text in dense catalog cards.
- Headings should stay clamped rather than growing the card vertically.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px rhythm.

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Tight icon/label spacing |
| --space-2 | 8px | Compact inline groups |
| --space-3 | 12px | Small field padding |
| --space-4 | 16px | Default card padding |
| --space-5 | 20px | Comfortable inner spacing |
| --space-6 | 24px | Standard section spacing |
| --space-8 | 32px | Larger breaks between card groups |

### Grid

- Breakpoints follow the app’s Tailwind defaults: sm 640px, md 768px, lg 1024px, xl 1280px.
- Content width stays fluid and list-oriented; cards should expand with available space rather than forcing fixed widths.

### Rules

- No magic spacing in shared components; use the existing 4px rhythm.
- Dense catalog cards should favor compact grids and stable aspect ratios.

## 5. Components

### Content Card Shell
- **Structure**: `card` + `content-card-shell` + optional `content-card-inset`
- **Variants**: shell, inset, elevated
- **Spacing**: 16–24px internal padding depending on density
- **States**: default, hover, active, loading, empty
- **Accessibility**: standard semantic card/article structure
- **Motion**: subtle hover lift via transform/opacity only

### CardThumbnail
- **Structure**: square thumbnail shell with optional frame and rarity/attribute overlays
- **Variants**: framed/unframed, icon overlays on/off, immediate/visible loading
- **Spacing**: square aspect ratio with rounded corners and internal overlays aligned to the edges
- **States**: loading spinner, loaded image, fallback/error, missing asset
- **Accessibility**: meaningful `alt` text on the image; overlays are decorative only
- **Motion**: image fade-in and optional transform easing only

### AssetImage
- **Structure**: non-interactive media loader with loading and error handling
- **Variants**: immediate vs visible loading, interactive preview trigger
- **Spacing**: driven by the parent container
- **States**: loading, loaded, error, previewable
- **Accessibility**: alt text and clear fallback label support
- **Motion**: opacity/scale transition on load

### CharacterAvatar
- **Structure**: round character thumbnail shell with a border and optional fallback initial
- **Variants**: xs, sm, default, lg
- **Color**: border color uses explicit `accentColor` first, static `gameCharacterUnits.colorCode` derived from `characterId` for IDs 1-26 second, then the primary accent token fallback
- **Accessibility**: labeled by default; use `decorative` when the surrounding control or row already provides the accessible name
- **Motion**: no component-owned motion

### UnitIconBadge
- **Structure**: round unit icon shell with text pill fallback when no icon exists
- **Variants**: sm, default, lg
- **Color**: border color derives from confirmed JP `unitProfiles.colorCode` values for core unit slugs; support-unit `none` maps to piapro when `mapNoneToPiapro` is enabled
- **Motion**: no component-owned motion

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 100-150ms | ease-out | Small hover or press feedback |
| Standard | 180-300ms | ease-in-out | Card reveal, image load state |

### Rules

- Only animate transform and opacity in shared UI.
- Use IntersectionObserver for lazy-reveal behavior.
- Respect reduced-motion preferences where motion is non-essential.

## 7. Depth & Surface

### Strategy

Mixed: tonal-shift for most surfaces with light borders for structure and occasional subtle shadows for hover/elevation.

### Rules

- `content-card-shell` and `content-card-inset` define the shared surface language.
- Thumbnails stay square, rounded, and surface-backed rather than floating without context.
