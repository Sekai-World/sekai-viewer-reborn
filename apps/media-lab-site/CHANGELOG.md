# @apps/media-lab-site

## 0.1.0

### Minor Changes

- 0514d72: Add sponsorship links and homepage support calls to action.

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

- 5010c80: Route Live2D model and motion assets through a same-origin relay with canonical path validation, streaming responses, and loader-side URL rewriting. Refine the model studio controls with searchable motion and expression inputs, render the Live2D canvas at the device pixel ratio for a sharper model preview, and group the model catalog by character metadata.

  Add viewport interactions to the Live2D preview: wheel zoom, primary-button mouse pan, and two-finger pan and pinch zoom while preserving the current view across stage resizes.

- 221b607: Align media-lab-site and account-site with DESIGN.md: account-site imports the shared Prismatic Archive palettes and puts its canvas, cards, and text on the semantic surface roles, labels the primary/secondary badges for assistive technology, and keeps its route fade at the 150ms token while skipping it entirely under reduced motion; media-lab-site header buttons and popovers match the 44px / overlay-surface pattern with proper dialog semantics and pressed states, the story player overlay controls, choices, and autoplay badge are daisyUI `btn` / `badge` foundations with a 44px box and no backdrop blur, a load failure now offers Retry and loading announces a status, the story search field has an accessible name, area thumbnails use the shared `AssetImage` fallback, hover lifts respect reduced motion, and grids no longer use the `xl` rail threshold as a content breakpoint.
- 806897b: Keep the streamed `/live2d` catalog and character-resolution payloads aligned: resolved model identities are preserved for grouping, while raw catalog models remain available during loading and character-resolution fallback.

  Adopt the shared `ViewerShell` shell architecture in media-lab-site: the shell now lives in the root layout (GlobalNotificationBanner with external-link label, localized skip/open/close and sidebar labels, desktop rail, Home + Lab tools sidebar) instead of the home page. The navbar gains tools-site-style settings dropdowns: a desktop cog menu with grouped primary/secondary region selection next to the theme palette/color-mode dropdown, and a single mobile tune menu combining region selection with theme controls, all with Escape/outside-click close and focus return. The region selection state is provided by the root layout over Svelte context so the navbar controls and the home page's primary/secondary card badges stay in sync; the selected primary region is also carried in the URL so streamed Live2D character translations use the selected Master API region; the in-content RegionSwitcher is removed. Also adds app-scoped theme storage keys with a first-paint theme bootstrap, local i18n message bundles driving all user-facing strings, synchronous mdi icon registration, and the shared `@platform/ui-tokens` palettes, while keeping the existing page-switch view-transition/fallback behavior.

  Bootstraps real media-lab content routes: user-facing strings move to route-aware `@platform/i18n-source/media-lab-site` namespaces (`common`, `home`, `live2d`, `story-reader`) with the local bundle runtime preserved, the placeholder home grid is replaced by localized Live2D Studio and 3D Asset Lab track entry points, the sidebar gains a Live2D Studio link and a disabled 3D Asset Lab entry, and new route shells land for `/live2d` and `/live2d/story-reader/[region]/[storyType]/[storyId]` with route-param validation, a catalog-backed Live2D landing load, a metadata-only Story Reader load, a reserved reader stage, and a localized app-level error page. Region context stays in path params; the Story Reader still has no scenario fetching or playback runtime, while standalone model loading is described below. Content-site and tools-site are included for the additive i18n-source export changes only.

  Adds a functional interface-language switcher to the media-lab-site navbar: a desktop translate-icon dropdown alongside the settings and theme controls, and a language section in the mobile settings menu, both listing the shared supported UI locales with the current one marked via `aria-current` and a check icon. Selecting a locale normalizes it through the shared helper, persists it in the `media_lab_site_ui_locale` cookie (path-scoped, `SameSite=Lax`, one-year max-age) via a pure `buildUiLocaleCookie` helper, and re-runs the layout loads with `invalidateAll` so the SSR layout receives the selected locale; Escape/outside-click close and focus return match the existing menus. Language menu labels and language names are externalized as `@platform/i18n-source/media-lab-site` `common` keys (`aria.switchUiLanguage`, `settings.interfaceLanguage`, `language.*`).

  Adds the standalone Live2D model viewer route `/live2d/[modelId]` with path-safe model-ID validation, a server load that resolves catalog metadata after a successful associated-catalog lookup, and a localized detail layout: back navigation, kicker/title header, model-ID, catalog-model, and viewer-status metadata, and an active 16:9 model stage. The reusable `Live2dModelStudio` presentation component exposes a stage snippet insertion point and playback-controls deck; body and facial `.motion3.json` files are handled separately, and facial motions are not treated as Cubism expressions. The `/live2d` landing page links to catalog-backed model routes; all user-facing strings are externalized as `@platform/i18n-source/media-lab-site` `live2d` keys, with synchronous mdi registration for the added controls. The standalone `model-viewer.ts` module adds a strict resolved descriptor parser plus an injected, browser-runtime-neutral controller for one-model loading, bounded preloading, cancellation, stale-result protection, command forwarding, and idempotent teardown, with focused unit coverage. The route now mounts an SSR-safe browser Pixi/Cubism adapter with a dedicated non-shared ticker, separate body/facial motion handling, lifecycle cleanup, and model fit/resize. The Cubism Core artifact is now pinned and vendor-controlled at `apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from SDK 5-r.5 with SHA-256 `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`; redistribution approval and license terms must be maintained. Deployed-origin CORS proof and real-browser/WebGL smoke validation remain open; Story Reader playback is still unavailable because its scenario data, scenario-to-model mapping, and player flow are not implemented.

  Adds associated-catalog-backed Live2D model metadata to the `/live2d` landing page: the server loader fetches and validates the JP-only catalog, exposes ready/unavailable/error states, and the page lists model metadata with path-safe links to `/live2d/[modelId]`. The detail loader resolves a serializable model descriptor only after a successful catalog lookup and returns 404 only for an unknown model ID in that ready state; catalog unavailability and errors remain explicit route data. Body `motionFiles` and facial `facialFiles` remain separate metadata groups, and facial `.motion3.json` files are handled by the standalone adapter as facial motions rather than Cubism expressions. The standalone route uses the SSR-safe Pixi/Cubism adapter with explicit loading/error/unavailable states; display strings stay externalized as `@platform/i18n-source/media-lab-site` `live2d` keys, with synchronous mdi registration for the catalog states. The Cubism Core artifact is pinned and vendor-controlled at `apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from SDK 5-r.5 with SHA-256 `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`; redistribution approval and license terms must be maintained. Deployed-origin CORS and real-browser/WebGL smoke proof remain open. Story Reader playback remains unavailable pending its scenario-to-model mapping and player runtime.

  Splits StoryReader out of the Live2D track into its own information architecture: `/live2d` becomes a single Live2D Model Viewer catalog page (the StoryReader card and the fixed `/live2d/sample-model` Model Viewer card are both removed, leaving the localized catalog-backed model list as the only model selection flow), a new `/story-reader` mode-selection landing presents exactly two localized, accessible mode cards — Text-Only and Live2D Player — deep-linking to `/story-reader/jp/unit/1` and `/live2d/story-reader/jp/unit/1` respectively, and a new text-only route `/story-reader/[region]/[storyType]/[storyId]` lands with a server loader reusing `parseStoryRouteParams` for a metadata-only reading-frame stub (`readerStatus: "awaiting-text-reader"`). The Live2D Player route keeps its contract and loader but now renders through a shared `StoryReaderRouteShell` presentation component with mode-distinct kicker/title/status copy, a back link to the mode-selection landing, and a cross-mode switch link for the same validated story address. The sidebar gains a Story Reader destination (active on both `/story-reader` and the Live2D Player route) while Live2D Studio remains the Model Viewer destination. All new visible strings live in the `@platform/i18n-source/media-lab-site` `story-reader` namespace (the media-lab i18n checker maps the new routes to it), with `mdi:script-text-outline` and `mdi:swap-horizontal` registered synchronously; the Story Reader route and model controller semantics remain unchanged, while the `/live2d` and `/live2d/[modelId]` routes now consume validated associated-catalog data. The app-local adapter validates the verified JP-only catalog contract, derives safe bucket URLs, and provides bounded cache/unavailable/error resolution. Standalone model playback now uses the SSR-safe Pixi/Cubism adapter; Story Reader playback remains intentionally unavailable because its scenario fetching, scenario-to-model mapping, and player runtime are still open. Facial `.motion3.json` remains metadata rather than Cubism expressions. The Cubism Core artifact is pinned and vendor-controlled at `apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from SDK 5-r.5 with SHA-256 `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`; redistribution approval and license terms must be maintained. Deployed-origin CORS proof and real-browser/WebGL smoke proof remain open. The current associated catalog exposes no voice or sound URLs, so model voiceline playback is not part of this slice.

  Implements the functional Story Reader in media-lab-site with two user-selectable modes. The text 台本 route `/story-reader/[region]/[storyType]/[storyId]` resolves the story server-side against whole `sekai-master-db*-diff` collections (30-minute TTL cache), fetches the scenario `.asset` document, and flattens raw snippets into a script-style page: cast badges, talk rows with ordered voice candidates and playable voices, background changes, BGM cues, loop/stop sound effects, full-screen text, telops, and movie links, with every media URL resolved server-side. The Live2D Player route `/live2d/story-reader/...` ports the legacy sekai-viewer playback engine under `src/lib/story/player/` (checkpoint-batching snippet walker with First\* synthesis, LRU model queue, motion/expression application, Howler playback with lip sync) behind the existing `story-route` validation, adapted to the reborn architecture: `rootStore`/`TranslationCache` coupling is replaced by an injected `ILive2DTextResolver`, asset URLs are injected via an `ILive2DPlayerUrlContext` instead of the legacy axios/asset-domain module, and downloads run through a local rate-limited fetch pipeline (4 in-flight, 12 starts-per-second, bounded 429 retries honoring `Retry-After`) against the configured asset origin (`PUBLIC_REMOTE_ASSET_BASE_URL`, default `storage.sekai.best`) rather than the model-viewer relay. Story playback sources model data from the legacy `live2d/model_list.json` catalog (the associated catalog lacks story `CostumeType` coverage) with `BuildMotionData.json` motion metadata; a client-only `createStoryPlayerSession` mounts Pixi/Howler/Cubism after hydration into a 16:9 stage with click-to-advance, autoplay, text-animation, three volume channels, warning log, and progress reporting. A new catalog API `/story-reader/api/stories/[region]/[storyType]` and a searchable grouped picker power the mode-selection landing; `howler` is added as a dependency; all strings are externalized as `@platform/i18n-source/media-lab-site` `story-reader` keys (rewritten for the functional reader; `mdi:play-circle-outline`, `mdi:stop-circle-outline`, `mdi:volume-off`, `mdi:image-outline`, `mdi:music-note-outline`, `mdi:movie-open-outline`, `mdi:magnify`, `mdi:alert`, and `mdi:skip-next` are registered synchronously). Data-layer units (URL rules, story-id codecs, master-data client, scenario processing, row flattening, motion gathering) and both route loaders have focused unit coverage; `profile` stories remain unsupported by design and scenario/master-data outages degrade to explicit reader states instead of 500s.

  The text-only reader's media interactions now reuse shared shell surfaces: scenario background rows render through `ImagePreviewTrigger` + `ImagePreviewDialog` (click-to-zoom with download/open actions), BGM rows embed the shared `AudioPlayer` (seek, volume, MP3 download of the bucket asset), and story voice/SE playback uses a new shared `CirclePlayButton` (extracted from `AudioPlayer`'s play control, exported from `@platform/ui-shell`, and adopted by `AudioPlayer` itself). Reader banners render at their natural aspect ratio instead of a forced 16:9 crop, and the story-reader namespace gains the audio-player and image-preview labels backing these controls.

  The story voice/SE control is upgraded to the ring-style circular button: content-site's card-detail `VoicePlayButton` (SVG progress ring driven by playback position) moves into `@platform/ui-shell` as a shared component generalized with an ordered source-fallback chain, `loop` support, and a recovering unavailable state; content-site's card detail and virtual-live timeline now consume the shared component, and the text-only reader's voice and sound-effect rows use it in place of the plain circular button. The internal media-lab `StoryVoiceButton` is removed.

- 7e19c38: Keep the Live2D story player's voice-character lookup in sync with reloaded page data, so voices resolve after a language or region switch refreshes the character list before playback starts.
- 316ff04: Show localized load-failure messages on card, event, and virtual-live detail pages.

  Improve content-site banner loading geometry, homepage gacha selection, behavior-matched gacha simulator modes, complete gacha simulator pools, event bonus links preserving character and applicable attribute filters, consistent event-detail hover feedback, card gallery image previews, gacha simulator thumbnails, character detail layout, bounded homepage pagination, fail-closed invalid gacha weight handling, special-training card artwork presentation, locale-aware filter sorting, and cryptographically secure gacha randomness.

  The homepage now prefetches only the initial region and loads other regions on demand when selected.

  The Gacha list now supports a shareable ongoing-only filter while preserving sorting and pagination.

- 316ff04: Share the number-input spinner reset across all sites and improve content-site skill-level input readability.
- deb6956: Normalize browser-tab page titles across all four sites to `<content title> | <catalog title> | <site name>`, assembled by a shared `createPageTitle` helper in ui-shell; Sekai Tools, Sekai Media Lab, and Sekai Account replace their previous naming, and account-site gains a page title.
- ad71924: Align the shared `@platform/ui-shell` primitives with DESIGN.md §8: the global notification banner now composes daisyUI `alert`, `status`, and `btn` instead of a parallel custom component; the audio download toast uses daisyUI `toast` + `alert`; image preview, region switcher, theme controls, audio player, and drawer links keep a 44px interactive box; shared components drop hand-picked radii, large shadows, backdrop blur, and the raw `bg-white` / Tailwind palette swatches in favour of daisyUI defaults and semantic tokens; media placeholders and fades honour `prefers-reduced-motion` and `data-low-motion`; `BrandLockup` accepts `title`/`badge` so `ViewerShell` no longer duplicates its markup; and account-site scans `packages/ui-shell/src` for Tailwind utilities.
- Updated dependencies [7382b8f]
- Updated dependencies [0514d72]
- Updated dependencies [5dec4e6]
- Updated dependencies [aa09786]
- Updated dependencies [a70fcbe]
- Updated dependencies [5010c80]
- Updated dependencies [221b607]
- Updated dependencies [806897b]
- Updated dependencies [7382b8f]
- Updated dependencies [316ff04]
- Updated dependencies [1d2380f]
- Updated dependencies [22be097]
- Updated dependencies [806897b]
- Updated dependencies [316ff04]
- Updated dependencies [806897b]
- Updated dependencies [deb6956]
- Updated dependencies [cd58de5]
- Updated dependencies [397e77e]
- Updated dependencies [ad71924]
  - @platform/ui-shell@0.5.0
  - @platform/i18n-source@0.2.1
  - @platform/sekai-master-api-sdk@1.1.0
  - @platform/i18n-runtime@0.2.0

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
