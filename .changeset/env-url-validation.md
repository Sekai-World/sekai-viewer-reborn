---
"@platform/ui-shell": patch
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Validate URL environment variables when each app starts. A set API, asset, i18n, tools-site, or support-page URL must now be an absolute http(s) URL (the public asset base may also be a path such as `/storage`); otherwise the server exits with an error that names the variable without printing its value, instead of serving pages whose data or links are silently broken. Content-site also refuses to start without `PUBLIC_REMOTE_ASSET_BASE_URL`, which every client-side asset URL needs. Unset optional values and image builds without runtime configuration keep working as before.
