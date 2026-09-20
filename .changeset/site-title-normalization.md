---
"@platform/ui-shell": patch
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Normalize browser-tab page titles across all four sites to `<content title> | <catalog title> | <site name>`, assembled by a shared `createPageTitle` helper in ui-shell; Sekai Tools, Sekai Media Lab, and Sekai Account replace their previous naming, and account-site gains a page title.
