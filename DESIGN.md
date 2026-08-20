# Sekai Viewer Reborn Design System

This is the cross-site design contract for `sekai-viewer-reborn`. It describes the
shared visual language and implementation boundaries for the deployable SvelteKit
sites and the packages they consume. It is intentionally a principle-level guide;
`docs/content-site-ui-conventions.md` remains the detailed reference for mature
`content-site` patterns.

## 1. Product roles and design goals

Sekai Viewer Reborn is a calm, content-first archive: useful before it is
decorative, information-rich without feeling like an admin dashboard, and lightly
elevated rather than glossy. The established **Prismatic Archive** language uses
tonal depth, thin borders, compact metadata, and restrained motion to make large
amounts of game data easy to scan.

The sites have distinct jobs:

- **`@apps/content-site`** is the public content catalogue and detail experience.
  It helps people browse cards, characters, songs, events, gachas, and virtual
  lives, then inspect their artwork and data. Page identity, region context,
  localized labels, stable media, and readable evidence sections come first.
- **`@apps/tools-site`** is a tool and comparison workbench. It prioritizes
  explicit controls, compact form layouts, comparable result groups, and clear
  loading or failure feedback. Its current `archive-canvas`, `archive-panel`,
  `archive-control`, and `archive-result` classes are the site-specific starting
  point for this role.
- **`@platform/ui-shell`** supplies the cross-site frame and reusable primitives.
  `ViewerShell` owns the skip link, sticky navigation, drawer/rail navigation,
  main content track, and responsive shell geometry. Other exports include the
  region switcher, audio player, image preview/retry pieces, and unit icon badge.

The shared system should make the sites feel related, not identical. A catalogue
card may have domain-specific metadata while the shell, surface hierarchy,
keyboard behavior, and feedback language remain recognizably Archive.

## 2. Visual language and surface hierarchy

Use four semantic levels in order. Names describe roles, not literal colors:

1. **Canvas** — `color.surface.canvas`, the page background and the quietest
   reading field.
2. **Panel** — `color.surface.default`, a primary section, control deck, card
   shell, or normal content surface sitting above the canvas.
3. **Inset / result** — `color.surface.sunken`, a contained field used for
   grouped evidence, result output, thumbnails, or a catalogue results area.
4. **Raised / overlay** — `color.surface.raised` for a locally elevated card and
   `color.surface.overlay` for a popover, dialog, drawer, or other surface that
   must read above its surrounding panel.

Choose separation by tone first, then by a subtle border. Shadows are occasional
interaction or elevation cues, never the main structure. In dark mode the canvas
must remain visibly darker than the panel; inset should be below the panel, and
raised/overlay should be above it. Keep the primary ambient glow quieter in dark
mode.

### Token usage

Use semantic roles supplied by the app or shared token package instead of placing
raw colors in components. `packages/ui-tokens/src/design-tokens.json` defines the
portable vocabulary: `color.surface.canvas`, `sunken`, `default`, `raised`, and
`overlay`; `color.text`; `color.border`; `color.accent`; `color.status`; and
`color.focus`. It also defines spacing, radius, icon, and motion values. The
values in that JSON are the source of truth for portable tokens; do not invent a
new numeric value in this document or imply that every app currently emits those
tokens as CSS variables.

`content-site` additionally implements the Prismatic Archive roles in
`apps/content-site/src/app.css`, including `--archive-surface-*`,
`--archive-text-*`, `--archive-border-*`, and `--archive-focus-*`, with
`default`, `sakura`, and `mint` palettes plus light/dark variants. Use those
semantic roles and the existing `content-card-shell`, `content-card-inset`, and
`content-card-elevated` classes for content-site surfaces. `tools-site` currently
maps its smaller vocabulary (`--archive-canvas`, `--archive-panel`,
`--archive-control`, and `--archive-result`) to daisyUI base tokens. Extending
that mapping toward the shared ladder is a **cross-site target / gradual adoption**,
not a claim that all sites are already token-aligned.

Themes are user-facing product state, not page decoration. Preserve the active
theme and color scheme, use accent tokens for interactive emphasis and active
states, and use status tokens for success, warning, danger, and information. Do
not use color alone to communicate state.

## 3. Typography, spacing, and responsive layout

The current content-site body stack is Noto Sans with Japanese, Traditional
Chinese, and Korean fallbacks, then the system sans stack. Keep body copy around
16px with a readable line height; use smaller text for secondary metadata and
badges, not for essential instructions. Headings should be compact and may be
clamped in dense cards so one long title does not destabilize a grid. Use a
system monospace stack only for code-like or diagnostic values. Do not introduce
a new display font without a product-wide decision.

All spacing follows a **4px rhythm**. The portable tokens include 4, 8, 12, 16,
20, 24, 32, 40, and 48px steps. Use `gap-4` (16px) as the stable shared unit for
content detail rails and nested groups where the content-site conventions call
for it. Prefer existing Tailwind spacing utilities and token values over one-off
pixel literals.

Build mobile first:

- Let content and tool controls stack naturally on narrow screens; do not rely
  on hover or a fixed desktop width.
- Use the existing Tailwind breakpoints consistently: `sm` 640px, `md` 768px,
  `lg` 1024px, and `xl` 1280px.
- `ViewerShell` keeps navigation as an overlay drawer below `xl`; with
  `desktopRailOpen`, it becomes a fixed left rail at `xl` and above. Do not use
  that rail threshold as a general typography or content breakpoint.
- Keep the main content fluid and on a shared track. The shell currently uses a
  `max-w-384` track with responsive horizontal padding; page-level borders should
  align to the header and toolbar track rather than extending past it.
- Controls and icon-only actions must remain touch-safe. Use at least 44px for
  the interactive box, as the current tools controls and shell buttons do, and
  leave enough separation that adjacent controls are not accidentally activated.

## 4. Component ownership and composition

Use the smallest layer that owns a responsibility:

### Shared layer: `@platform/ui-shell`

Put behavior and structure here when it is useful to more than one site and does
not depend on content-site domain data. `ViewerShell` is the canonical shell;
keep its skip link, accessible drawer controls, active navigation, and
drawer-closes-on-link behavior intact. Shared primitives currently include
`region-switcher.svelte`, `unit-icon-badge.svelte`, `audio-player.svelte`,
`image-preview-trigger.svelte`, `image-preview-dialog.svelte`, and the
`image-retry/` controller and policies.

`unit-icon-badge.svelte` is the canonical shared `UnitIconBadge` implementation;
its generic unit icon, fallback-label, and border-color interfaces are owned by
`@platform/ui-shell` and may be consumed by any site. Content-site does not
maintain a second `UnitIconBadge` component. Its content-site-specific unit
profile loading and unit-code mapping remain in the content domain layer and
are passed into the shared primitive through its resolver props.

When adding Tailwind utilities to this package, consuming apps must scan
`packages/ui-shell/src` (both current app CSS files do). Prefer Iconify icons;
content-site `mdi:*` icons must also be registered synchronously in
`apps/content-site/src/lib/icons/mdi.ts`.

### Content domain layer: `content-site`

Keep catalogue and detail semantics in `apps/content-site/src/lib/components`
and route-level layouts. The existing card frame, `AssetImage`,
`CardListCard`, `CurrentEventCard`, `EventListCard`, `MusicListCard`,
`PageHeader`, `RegionBadgeSwitch`, `CharacterAvatar`, and `UnitIconBadge`
patterns are domain-aware compositions, not automatically shared components;
in particular, the `UnitIconBadge` entry here refers to content-site's
domain-specific resolver data passed to the canonical shared primitive, not to a
second component implementation.
Reuse the documented content-site card and navigation conventions rather than
duplicating their structure.

### Tool page layer: `tools-site`

Keep tool-specific comparison layouts and result presentation at the page level.
The current `archive-control` form grid and `archive-results` two-column layout
are tools-site conventions. Their shared surface intent should follow this
document, while their fields and result semantics remain specific to each tool.

Extract a component to `@platform/ui-shell` only when its markup, interaction,
accessibility contract, and visual responsibility are genuinely cross-site. Keep
components in an app when they encode a route, API shape, content domain, or
site-specific information hierarchy. A visual similarity alone is not enough.

## 5. Interaction patterns and states

### Navigation

Use `ViewerShell` for site navigation. Provide localized `navTitle`, sidebar
labels, skip-link text, and open/close labels. Use section items for non-clickable
groups, link items for destinations, and disabled link-shaped items when a
destination is unavailable; preserve the same structural alignment. Use
`aria-current="page"` for the active destination. Content-site navigation and
breadcrumbs should use the same external i18n keys; new user-facing strings go
through the appropriate i18n source namespace rather than being hardcoded in a
component.

### Forms and controls

Every field has a visible label or an equivalent accessible name. Keep labels
near their controls, place helper text near the relevant field, and place an
error next to the field or result it describes. Preserve entered values when a
request fails. Use the semantic primary/status roles for action, success,
warning, danger, and information; never make a disabled control look like a
different layout component.

### Badges, cards, and results

Badges are compact metadata or state indicators, not the only explanation of a
state. Use the shared shell and domain card primitives for catalogue content;
make the clickable frame fill its grid cell and reserve the media aspect ratio.
For tools, group controls in a panel and place outputs in a distinct result or
inset field. Keep result groups scannable, preserve long values with sensible
wrapping, and expose a clear relationship between input, status, and output.

### Loading, empty, and error

Loading placeholders reserve the loaded geometry so streamed data does not cause
layout shift. They are visual-only when appropriate (`aria-hidden="true"`), and
the surrounding region still needs an understandable status for assistive
technology. Empty states explain what is empty and what the user can do next.
Errors should identify the failed operation, remain near the affected content,
and offer retry or a safe next step when possible. Independent data boundaries
may load independently; one unavailable asset or panel should not erase usable
content around it.

### Focus and accessibility

Keep visible `:focus-visible` rings. Use the app focus role and an offset that
contrasts with the surface beneath it. Preserve keyboard access for links,
buttons, dialogs, region switches, spoiler/reveal interactions, and media
previews. Images need meaningful `alt` text; decorative overlays and avatars
inside an already labeled control should be marked decorative. Do not rely on
hover, color, motion, or an icon alone to convey meaning.

## 6. Motion

Motion is feedback and spatial continuity, not decoration. Use the tokenized
150–300ms range (the shared token file currently defines 150ms, 180ms, and 280ms
durations) with the existing standard or emphasized easing where available.

- Prefer `transform` and `opacity`; animate borders or shadows only for a small,
  local interaction when it materially improves feedback.
- Keep transitions local to the component. Never add a broad `:root *`
  transition that dilutes unrelated controls.
- Content-site card hover is for fine pointers and is disabled or reduced through
  its low-motion setting. Do not make essential information depend on hover.
- Use view transitions only when the browser supports them and motion is allowed.
  `tools-site` already guards native view transitions with feature detection and
  `prefers-reduced-motion`; its 150ms fallback is also disabled for reduced
  motion.
- Respect both the site low-motion setting (`data-low-motion` where implemented)
  and `prefers-reduced-motion: reduce`. Remove non-essential animation,
  transition, blur, and hover lift in that mode. A static or simple pulse is
  preferable to a per-item shimmer loop.

## 7. Media and data density

Reserve image dimensions with a stable aspect-ratio frame before loading. For
long catalogue lists, use visibility-gated/lazy loading: content-site uses
`AssetImage` with `loadMode="visible"` or the established gate in
`CardListCard`. Keep retry and fallback behavior in the shared image controller
or existing media primitives rather than reimplementing it in a page.

Do not enlarge intrinsically small raster artwork into a hero or scale a banner
bitmap on hover merely to create movement; translation and a modest brightness
change preserve sharpness. Keep spoiler/reveal semantics and the route/server
state authoritative. For data-dense screens, preserve columns, labels, and
result geometry while values load or fail, and use wrapping rather than causing
horizontal page overflow.

## 8. Cross-site implementation rules

- The stack is SvelteKit 2, Svelte 5, Tailwind CSS 4, and daisyUI. Use Tailwind
  v4 utilities and the existing local daisyUI proxy pattern in each app CSS.
- Start with the existing components and templates in the official daisyUI
  documentation whenever they can meet the need. Prefer their semantic
  structure, interaction, and accessibility behavior; create a custom component
  only when an available component or template cannot meet the product's
  semantic, interaction, or visual contract.
- If a daisyUI default needs a global change, use `@utility` in that app's
  `src/app.css` (for example the content-site `card` radius override). If the
  difference is local, use markup utilities. Keep custom classes for app-specific
  surface language, not to fight daisyUI defaults.
- Keep app CSS narrow. Avoid broad global transitions, expensive blur/filter
  effects, large shadows, and global animations.
- Add new visible copy to the matching i18n source namespace. In content-site,
  use the external `sekai-i18n-reborn` dictionaries and the existing runtime
  helpers; use `common` only for labels shared across scopes. Tools-site should
  follow the same direction as its localization expands. This is a **cross-site
  target / gradual adoption** where a site is not yet fully aligned.
- Keep shared behavior in `packages/` only when multiple apps need it; keep app
  boundaries explicit and do not hand-edit generated output.
- When a page introduces a new surface or breakpoint, verify light/dark themes,
  narrow and wide layouts, keyboard focus, reduced motion, loading, empty, and
  error states before calling the pattern complete.

## 9. References and adoption status

Use these files to verify an implementation rather than copying this document's
principles into a second local convention:

- `docs/content-site-ui-conventions.md` — detailed content-site catalogue,
  card, navigation, image, i18n, and testing conventions.
- `apps/content-site/src/app.css` — implemented Prismatic Archive semantic
  surfaces, palettes, card classes, focus roles, low-motion behavior, and the
  daisyUI override.
- `apps/tools-site/src/app.css` — current tools canvas/panel/control/result
  layout, 44px controls, responsive result grid, and guarded page transition.
- `apps/content-site/src/routes/+layout.svelte` and
  `apps/tools-site/src/routes/+layout.svelte` — current shell composition,
  localization, theme/settings behavior, and motion guards.
- `packages/ui-shell/src/` — shared shell and UI primitives.
- `packages/ui-tokens/src/design-tokens.json` — portable token vocabulary and
  values.

Content-site's Prismatic Archive card, media, navigation, and detail rules are
the most mature implementation. Apply them to tools-site and other sites as a
shared direction, but label differences as gradual adoption rather than
claiming that every site already implements every content-site convention.
