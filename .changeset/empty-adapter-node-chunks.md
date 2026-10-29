---
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Migrate all four apps to SvelteKit 3 and adapter-node 6, including the new environment-variable modules and navigation/response APIs. Remove the adapter-node 5 chunk workaround now that adapter-node 6 uses Rolldown and no longer needs the patch; retain client-side EventDebugDialog and Howler bundles and verify the generated Node server output.
