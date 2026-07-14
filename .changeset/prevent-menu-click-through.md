---
"@apps/content-site": patch
---

Fix navbar interactions: prevent menu dismissal clicks from activating page content underneath, and restore the navbar staying fixed at the top (the root `overflow-x: hidden` was breaking `position: sticky`; switched to `overflow-x: clip`).
