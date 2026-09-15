---
"@platform/sekai-master-api-sdk": patch
"@platform/i18n-source": patch
"@apps/content-site": patch
---

Expose region-scoped Game News through `sekai-master-api`, request the complete
dataset with `includeAll=true` for client-side spoiler filtering, and migrate
content-site to the generated SDK client. Add the content-site Game News
translation source entries used by the new route and navigation.
