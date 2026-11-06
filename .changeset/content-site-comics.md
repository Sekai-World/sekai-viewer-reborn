---
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/i18n-source": patch
"@platform/sekai-master-api-sdk": patch
---

Add a comics page to content-site at `/comics/[region]`, with a sidebar entry under Library. It lists the comics in the region's master data in ID order, with images from that region, and can be searched by title. A preview opens from each comic, with previous and next buttons, the left and right arrow keys, download, and open in a new window. Back closes the preview.

Regenerate the master API SDK for the new `comics` routes and add the page's English source strings in a new content-site `comic` namespace. The other apps are included only because they consume these shared packages. Their behavior does not change.
