---
"@apps/content-site": minor
"@platform/sekai-master-api-sdk": minor
---

Add the region-aware Virtual Live catalogue with artwork, status, search, sorting, pagination, and detail navigation.

Align the Virtual Live detail layout with the Event detail structure so artwork and identity metadata live in the narrow left column while detailed data stays in the wide right column.

Unify the primary media preview radius across Event, Card, Music, Gacha, and Virtual Live details, including their loading states and interactive image layers.

Upgrade every detail-page loading state with a shared, responsive skeleton that mirrors each page's media, metadata, and content-card layout more closely.

Regenerate `@platform/sekai-master-api-sdk`: the Virtual Live contract gained new dedicated fields, nested arrays, and region-availability responses, so the generated SDK types changed as part of the same feature.

Add an accessible Virtual Live schedule switcher. Schedules are grouped by local calendar date behind horizontal date tabs (full keyboard navigation, swipe excluded). The selected day shows compact chronological `start time – end time` ranges. No internal Order/seq labels are shown. A schedule whose end crosses midnight appends the date to the end time for clarity. `After Event` schedules remain a secondary badge.

Reorder the Virtual Live right column so Characters precedes Setlists. Virtual Live characters now rely on reliable `gameCharacterUnitId` → `gameCharacterId`/unit/colorCode enrichment for avatars and profile links, with graceful placeholders when the mapping is unavailable. The main detail page shows only a setlist summary; the full ordered setlist lives in an accessible scrollable dialog. The `character3dId1..6` 3D ID space has no confirmed mapping to `gameCharacterId`, so no guessed avatar or profile link is derived from it.

Replace generic Virtual Live additional-data field counts with human-readable live-group dates, linked Screen MV song and character details, pamphlet copy, and ticket descriptions.

Upgrade the full Virtual Live setlist into an expandable performance sequence with enriched music artwork, performers, and on-demand audio playback. MC timeline steps now load only when expanded and provide cached, filterable, progressively rendered event details.

Polish MC timeline events with character avatars and profile links, concise dialogue and cast presentation, comment-only annotations, and click-to-play voice controls when voice assets are available.
