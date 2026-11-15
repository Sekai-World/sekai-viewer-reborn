---
"@platform/ui-shell": minor
"@apps/content-site": minor
"@apps/tools-site": minor
"@apps/media-lab-site": minor
"@apps/account-site": minor
---

Clicking a link now gives immediate feedback while the next page loads: a progress bar appears along the top edge after 120ms, the outgoing page dims when the wait is longer, and screen readers are told when loading takes more than a second. Navigations that finish quickly show nothing. The same bar covers cross-site links and full-page reloads until the browser replaces the page.
