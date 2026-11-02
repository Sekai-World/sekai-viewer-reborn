---
"@apps/content-site": patch
---

Percent-encode the region and ID segments of the legacy `/musics/:region/:id` redirects so non-Latin-1 or CR/LF values redirect instead of failing with a 500, and decoded `../` segments stay inside the canonical `/music/:region/:id` path.
