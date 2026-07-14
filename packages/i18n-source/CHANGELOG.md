# @platform/i18n-source

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
