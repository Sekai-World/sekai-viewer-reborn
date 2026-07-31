---
"@apps/content-site": patch
---

Allow `AssetImage` callers to provide an explicit image retry policy, including signed GET URLs that must remain byte-for-byte unchanged and skip same-origin HEAD probes. Interactive previews use the same policy as their direct image loading.
