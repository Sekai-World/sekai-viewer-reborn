# @apps/media-lab-site

## 0.0.3

### Patch Changes

- 7382b8f: Keep the shared audio-player progress display synchronized after seeking during playback.
- 5010c80: Route Live2D model and motion assets through a same-origin relay with canonical path validation, streaming responses, and loader-side URL rewriting. Refine the model studio controls with searchable motion and expression inputs, render the Live2D canvas at the device pixel ratio for a sharper model preview, and group the model catalog by character metadata.

  Add viewport interactions to the Live2D preview: wheel zoom, primary-button mouse pan, and two-finger pan and pinch zoom while preserving the current view across stage resizes.

- 806897b: Keep the streamed `/live2d` catalog and character-resolution payloads aligned: resolved model identities are preserved for grouping, while raw catalog models remain available during loading and character-resolution fallback.

  Adopt the shared `ViewerShell` shell architecture in media-lab-site: the shell now lives in the root layout (GlobalNotificationBanner with external-link label, localized skip/open/close and sidebar labels, desktop rail, Home + Lab tools sidebar) instead of the home page. The navbar gains tools-site-style settings dropdowns: a desktop cog menu with grouped primary/secondary region selection next to the theme palette/color-mode dropdown, and a single mobile tune menu combining region selection with theme controls, all with Escape/outside-click close and focus return. The region selection state is provided by the root layout over Svelte context so the navbar controls and the home page's primary/secondary card badges stay in sync; the selected primary region is also carried in the URL so streamed Live2D character translations use the selected Master API region; the in-content RegionSwitcher is removed. Also adds app-scoped theme storage keys with a first-paint theme bootstrap, local i18n message bundles driving all user-facing strings, synchronous mdi icon registration, and the shared `@platform/ui-tokens` palettes, while keeping the existing page-switch view-transition/fallback behavior.

  Bootstraps real media-lab content routes: user-facing strings move to route-aware `@platform/i18n-source/media-lab-site` namespaces (`common`, `home`, `live2d`, `story-reader`) with the local bundle runtime preserved, the placeholder home grid is replaced by localized Live2D Studio and 3D Asset Lab track entry points, the sidebar gains a Live2D Studio link and a disabled 3D Asset Lab entry, and new route shells land for `/live2d` and `/live2d/story-reader/[region]/[storyType]/[storyId]` with route-param validation, a catalog-backed Live2D landing load, a metadata-only Story Reader load, a reserved reader stage, and a localized app-level error page. Region context stays in path params; the Story Reader still has no scenario fetching or playback runtime, while standalone model loading is described below. Content-site and tools-site are included for the additive i18n-source export changes only.

  Adds a functional interface-language switcher to the media-lab-site navbar: a desktop translate-icon dropdown alongside the settings and theme controls, and a language section in the mobile settings menu, both listing the shared supported UI locales with the current one marked via `aria-current` and a check icon. Selecting a locale normalizes it through the shared helper, persists it in the `media_lab_site_ui_locale` cookie (path-scoped, `SameSite=Lax`, one-year max-age) via a pure `buildUiLocaleCookie` helper, and re-runs the layout loads with `invalidateAll` so the SSR layout receives the selected locale; Escape/outside-click close and focus return match the existing menus. Language menu labels and language names are externalized as `@platform/i18n-source/media-lab-site` `common` keys (`aria.switchUiLanguage`, `settings.interfaceLanguage`, `language.*`).

  Adds the standalone Live2D model viewer route `/live2d/[modelId]` with path-safe model-ID validation, a server load that resolves catalog metadata after a successful associated-catalog lookup, and a localized detail layout: back navigation, kicker/title header, model-ID, catalog-model, and viewer-status metadata, and an active 16:9 model stage. The reusable `Live2dModelStudio` presentation component exposes a stage snippet insertion point and playback-controls deck; body and facial `.motion3.json` files are handled separately, and facial motions are not treated as Cubism expressions. The `/live2d` landing page links to catalog-backed model routes; all user-facing strings are externalized as `@platform/i18n-source/media-lab-site` `live2d` keys, with synchronous mdi registration for the added controls. The standalone `model-viewer.ts` module adds a strict resolved descriptor parser plus an injected, browser-runtime-neutral controller for one-model loading, bounded preloading, cancellation, stale-result protection, command forwarding, and idempotent teardown, with focused unit coverage. The route now mounts an SSR-safe browser Pixi/Cubism adapter with a dedicated non-shared ticker, separate body/facial motion handling, lifecycle cleanup, and model fit/resize. The Cubism Core artifact is now pinned and vendor-controlled at `apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from SDK 5-r.5 with SHA-256 `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`; redistribution approval and license terms must be maintained. Deployed-origin CORS proof and real-browser/WebGL smoke validation remain open; Story Reader playback is still unavailable because its scenario data, scenario-to-model mapping, and player flow are not implemented.

  Adds associated-catalog-backed Live2D model metadata to the `/live2d` landing page: the server loader fetches and validates the JP-only catalog, exposes ready/unavailable/error states, and the page lists model metadata with path-safe links to `/live2d/[modelId]`. The detail loader resolves a serializable model descriptor only after a successful catalog lookup and returns 404 only for an unknown model ID in that ready state; catalog unavailability and errors remain explicit route data. Body `motionFiles` and facial `facialFiles` remain separate metadata groups, and facial `.motion3.json` files are handled by the standalone adapter as facial motions rather than Cubism expressions. The standalone route uses the SSR-safe Pixi/Cubism adapter with explicit loading/error/unavailable states; display strings stay externalized as `@platform/i18n-source/media-lab-site` `live2d` keys, with synchronous mdi registration for the catalog states. The Cubism Core artifact is pinned and vendor-controlled at `apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from SDK 5-r.5 with SHA-256 `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`; redistribution approval and license terms must be maintained. Deployed-origin CORS and real-browser/WebGL smoke proof remain open. Story Reader playback remains unavailable pending its scenario-to-model mapping and player runtime.

  Splits StoryReader out of the Live2D track into its own information architecture: `/live2d` becomes a single Live2D Model Viewer catalog page (the StoryReader card and the fixed `/live2d/sample-model` Model Viewer card are both removed, leaving the localized catalog-backed model list as the only model selection flow), a new `/story-reader` mode-selection landing presents exactly two localized, accessible mode cards — Text-Only and Live2D Player — deep-linking to `/story-reader/jp/unit/1` and `/live2d/story-reader/jp/unit/1` respectively, and a new text-only route `/story-reader/[region]/[storyType]/[storyId]` lands with a server loader reusing `parseStoryRouteParams` for a metadata-only reading-frame stub (`readerStatus: "awaiting-text-reader"`). The Live2D Player route keeps its contract and loader but now renders through a shared `StoryReaderRouteShell` presentation component with mode-distinct kicker/title/status copy, a back link to the mode-selection landing, and a cross-mode switch link for the same validated story address. The sidebar gains a Story Reader destination (active on both `/story-reader` and the Live2D Player route) while Live2D Studio remains the Model Viewer destination. All new visible strings live in the `@platform/i18n-source/media-lab-site` `story-reader` namespace (the media-lab i18n checker maps the new routes to it), with `mdi:script-text-outline` and `mdi:swap-horizontal` registered synchronously; the Story Reader route and model controller semantics remain unchanged, while the `/live2d` and `/live2d/[modelId]` routes now consume validated associated-catalog data. The app-local adapter validates the verified JP-only catalog contract, derives safe bucket URLs, and provides bounded cache/unavailable/error resolution. Standalone model playback now uses the SSR-safe Pixi/Cubism adapter; Story Reader playback remains intentionally unavailable because its scenario fetching, scenario-to-model mapping, and player runtime are still open. Facial `.motion3.json` remains metadata rather than Cubism expressions. The Cubism Core artifact is pinned and vendor-controlled at `apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from SDK 5-r.5 with SHA-256 `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`; redistribution approval and license terms must be maintained. Deployed-origin CORS proof and real-browser/WebGL smoke proof remain open. The current associated catalog exposes no voice or sound URLs, so model voiceline playback is not part of this slice.

- 316ff04: Share the number-input spinner reset across all sites and improve content-site skill-level input readability.
- Updated dependencies [7382b8f]
- Updated dependencies [5010c80]
- Updated dependencies [806897b]
- Updated dependencies [7382b8f]
- Updated dependencies [22be097]
- Updated dependencies [806897b]
- Updated dependencies [316ff04]
- Updated dependencies [806897b]
  - @platform/ui-shell@0.5.0
  - @platform/sekai-master-api-sdk@1.1.0
  - @platform/i18n-source@0.2.1
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
