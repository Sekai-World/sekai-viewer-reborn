---
"@platform/sekai-master-api-sdk": patch
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Regenerate SDK from sekai-master-api OpenAPI spec: GitHub webhook master-data sync now returns 409 conflict with `Retry-After` while another pod holds the sync lease (#101), and adds the admin sync lease diagnostics endpoint `GET /api/v1/admin/master-data/lease` (#105).

Refresh music detail types with music video/original-link fields and namespace-aware vocal character names, including nullable names and existing override characters. Rebuild consuming applications with the updated SDK.
