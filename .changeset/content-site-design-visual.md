---
"@apps/content-site": patch
---

Align content-site visuals and motion with DESIGN.md: hover lifts go through one `hover-lift` utility that is disabled for coarse pointers, `prefers-reduced-motion`, and the site low-motion setting; skeleton and pulse animations stop under both reduced-motion signals; raster thumbnails brighten instead of scaling on hover; the five catalogue list pages share one set of Archive list styles in `app.css` instead of five copies; shared surface classes take their radius from the Tailwind radius scale; event and detail cards drop one-off large shadows and raw `rgba()` shadows; toolbar, header, chart-preview, info, and timeline controls keep a 44px box on every breakpoint; event data chips, virtual-live reward chips, music difficulty markers, and the timeline error box are daisyUI `badge` / `alert` foundations; `bg-white` becomes `bg-base-100`.
