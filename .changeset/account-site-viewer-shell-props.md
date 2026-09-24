---
"@apps/account-site": patch
---

Restore the account-site `ViewerShell` navigation title, drawer id, sidebar items, and version badge, which had been rendered as page text since the page-title normalization. Drop `--tsgo` from the app `check` scripts so `svelte-check` type-checks shared `@platform/ui-shell` components again; the tsgo mode skips Svelte files outside each app's tsconfig root, which is how this regression passed CI.
