---
"@apps/content-site": patch
"@platform/i18n-source": patch
---

Align content-site structure and accessibility with DESIGN.md: asset-card and news tag strips are real WAI-ARIA tablists with roving focus, Arrow/Home/End keys, and labelled tab panels; the current-event card no longer nests the tracker button inside the card link (stretched-link frame); music vocal rows no longer nest character links inside the selection button; detail, list, home, and event skeletons expose a loading status to assistive technology; card detail sections report load failures with a retry instead of an empty-state label; the gacha simulator shows a text error; the cards filter dialog uses daisyUI 5 fieldset/input classes and every list filter dialog is labelled; header popovers drop the false `aria-modal` and sit on the overlay surface; the remaining hardcoded strings (breadcrumb label, "N more", card alt fallback) move to the i18n dictionaries.
