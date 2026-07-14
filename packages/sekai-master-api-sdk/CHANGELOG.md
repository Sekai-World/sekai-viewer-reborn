# @platform/sekai-master-api-sdk

## 0.2.0

### Minor Changes

- 6817b6c: Add music detail page with audio preview/download, Media Session API, fillerSec offset handling, and mobile UX improvements

  Fix spoilered music list cards so saved spoiler-display settings are honored on initial page load, the first click reveals the card content, and a second click navigates to the detail page.

  Render the music detail jacket without an extra outer frame.

  Use a view icon for difficulty chart preview links instead of a playback icon.

### Patch Changes

- b673737: Add a gacha detail page with SSR loading, region switching, and pickup card links.

  Show pickup cards and rarity rates side by side on large gacha-detail layouts while keeping them stacked on smaller screens.

  Add a preferred content region selector in content-site settings for default database navigation.

  Improve the content-site homepage hierarchy with a large-screen three-column latest data layout and a lighter footer note.

  Disable 3D event-card hover effects on coarse pointer devices while preserving desktop hover behavior.

  Stabilize event-list region switching by ignoring stale streamed/fetched list results and remounting event cards per region.

  Move list filter dialog close actions to top-right icon buttons and remove the visible bottom Close buttons.

  Polish card list and detail metadata by widening agenda-view artwork, showing character avatars beside unit badges, and reusing filter-style attribute icons on card details.

  Extract card-detail gacha voice playback into a reusable `VoicePlayButton` component in `shared/`.

  Improve `VoicePlayButton` with stop-button playback semantics and a circular progress ring.

  Show a disabled, tooltip-backed error state when card gacha voice audio fails to load.

  Add richer event detail content with bonus summaries, detailed event bonus rules, thumbnail-backed featured card entries, jacket-backed event song entries, ranking reward bands, resolved reward-box contents, honor reward previews, and virtual live metadata.

  Fix event-detail ranking honor reward previews so rarity-specific local degree frames render around the honor body without being clipped.

  Show localized event type badges on the homepage current-event cards.

  Show event-detail virtual live banners from the virtual live asset bundle when available.

  Compact the event-detail virtual live summary layout.

  Restore large-screen event-detail density by showing featured cards in responsive columns and keeping ranking honor reward previews compact within reward rows.

  Render event-detail ranking honor reward previews with compact sub-degree assets on mobile and main-degree assets on larger screens.

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

## 0.1.4

### Patch Changes

- 70b917b: Regenerate the SDK for updated card, music, spoiler, music difficulty, tag, unit profile, and version API contracts.

## 0.1.3

### Patch Changes

- 3522a93: Regenerate the SDK for updated event list query capabilities.

## 0.1.2

### Patch Changes

- 6721ff0: Regenerate the SDK for aggregated versions, game character, game character unit, and unit profile endpoints.

## 0.1.1

### Patch Changes

- 2be6c80: Fix the SDK package entry path to point at the generated index entry.
