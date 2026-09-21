---
"@platform/i18n-source": patch
"@apps/tools-site": patch
---

Rename the tools-site sidebar heading key from `navigation.tools` ("Tools") to `navigation.sidebar` ("Navigation"), matching the sidebar title used by content-site and media-lab-site. The rename (rather than a value edit) keeps the remote dictionary from overriding the new label with the stale "Tools" string until Weblate catches up.
