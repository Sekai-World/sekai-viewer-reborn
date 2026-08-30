# @platform/sekai-master-api-sdk

## 1.0.2

### Patch Changes

- 05ab7b4: Expose and consume the canonical master-api music `categories` field (a `string[]`) sourced from independent music category records. Malformed or missing categories are normalized to an empty array, and the shared `parseMusicCategories` helper keeps list and detail parsing consistent.

## 1.0.1

### Patch Changes

- 4dc89ad: Regenerate SDK from the current sekai-master-api OpenAPI spec, adding the build info endpoint (`getBuildInfo`, `SystemBuildInfoResponse`).

## 1.0.0

### Major Changes

- 1e66948: Make virtual live list items a compact list-card response instead of the full virtual live detail object. `virtualLiveRewards`, `virtualLiveGroup`, `screenMvMusicVocal`, `pamphlet`, `ticket`, and other detail-only fields are no longer available from the list endpoint; use the by-id endpoint when that data is needed.

## 0.3.0

### Minor Changes

- 0657278: Add the region-aware Virtual Live catalogue with artwork, status, search, sorting, pagination, and detail navigation.

  Align the Virtual Live detail layout with the Event detail structure so artwork and identity metadata live in the narrow left column while detailed data stays in the wide right column.

  Unify the primary media preview radius across Event, Card, Music, Gacha, and Virtual Live details, including their loading states and interactive image layers.

  Upgrade every detail-page loading state with a shared, responsive skeleton that mirrors each page's media, metadata, and content-card layout more closely.

  Regenerate `@platform/sekai-master-api-sdk`: the Virtual Live contract gained new dedicated fields, nested arrays, and region-availability responses, so the generated SDK types changed as part of the same feature.

  Add an accessible Virtual Live schedule switcher. Schedules are grouped by local calendar date behind horizontal date tabs (full keyboard navigation, swipe excluded). The selected day shows compact chronological `start time – end time` ranges. No internal Order/seq labels are shown. A schedule whose end crosses midnight appends the date to the end time for clarity. `After Event` schedules remain a secondary badge.

  Reorder the Virtual Live right column so Characters precedes Setlists. Virtual Live characters now rely on reliable `gameCharacterUnitId` → `gameCharacterId`/unit/colorCode enrichment for avatars and profile links, with graceful placeholders when the mapping is unavailable. The main detail page shows only a setlist summary; the full ordered setlist lives in an accessible scrollable dialog. The `character3dId1..6` 3D ID space has no confirmed mapping to `gameCharacterId`, so no guessed avatar or profile link is derived from it.

  Replace generic Virtual Live additional-data field counts with human-readable live-group dates, linked Screen MV song and character details, pamphlet copy, and ticket descriptions.

  Upgrade the full Virtual Live setlist into an expandable performance sequence with enriched music artwork, performers, and on-demand audio playback. MC timeline steps now load only when expanded and provide cached, filterable, progressively rendered event details.

  Polish MC timeline events with character avatars and profile links, concise dialogue and cast presentation, comment-only annotations, and click-to-play voice controls when voice assets are available.

- 5739f07: Add character profile endpoint support to the SDK and enhance the character catalogue and detail UI with grouped browsing and profile metadata.

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
