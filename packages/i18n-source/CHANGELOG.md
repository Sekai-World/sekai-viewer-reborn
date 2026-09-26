# @platform/i18n-source

## 0.2.1

### Patch Changes

- 0514d72: Add sponsorship links and homepage support calls to action.
- 5dec4e6: Align content-site structure and accessibility with DESIGN.md: asset-card and news tag strips are real WAI-ARIA tablists with roving focus, Arrow/Home/End keys, and labelled tab panels; the current-event card no longer nests the tracker button inside the card link (stretched-link frame); music vocal rows no longer nest character links inside the selection button; detail, list, home, and event skeletons expose a loading status to assistive technology; card detail sections report load failures with a retry instead of an empty-state label; the gacha simulator shows a text error; the cards filter dialog uses daisyUI 5 fieldset/input classes and every list filter dialog is labelled; header popovers drop the false `aria-modal` and sit on the overlay surface; the remaining hardcoded strings (breadcrumb label, "N more", card alt fallback) move to the i18n dictionaries.
- aa09786: Expose region-scoped Game News through `sekai-master-api`, request the complete
  dataset with `includeAll=true` for client-side spoiler filtering, and migrate
  content-site to the generated SDK client. Add the content-site Game News
  translation source entries used by the new route and navigation.
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

- cd58de5: Align tools-site with DESIGN.md: the hero call to action and reward chips are daisyUI `btn` / `badge`; the ranking tablist is a plain `btn` tablist without stacked `tab` classes; all controls keep a 44px box; the control deck, workspace, hero, and dialogs drop structural shadows and backdrop blur; the goal dialog and dropdowns sit on the `--archive-surface-overlay` role; secondary text uses `--archive-text-muted`; ranking and graph failures identify the error and offer a retry; the details dialog uses the native daisyUI modal entrance instead of a max-height animation and margin centering; the share message wraps instead of truncating; palette swatches derive from each palette's primary colour; spacing follows the 4px rhythm and breakpoints use the Tailwind scale.
- 397e77e: Rename the tools-site sidebar heading key from `navigation.tools` ("Tools") to `navigation.sidebar` ("Navigation"), matching the sidebar title used by content-site and media-lab-site. The rename (rather than a value edit) keeps the remote dictionary from overriding the new label with the stale "Tools" string until Weblate catches up.

## 0.2.0

### Minor Changes

- 6d814ec: Add the first tools-site Prismatic Archive workflow for comparing current events
  across two regions, with localized SSR data loading and URL-restored controls.

## 0.1.5

### Patch Changes

- c072bb7: Add an on-demand card asset gallery that probes optional thumbnail, small, cutout, trimmed cutout, and gacha artwork before loading available images.

## 0.1.4

### Patch Changes

- b673737: Add the generated card related-events endpoint client.

  Expose computed related-event bonus range fields.

  Expose enriched event card and music relation response fields.

  Use enriched event relation payloads on the event detail page to avoid per-card and per-music detail requests.

  Add the bounded event detail aggregate endpoint client and use it on the event detail page to reduce first-screen request fan-out.

  Constrain event ranking reward honor badge previews by height while preserving their asset aspect ratio.

  Simplify event detail virtual live metadata by omitting type and showing start/end as one unlabeled formatted time range.

  Show enriched Bonus Character rows on event details, with attributes presented as secondary bonus metadata.

  Load and cache complete ranking rewards only when the event detail Show all rewards control is used.

  Hide ranking reward entries and ranges whose resource box details cannot be resolved.

- b673737: Add the regional gacha list page with SSR loading, infinite-scroll JSON data, localized controls, and gacha logo cards.

  Add gacha background previews and a localized, accessible card-probability detail dialog that batches metadata lookups for the displayed gacha cards.

  Keep card probability notes available from an accessible info tooltip beside the dialog trigger.

- b673737: Split content-site i18n source messages into scoped namespaces and add localized card detail, related event, related gacha, and event timing labels.

## 0.1.3

### Patch Changes

- d44571f: Add source messages for drawer labels, settings controls, accessibility labels, and secondary app scaffold copy.
- 70b917b: Add source messages for card and music list filters, spoiler settings, song tags, unit labels, and theme controls.
- d44571f: Add source messages for low-motion settings and accessibility polish.

## 0.1.2

### Patch Changes

- 3522a93: Add source messages for event list filtering and locale-loading UI.

## 0.1.1

### Patch Changes

- 6721ff0: Add app-scoped i18n source manifests and CI/GitHub Actions automation for syncing source strings into the translation repository.
