---
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/i18n-source": patch
---

Tell content-site visitors when a newer version of the site has been deployed. A notice above the page content offers a Reload button and a dismiss button. The site never reloads on its own, and dismissing hides the notice for that deployment in every tab. Content-site checks for a new deployment every 10 minutes and when the tab regains focus. Failed checks stay silent. While a newer deployment is known, it replaces the release-notes notice for the version the tab is running.

Add the English source strings for the new notice to the content-site `common` namespace. Media-lab-site and tools-site are included only because they consume `@platform/i18n-source`. Their behavior does not change.
