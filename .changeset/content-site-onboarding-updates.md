---
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/i18n-source": patch
"@platform/ui-shell": patch
---

Add an onboarding guide and versioned update log to content-site.

Guide visitors with a responsive spotlight tour of home, sidebar categories, settings, region, theme, and language controls instead of a standalone introduction dialog. Highlight home content or its real navigation link without changing the current route, and restore tour-owned drawer and scroll state on exit.

Smoothly transition the spotlight and its cutout between guide steps while respecting reduced-motion preferences.

Highlight the theme and language menu-opening buttons before showing their options, including the shared settings entry on mobile.

Advance active tours when visitors click the highlighted region without activating the underlying content. Ignore outside clicks and Escape, remove the skip action, and reserve early dismissal for the visible close button; the final step requires the explicit Finish action.

Remove the redundant back-to-home button from the update log, retaining its home breadcrumb.

Move the update log entry from settings menus to the sidebar's Project group.

Explain each content display preference through dedicated site-tour steps in desktop and mobile settings, keeping the setting rows limited to their labels and switches.

Offer an optional first-use guide when opening card, song, and virtual live catalogue filters, remembering the user's choice separately for each catalogue. Cover each available card and song filter with its own step or a complete grouped highlight, including the composer, arranger, and lyricist filters together in the song credits step.

Expose optional generic semantic group metadata on shared sidebar rows for consumers that need to identify complete navigation groups.
