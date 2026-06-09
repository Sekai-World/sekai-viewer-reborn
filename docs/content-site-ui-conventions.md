# `content-site` UI Conventions

This document records the current UI architecture and styling rules for `apps/content-site`.
Follow these rules before introducing new page-level patterns, daisyUI overrides, or shared Svelte UI.

## Styling Stack

- `content-site` uses Tailwind CSS 4 with `daisyui`.
- Shared app-level CSS lives in `apps/content-site/src/app.css`.
- Shared Svelte UI is consumed from `packages/ui-shell/src`.

## daisyUI Override Rules

### 1. Override daisyUI component defaults with `@utility`

If you need to change a daisyUI component default globally, prefer `@utility` in `app.css`.

Current example:

```css
@utility card {
  @apply rounded-2xl;
}
```

Use this for defaults owned by daisyUI, such as:

- `card` border radius
- `btn` shape
- `badge` radius
- `tab` radius

Do not rely on business classes such as `.content-card-shell` to fight daisyUI defaults for these properties.

### 2. Use utility classes in markup for per-instance differences

If only one component or one page needs a different look, prefer utility classes in the Svelte template instead of more global CSS.

Examples:

- `rounded-[1.75rem]`
- `p-5`
- `gap-4`
- `transition-[transform,box-shadow]`

### 3. Keep custom app classes narrow

Custom classes such as `.content-card-shell`, `.content-card-inset`, and `.content-card-elevated` should only describe app-specific visual language that is not a daisyUI default:

- surface background mixing
- border color tuning
- dark theme adjustments

Avoid putting daisyUI-owned defaults in them when a utility or `@utility` is the better layer.

## Motion Rules

### 1. Avoid page-wide transition fallbacks

Do not apply broad transition defaults to all descendants such as `:root *`.
They can override or dilute local motion and make hover states feel delayed or muddy.

If theme transitions are needed, keep them narrow and page-level only.

### 2. Keep hover motion close to the component

Card hover motion should be expressed in:

- component-local utility classes, or
- small shared style constants under `apps/content-site/src/lib/styles`

Do not scatter hover timing between unrelated global selectors and page templates.

### 3. Avoid scaling raster images when sharpness matters

For event list cards, prefer slight translation and brightness changes over scaling the banner bitmap itself.
Direct image scaling can make banners feel soft or blurry due to browser resampling.

## Shared Card Architecture

Current shared card system:

- `apps/content-site/src/lib/components/EventCardFrame.svelte`
- `apps/content-site/src/lib/components/CardListCard.svelte`
- `apps/content-site/src/lib/components/CurrentEventCard.svelte`
- `apps/content-site/src/lib/components/EventListCard.svelte`
- `apps/content-site/src/lib/components/MusicListCard.svelte`
- `apps/content-site/src/lib/components/EventAssetImage.svelte`
- `apps/content-site/src/lib/styles/event-card.ts`

Rules:

- Shared card frame logic belongs in `EventCardFrame.svelte`.
- Shared non-interactive event/music media should use `EventAssetImage.svelte`.
- For long lists, card artwork should not attach image `src` before the card is visible. Use `EventAssetImage` with `loadMode="visible"` for event/music list artwork, or the existing visibility-gated pattern in `CardListCard.svelte`.
- Shared animation class constants belong under `src/lib/styles`, not next to `.svelte` component files.
- Page files should pass data into shared card components instead of inlining card structure repeatedly.

## Layout / Navigation Component Architecture

Current shared navigation/header system:

- `apps/content-site/src/lib/components/Breadcrumbs.svelte`
- `apps/content-site/src/lib/components/PageHeader.svelte`
- `apps/content-site/src/lib/components/RegionBadgeSwitch.svelte`
- `apps/content-site/src/lib/components/ListToolbarButton.svelte`

Rules:

- Breadcrumb + top-right action layouts should reuse `PageHeader`.
- Region badge groups should reuse `RegionBadgeSwitch`.
- If a route needs only a single active region badge, still use the shared switch component with one active option.
- List page icon-only sort, view, and filter controls should reuse `ListToolbarButton` so touch target sizing and sort indicators stay aligned across routes.

## Sidebar Rules

Sidebar rendering is owned by `packages/ui-shell/src/viewer-shell.svelte`.

Current sidebar item type is:

- section items
- link items
- disabled link-shaped items
- optional icon support

Rules:

- Use a section item for non-clickable group labels.
- Disabled items should still use the same structural layout as enabled items for alignment consistency.
- Sidebar links should close the drawer when clicked.
- `content-site` sidebar labels must come from the CDN dictionaries loaded through `@platform/i18n-runtime`.

Current `content-site` sidebar groups:

- Home
- Database
  - Cards
  - Songs
  - Events
  - Virtual Lives

Cards, Songs, and Events have real destinations. Virtual Lives is currently disabled.

## I18n Rules

Event-type display text is localized through `svelte-i18n`. Unit display names come from the master API unit profile list.

Current helper:

- `apps/content-site/src/lib/event.ts`
- `apps/content-site/src/lib/unit-profile.ts`
- `apps/content-site/src/lib/server/unit-profiles.ts`

Rules:

- Do not hardcode translated event type strings in page components.
- Do not hardcode unit names in page components or filter metadata. Use `/unitProfiles/{region}/list` through `fetchUnitProfiles`, and fall back with `formatUnitFallbackLabel`.
- Keep server-side unit profile caching in `apps/content-site/src/lib/server/unit-profiles.ts`; cache validation should use the version key from `/versions/{region}`.
- Keep music tag to unit-code mapping in `apps/content-site/src/lib/unit-profile.ts` because some API tag values differ from unit codes.
- Add user-facing navigation labels to the external `sekai-i18n-reborn` dictionaries.
- Add new source keys first to `packages/i18n-source/content-site/common.json` or `packages/i18n-source/content-site/server.json`; the sync workflow opens the translation-repo PR.

## Practical Modification Strategy

When changing `content-site` UI, prefer this order:

1. Check whether daisyUI already owns the property.
2. If yes and the change is global, use `@utility`.
3. If the change is local, use markup utility classes.
4. If behavior or structure repeats, extract a shared Svelte component.
5. Put non-component shared constants under `src/lib/styles` or another non-component folder.
