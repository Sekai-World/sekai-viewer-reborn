---
"@apps/content-site": minor
---

URLs with an unknown region segment (`/cards/xx`, `/card/xx/1`, `/api/home/xx`) now answer 404 instead of serving Japanese data, and detail pages answer 404 for a malformed id (`/card/jp/abc`). Detail pages whose record does not exist in the region keep their in-page message and are marked `noindex`.
