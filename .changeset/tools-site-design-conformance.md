---
"@apps/tools-site": patch
"@platform/i18n-source": patch
---

Align tools-site with DESIGN.md: the hero call to action and reward chips are daisyUI `btn` / `badge`; the ranking tablist is a plain `btn` tablist without stacked `tab` classes; all controls keep a 44px box; the control deck, workspace, hero, and dialogs drop structural shadows and backdrop blur; the goal dialog and dropdowns sit on the `--archive-surface-overlay` role; secondary text uses `--archive-text-muted`; ranking and graph failures identify the error and offer a retry; the details dialog uses the native daisyUI modal entrance instead of a max-height animation and margin centering; the share message wraps instead of truncating; palette swatches derive from each palette's primary colour; spacing follows the 4px rhythm and breakpoints use the Tailwind scale.
