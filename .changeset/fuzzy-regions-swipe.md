---
"@apps/content-site": minor
---

Add guarded mobile swipe navigation between adjacent regions on content list and detail pages.

Reuse the shared `swipeRegion` action on the home page instead of bespoke touch handlers, and remove the `maximum-scale`/`user-scalable` viewport restriction so users can pinch-zoom.
