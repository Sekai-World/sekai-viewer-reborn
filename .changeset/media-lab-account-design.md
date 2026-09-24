---
"@apps/media-lab-site": patch
"@apps/account-site": patch
"@platform/i18n-source": patch
---

Align media-lab-site and account-site with DESIGN.md: account-site imports the shared Prismatic Archive palettes and puts its canvas, cards, and text on the semantic surface roles, labels the primary/secondary badges for assistive technology, and keeps its route fade at the 150ms token while skipping it entirely under reduced motion; media-lab-site header buttons and popovers match the 44px / overlay-surface pattern with proper dialog semantics and pressed states, the story player overlay controls, choices, and autoplay badge are daisyUI `btn` / `badge` foundations with a 44px box and no backdrop blur, a load failure now offers Retry and loading announces a status, the story search field has an accessible name, area thumbnails use the shared `AssetImage` fallback, hover lifts respect reduced motion, and grids no longer use the `xl` rail threshold as a content breakpoint.
