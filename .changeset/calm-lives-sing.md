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
