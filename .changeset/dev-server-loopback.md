---
"@apps/content-site": patch
---

Bind the Vite dev server to the loopback address (`127.0.0.1`) instead of all interfaces, and set `strictPort: true` so Tailscale serve can forward the port over the tailnet. This is a dev-only change with no production impact.
