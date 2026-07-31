---
"@platform/ui-shell": minor
"@apps/content-site": patch
---

Add bounded positive jitter to shared image retry scheduling so concurrent image failures recover over staggered 300–360ms and 900–1080ms windows without changing retry policies or adding global concurrency limiting.
