---
"@apps/tools-site": patch
---

Align the theme dropdown sections in the tools-site navbar: the palette and color-mode lists inside `themeSelector` previously inherited daisyUI `.menu`'s `fit-content` width, so the two stacked sections rendered at unequal widths inside the `w-max` dropdown panel. Both lists now stretch to the shared container width (`menu w-full p-0`), letting the wider section drive the panel width while the narrower section's rows match it, with no fixed widths that could overflow the mobile combined settings menu. The change applies to both render locations of the selector (desktop theme dropdown and mobile settings menu) via the shared snippet, leaving dropdown anatomy and accessibility wiring untouched.
