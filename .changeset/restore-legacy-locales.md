---
"@platform/i18n-runtime": minor
"@apps/content-site": minor
"@apps/tools-site": patch
"@apps/media-lab-site": patch
---

Expand the content-site UI locale registry while keeping other apps restricted to their current dictionary-backed choices.

Derive dictionary mappings from the shared locale registry and include SSR locale handling in coverage collection, with regressions for streamed document attributes.
