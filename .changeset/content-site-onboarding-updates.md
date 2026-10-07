---
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/ui-shell": patch
---

Add an onboarding guide and versioned update log to content-site.

Guide visitors with a responsive spotlight tour of home, sidebar categories, settings, region, theme, and language controls instead of a standalone introduction dialog. Highlight home content or its real navigation link without changing the current route, and restore tour-owned drawer and scroll state on exit.

Expose optional generic semantic group metadata on shared sidebar rows for consumers that need to identify complete navigation groups.
