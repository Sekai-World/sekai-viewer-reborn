# @apps/account-site

## 0.1.0

### Minor Changes

- 0514d72: Add sponsorship links and homepage support calls to action.

### Patch Changes

- 293beba: Restore the account-site `ViewerShell` navigation title, drawer id, sidebar items, and version badge, which had been rendered as page text since the page-title normalization. Drop `--tsgo` from the app `check` scripts so `svelte-check` type-checks shared `@platform/ui-shell` components again; the tsgo mode skips Svelte files outside each app's tsconfig root, which is how this regression passed CI.
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

- 5010c80: Route Live2D model and motion assets through a same-origin relay with canonical path validation, streaming responses, and loader-side URL rewriting. Refine the model studio controls with searchable motion and expression inputs, render the Live2D canvas at the device pixel ratio for a sharper model preview, and group the model catalog by character metadata.

  Add viewport interactions to the Live2D preview: wheel zoom, primary-button mouse pan, and two-finger pan and pinch zoom while preserving the current view across stage resizes.

- 221b607: Align media-lab-site and account-site with DESIGN.md: account-site imports the shared Prismatic Archive palettes and puts its canvas, cards, and text on the semantic surface roles, labels the primary/secondary badges for assistive technology, and keeps its route fade at the 150ms token while skipping it entirely under reduced motion; media-lab-site header buttons and popovers match the 44px / overlay-surface pattern with proper dialog semantics and pressed states, the story player overlay controls, choices, and autoplay badge are daisyUI `btn` / `badge` foundations with a 44px box and no backdrop blur, a load failure now offers Retry and loading announces a status, the story search field has an accessible name, area thumbnails use the shared `AssetImage` fallback, hover lifts respect reduced motion, and grids no longer use the `xl` rail threshold as a content breakpoint.
- 316ff04: Show localized load-failure messages on card, event, and virtual-live detail pages.

  Improve content-site banner loading geometry, homepage gacha selection, behavior-matched gacha simulator modes, complete gacha simulator pools, event bonus links preserving character and applicable attribute filters, consistent event-detail hover feedback, card gallery image previews, gacha simulator thumbnails, character detail layout, bounded homepage pagination, fail-closed invalid gacha weight handling, special-training card artwork presentation, locale-aware filter sorting, and cryptographically secure gacha randomness.

  The homepage now prefetches only the initial region and loads other regions on demand when selected.

  The Gacha list now supports a shareable ongoing-only filter while preserving sorting and pagination.

- 316ff04: Share the number-input spinner reset across all sites and improve content-site skill-level input readability.
- 806897b: Rebuild app images when shared shell and locale runtime helpers are released.
- deb6956: Normalize browser-tab page titles across all four sites to `<content title> | <catalog title> | <site name>`, assembled by a shared `createPageTitle` helper in ui-shell; Sekai Tools, Sekai Media Lab, and Sekai Account replace their previous naming, and account-site gains a page title.
- ad71924: Align the shared `@platform/ui-shell` primitives with DESIGN.md §8: the global notification banner now composes daisyUI `alert`, `status`, and `btn` instead of a parallel custom component; the audio download toast uses daisyUI `toast` + `alert`; image preview, region switcher, theme controls, audio player, and drawer links keep a 44px interactive box; shared components drop hand-picked radii, large shadows, backdrop blur, and the raw `bg-white` / Tailwind palette swatches in favour of daisyUI defaults and semantic tokens; media placeholders and fades honour `prefers-reduced-motion` and `data-low-motion`; `BrandLockup` accepts `title`/`badge` so `ViewerShell` no longer duplicates its markup; and account-site scans `packages/ui-shell/src` for Tailwind utilities.
- Updated dependencies [7382b8f]
- Updated dependencies [aa09786]
- Updated dependencies [a70fcbe]
- Updated dependencies [5010c80]
- Updated dependencies [7382b8f]
- Updated dependencies [316ff04]
- Updated dependencies [1d2380f]
- Updated dependencies [22be097]
- Updated dependencies [316ff04]
- Updated dependencies [806897b]
- Updated dependencies [deb6956]
- Updated dependencies [ad71924]
  - @platform/ui-shell@0.5.0
  - @platform/sekai-master-api-sdk@1.1.0

## 0.0.2

### Patch Changes

- 7e65cc0: Add an opt-in, dismissible global notification banner with accessible severity states and persistent local dismissal across all sites. Each site's root layout now loads active notifications server-side from the sekai-api `GET /notifications` endpoint (via `SEKAI_API_BASE_URL`) and falls back to rendering nothing when the feed is unavailable or misconfigured. The duplicated per-app notification parsers and request helpers have been extracted into shared, exported plain TypeScript utilities in `@platform/ui-shell` (`normalizeGlobalNotice`, `parseGlobalNoticesPayload`, `fetchGlobalNotices`, `stripTrailingSlashes`), with thin per-app adapters owning only private env/config access.
- fc032b5: Restrict Vite dev server listening to localhost instead of all interfaces.
- 05ab7b4: Expose and consume the canonical master-api music `categories` field (a `string[]`) sourced from independent music category records. Malformed or missing categories are normalized to an empty array, and the shared `parseMusicCategories` helper keeps list and detail parsing consistent.
- Updated dependencies [7e65cc0]
- Updated dependencies [05ab7b4]
  - @platform/ui-shell@0.4.0
  - @platform/sekai-master-api-sdk@1.0.2

## 0.0.1

### Patch Changes

- 97be962: Reset app versions to restart the 0.0.x line from 0.0.1.
- Updated dependencies [3ef365c]
- Updated dependencies [4dc89ad]
- Updated dependencies [f02e5fa]
- Updated dependencies [742389d]
- Updated dependencies [3ef365c]
  - @platform/ui-shell@0.3.0
  - @platform/sekai-master-api-sdk@1.0.1
  - @platform/ui-tokens@0.3.0

## 0.1.7

### Patch Changes

- Updated dependencies [5c3cf63]
- Updated dependencies [85c9c43]
- Updated dependencies [615125d]
- Updated dependencies [07d232f]
- Updated dependencies [1e66948]
- Updated dependencies [85c9c43]
  - @platform/ui-shell@0.2.0
  - @platform/ui-tokens@0.2.0
  - @platform/sekai-master-api-sdk@1.0.0

## 0.1.6

### Patch Changes

- Updated dependencies [0657278]
- Updated dependencies [5739f07]
  - @platform/sekai-master-api-sdk@0.3.0

## 0.1.5

### Patch Changes

- Updated dependencies [b673737]
- Updated dependencies [b673737]
- Updated dependencies [b673737]
- Updated dependencies [b673737]
- Updated dependencies [6817b6c]
  - @platform/sekai-master-api-sdk@0.2.0
  - @platform/ui-shell@0.1.4

## 0.1.4

### Patch Changes

- d44571f: Clarify scaffold copy in the secondary app shell.
- Updated dependencies [d44571f]
- Updated dependencies [70b917b]
- Updated dependencies [d44571f]
  - @platform/ui-shell@0.1.3
  - @platform/sekai-master-api-sdk@0.1.4

## 0.1.3

### Patch Changes

- 409b987: Add smooth page transition effects with View Transition API support and reduced-motion-safe fallback animations across tools-site, media-lab-site, and account-site.
- Updated dependencies [3522a93]
  - @platform/sekai-master-api-sdk@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [6721ff0]
  - @platform/sekai-master-api-sdk@0.1.2
  - @platform/ui-shell@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [ab99d20]
- Updated dependencies [2be6c80]
  - @platform/ui-shell@0.1.1
  - @platform/sekai-master-api-sdk@0.1.1
