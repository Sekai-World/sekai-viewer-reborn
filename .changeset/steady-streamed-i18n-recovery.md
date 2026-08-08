---
"@apps/content-site": patch
"@platform/i18n-runtime": patch
---

Keep resolved translations visible while a streamed locale refresh loads, preventing
temporary fallback text from replacing an already translated interface. Abort and
evict timed-out remote dictionary requests so a later locale or namespace load can
safely retry instead of reusing a failed in-flight result.
