---
"@platform/i18n-runtime": patch
---

Move scoped i18n bundle loading into the shared runtime package and make page-local
translation fallbacks side-effect-free while streamed locale requests resolve.
