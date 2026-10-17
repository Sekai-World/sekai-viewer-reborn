---
"@platform/sekai-master-api-sdk": patch
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
"@platform/i18n-source": patch
---

Regenerate SDK from sekai-master-api OpenAPI spec: GitHub webhook master-data sync now returns 409 conflict with `Retry-After` while another pod holds the sync lease (#101), and adds the admin sync lease diagnostics endpoint `GET /api/v1/admin/master-data/lease` (#105).

Expose music video descriptors in music detail responses and restore 2D and original MV playback on content-site with synchronized vocal audio and version selection. Rebuild all consuming apps with the updated SDK.

Add validated YouTube references to song details with external links and optional click-to-load privacy-enhanced embeds, localized controls, and coordination with native music players.
