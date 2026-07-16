---
"@apps/content-site": minor
"@platform/sekai-master-api-sdk": minor
---

Add the region-aware Virtual Live catalogue with artwork, status, search, sorting, pagination, and detail navigation.

Align the Virtual Live detail layout with the Event detail structure so artwork and identity metadata live in the narrow left column while detailed data stays in the wide right column.

Regenerate `@platform/sekai-master-api-sdk`: the Virtual Live contract gained new dedicated fields, nested arrays, and region-availability responses, so the generated SDK types changed as part of the same feature.
