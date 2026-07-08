---
"@platform/sekai-master-api-sdk": patch
"@apps/content-site": patch
"@platform/i18n-source": patch
---

Add the generated card related-events endpoint client.

Expose computed related-event bonus range fields.

Expose enriched event card and music relation response fields.

Use enriched event relation payloads on the event detail page to avoid per-card and per-music detail requests.

Add the bounded event detail aggregate endpoint client and use it on the event detail page to reduce first-screen request fan-out.

Constrain event ranking reward honor badge previews by height while preserving their asset aspect ratio.

Simplify event detail virtual live metadata by omitting type and showing start/end as one unlabeled formatted time range.

Show enriched Bonus Character rows on event details, with attributes presented as secondary bonus metadata.
