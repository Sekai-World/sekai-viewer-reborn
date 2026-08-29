---
"@apps/content-site": patch
"@apps/account-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/sekai-master-api-sdk": patch
---

Expose and consume the canonical master-api music `categories` field (a `string[]`) sourced from independent music category records. Malformed or missing categories are normalized to an empty array, and the shared `parseMusicCategories` helper keeps list and detail parsing consistent.
