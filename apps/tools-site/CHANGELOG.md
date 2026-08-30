# @apps/tools-site

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

- 3ef365c: Move canonical unit icon resolution and border colors into the shared UI shell.
- 3ef365c: Mark player-name changes on ranking history graphs with accessible, localized markers.
- 97be962: Reset app versions to restart the 0.0.x line from 0.0.1.
- 3ef365c: Share the Prismatic Archive palette mappings and controlled theme controls, and add tools-site palette and color-mode preferences.
  Replace the shared palette source for content-site with no intended visual change.

  Expose the private shared `AssetImage` component through its supported
  `@platform/ui-shell/asset-image` subpath for the tools-site banner.

- Updated dependencies [3ef365c]
- Updated dependencies [4dc89ad]
- Updated dependencies [f02e5fa]
- Updated dependencies [742389d]
- Updated dependencies [3ef365c]
- Updated dependencies [3ef365c]
  - @platform/ui-shell@0.3.0
  - @platform/sekai-master-api-sdk@1.0.1
  - @platform/sekai-api-sdk@0.2.1
  - @platform/ui-tokens@0.3.0

## 0.2.0

### Minor Changes

- 6d814ec: Add the first tools-site Prismatic Archive workflow for comparing current events
  across two regions, with localized SSR data loading and URL-restored controls.

### Patch Changes

- Updated dependencies [5c3cf63]
- Updated dependencies [85c9c43]
- Updated dependencies [615125d]
- Updated dependencies [07d232f]
- Updated dependencies [1e66948]
- Updated dependencies [85c9c43]
- Updated dependencies [d9ac1e8]
- Updated dependencies [6d814ec]
  - @platform/ui-shell@0.2.0
  - @platform/ui-tokens@0.2.0
  - @platform/i18n-runtime@0.1.3
  - @platform/sekai-master-api-sdk@1.0.0
  - @platform/i18n-source@0.2.0

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
