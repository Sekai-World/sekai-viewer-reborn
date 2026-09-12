# @platform/i18n-runtime

## 0.2.0

### Minor Changes

- 806897b: Add shared supported UI locale configuration and locale normalization helpers.

## 0.1.3

### Patch Changes

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
- d9ac1e8: Keep resolved translations visible while a streamed locale refresh loads, preventing
  temporary fallback text from replacing an already translated interface. Abort and
  evict timed-out remote dictionary requests so a later locale or namespace load can
  safely retry instead of reusing a failed in-flight result.

## 0.1.2

### Patch Changes

- b673737: Move scoped i18n bundle loading into the shared runtime package and make page-local
  translation fallbacks side-effect-free while streamed locale requests resolve.

## 0.1.1

### Patch Changes

- 6721ff0: Extract remote dictionary loading and `svelte-i18n` registration into the shared runtime package for CDN-backed app dictionaries.
