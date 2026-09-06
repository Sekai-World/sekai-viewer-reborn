# @platform/ui-shell

## 0.5.0

### Minor Changes

- 806897b: Add shared theme preference normalization, resolution, and document application helpers.

### Patch Changes

- 316ff04: Share the number-input spinner reset across all sites and improve content-site skill-level input readability.

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
