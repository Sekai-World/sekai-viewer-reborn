# @platform/ui-shell

## 0.5.0

### Minor Changes

- 806897b: Add shared theme preference normalization, resolution, and document application helpers.
- ad71924: Align the shared `@platform/ui-shell` primitives with DESIGN.md §8: the global notification banner now composes daisyUI `alert`, `status`, and `btn` instead of a parallel custom component; the audio download toast uses daisyUI `toast` + `alert`; image preview, region switcher, theme controls, audio player, and drawer links keep a 44px interactive box; shared components drop hand-picked radii, large shadows, backdrop blur, and the raw `bg-white` / Tailwind palette swatches in favour of daisyUI defaults and semantic tokens; media placeholders and fades honour `prefers-reduced-motion` and `data-low-motion`; `BrandLockup` accepts `title`/`badge` so `ViewerShell` no longer duplicates its markup; and account-site scans `packages/ui-shell/src` for Tailwind utilities.

### Patch Changes

- 7382b8f: Keep the shared audio-player progress display synchronized after seeking during playback.
- a70fcbe: Regenerate the master API SDK with Honors, Bonds Honors (including character-pair filtering), Missions, Event Honor Bonuses, MySekai photo decorations, Costume3D list/detail, and newly documented paginated list contracts. Add content-site Missions and Honors catalogues, and distinguish event honor bonus rules from ranking-reward honors on event detail pages.

  Render Live Master honors with the standard rarity-based local frame while keeping their custom level parts separate.

  Give the Honors catalogue a clear page identity and a labelled results region.

  Keep Character Missions in the Missions catalogue while expanding level goals in place with explicit target labels; remove repeated Character Rank reward references from mission rows.

  Move Character Rank rewards to Character detail pages with localized loading, empty, and failure states.

  Group the content-site sidebar into Library, Activities, and Progression sections instead of a single Explore section.

  Show each mission family in the Missions overview as soon as it loads instead of waiting for every family; a family that fails shows its own retry.

  Render Missions overview families as cards with a visible per-family loading skeleton.

  Load 24 Honors per page so the first page fills a desktop viewport before the next page loads.

  Add Character Missions to Character detail pages, load every Character Rank instead of the first 100, and summarize ranks with reward totals and milestone ranks.

  Show Story missions as a target ladder with reward totals and milestone targets, preview them by target and reward, and drop the duplicate target line from Normal missions.

  Lay out milestone and full reward ladders in the same width-driven columns, keeping milestones emphasized when every step is shown.

  Load every Normal mission at once, and pick a character before listing Character Missions; the Character detail page links to that character's missions.

  Describe Story missions as fully read episode goals, with the reading rule shown above the ladder.

  Drop the end-of-list note from Missions and Honors.

  Regenerate the sekai-master-api SDK for reward item names and gacha ticket asset bundles.

  Show reward items with their in-game icons and names in Story, Normal, and Character Rank rewards, and fix gacha ticket icons on event and virtual live pages. Open each Character mission as a card whose level goals and EXP or EX rewards appear in a dialog, on both the Missions page and Character pages. Keep the catalogue loading text for screen readers only.

  Show reward items as their game icon and quantity, naming each item in a tooltip and accessible label, with text when an icon is missing.

  Load every mission of the chosen character at once, and show ladder reward totals as icon and quantity.

  Center reward ladder rows vertically, and show Character Rank honor rewards as their small honor degree at the granted level.

  Place regular honor level stars at their measured position (x 51 + 16i) in both main and sub degrees.

  Enlarge reward item icons (48px in rows, 56px in totals) so detailed items stay legible beside small honor degrees.

  Centre trimmed honor frame textures instead of stretching them, and preview six Character missions on Character pages with an arrow on the See all link.

  List only honor ranks as Character Rank milestones and show the cumulative EXP each rank needs.

  Show "View all (N)" section-header links for Character missions and the Missions overview, matching the Character page Latest cards.

- 7382b8f: Add a mobile quick-navigation bar for direct access to primary content pages, and refine
  mobile homepage card/event layouts and catalogue toolbar behavior.
- 316ff04: Share the number-input spinner reset across all sites and improve content-site skill-level input readability.
- deb6956: Normalize browser-tab page titles across all four sites to `<content title> | <catalog title> | <site name>`, assembled by a shared `createPageTitle` helper in ui-shell; Sekai Tools, Sekai Media Lab, and Sekai Account replace their previous naming, and account-site gains a page title.

## 0.4.0

### Minor Changes

- 7e65cc0: Add an opt-in, dismissible global notification banner with accessible severity states and persistent local dismissal across all sites. Each site's root layout now loads active notifications server-side from the sekai-api `GET /notifications` endpoint (via `SEKAI_API_BASE_URL`) and falls back to rendering nothing when the feed is unavailable or misconfigured. The duplicated per-app notification parsers and request helpers have been extracted into shared, exported plain TypeScript utilities in `@platform/ui-shell` (`normalizeGlobalNotice`, `parseGlobalNoticesPayload`, `fetchGlobalNotices`, `stripTrailingSlashes`), with thin per-app adapters owning only private env/config access.

## 0.3.0

### Minor Changes

- 3ef365c: Share the Prismatic Archive palette mappings and controlled theme controls, and add tools-site palette and color-mode preferences.
  Replace the shared palette source for content-site with no intended visual change.

  Expose the private shared `AssetImage` component through its supported
  `@platform/ui-shell/asset-image` subpath for the tools-site banner.

### Patch Changes

- 3ef365c: Move canonical unit icon resolution and border colors into the shared UI shell.
- f02e5fa: Migrate shared and content-site UI patterns for daisyUI 5 compatibility.
- 742389d: Improve card detail page layout at large viewport widths by giving right-column content more consistent reading widths and grouping related cards more clearly. Delay the shared desktop navigation rail until extra-large viewports.

## 0.2.0

### Minor Changes

- 615125d: Add the opt-in Prismatic Archive foundation with additive semantic tokens, a
  persistent desktop rail option, and localized skip-to-content navigation. Update
  the content-site home to foreground the current event, group recent releases,
  and clarify its database directory and version provenance. Add deterministic
  browser visual-regression coverage for the streamed current-event banner. Simplify
  the card-list sorting controls to icon-only buttons. Add artifact-backed visual
  failure review and a manual, artifact-only baseline candidate workflow; CI never
  updates or commits snapshots automatically.
  Ensure content-site waits for its target locale dictionary during SSR and client
  navigations, retaining the previous complete locale while a user-requested
  locale change loads instead of visibly resetting to English fallback text.
  Bound remote dictionary cache lookups so timed-out requests are aborted and
  evicted for safe retry rather than permanently poisoning a locale/namespace key.
- 85c9c43: Add bounded positive jitter to shared image retry scheduling so concurrent image failures recover over staggered 300–360ms and 900–1080ms windows without changing retry policies or adding global concurrency limiting.

### Patch Changes

- 5c3cf63: Automatically retry image and preview loading twice before showing a fallback or failure state, improving recovery from temporary asset delivery errors.
- 85c9c43: Expose the shared image retry controller and explicit static/signed URL policies through `@platform/ui-shell/image-retry`.
- 07d232f: Release the ViewerShell landmark semantics correction.

## 0.1.4

### Patch Changes

- b673737: Move image preview format choices into the download menu instead of switching the preview image format.

  Align the image preview modal frame radius with rounded preview images.

- b673737: Add the regional gacha list page with SSR loading, infinite-scroll JSON data, localized controls, and gacha logo cards.

  Add gacha background previews and a localized, accessible card-probability detail dialog that batches metadata lookups for the displayed gacha cards.

  Keep card probability notes available from an accessible info tooltip beside the dialog trigger.

## 0.1.3

### Patch Changes

- d44571f: Improve viewer shell drawer accessibility with semantic controls.
- d44571f: Add shared low-motion and accessibility polish for viewer UI controls.

## 0.1.2

### Patch Changes

- 6721ff0: Update shared viewer UI shell and media controls used by app pages.

## 0.1.1

### Patch Changes

- ab99d20: Split shared image preview trigger and modal components.
