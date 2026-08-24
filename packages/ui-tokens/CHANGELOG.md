# @platform/ui-tokens

## 0.3.0

### Minor Changes

- 3ef365c: Share the Prismatic Archive palette mappings and controlled theme controls, and add tools-site palette and color-mode preferences.
  Replace the shared palette source for content-site with no intended visual change.

  Expose the private shared `AssetImage` component through its supported
  `@platform/ui-shell/asset-image` subpath for the tools-site banner.

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
