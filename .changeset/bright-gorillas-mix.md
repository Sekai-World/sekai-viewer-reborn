---
"@apps/content-site": minor
"@platform/sekai-master-api-sdk": patch
---

Add a gacha detail page with SSR loading, region switching, and pickup card links.

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
