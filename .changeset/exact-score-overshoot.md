---
"@apps/tools-site": minor
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@platform/i18n-source": patch
---

Make the target plan's "Closest to the target" objective work for score targets, and for event-point targets above the old limit. An exact search now answers when the sum table would be too large, and still refuses a request it cannot prove within its limits. Update the English hint shown for such a request. Content-site and media-lab-site only pick up the shared i18n source package.
