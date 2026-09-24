---
"@platform/ui-shell": minor
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Align the shared `@platform/ui-shell` primitives with DESIGN.md §8: the global notification banner now composes daisyUI `alert`, `status`, and `btn` instead of a parallel custom component; the audio download toast uses daisyUI `toast` + `alert`; image preview, region switcher, theme controls, audio player, and drawer links keep a 44px interactive box; shared components drop hand-picked radii, large shadows, backdrop blur, and the raw `bg-white` / Tailwind palette swatches in favour of daisyUI defaults and semantic tokens; media placeholders and fades honour `prefers-reduced-motion` and `data-low-motion`; `BrandLockup` accepts `title`/`badge` so `ViewerShell` no longer duplicates its markup; and account-site scans `packages/ui-shell/src` for Tailwind utilities.
