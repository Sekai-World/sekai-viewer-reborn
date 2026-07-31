---
"@apps/content-site": patch
---

Allow shared content-site image callers to provide explicit image retry policies, including signed GET URLs that must remain byte-for-byte unchanged and skip same-origin HEAD probes. Interactive previews and card thumbnails use the same shared retry controller contract as direct asset loading.
