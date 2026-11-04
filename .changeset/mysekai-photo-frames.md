---
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/i18n-source": patch
---

Add a MySekai photo frames page to content-site at `/mysekai/photo-frames/[region]`, with a sidebar entry under MySekai. It lists every photo frame of the region in the game's order, with its preview and name, and can be searched by name. Previews always come from the JP asset server, the only one that has them.

Add the English source strings for the page to the content-site `common` and `mysekai` namespaces. Media-lab-site and tools-site are included only because they consume `@platform/i18n-source`. Their behavior does not change.
