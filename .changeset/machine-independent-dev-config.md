---
"@apps/content-site": patch
---

Read the dev server host and allowed hosts from `VITE_DEV_HOST` / `VITE_DEV_ALLOWED_HOSTS` with loopback defaults instead of hardcoding machine-specific Tailscale values in `vite.config.ts`.
