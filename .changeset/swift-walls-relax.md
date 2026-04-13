---
"@apps/content-site": patch
"@platform/i18n-dicts": patch
"@platform/sekai-api-sdk": patch
"@platform/ui-shell": patch
---

Add a configurable `SEKAI_API_BASE_URL` for `content-site` and scaffold a generated `@platform/sekai-api-sdk` package aligned with `@platform/sekai-master-api-sdk`.
Also show the homepage-style countdown card on `content-site` event detail pages when the viewed event is the current event for that region.
Improve dark-mode surface contrast in `content-site` so cards and inset panels are more distinguishable.
Show the event unit name below the title in the left-side event info card on `content-site` event detail pages.
Show the event unit in its own labeled info row on `content-site` event detail pages.
Replace the `content-site` event detail right-side info card with a reusable event BGM player using the event BGM asset bundle.
Reduce `AudioPlayer` main-thread load by deferring audio seek work until the user finishes dragging the progress slider.
Use `requestAnimationFrame`-driven progress syncing in `AudioPlayer` to reduce timer overhead while audio is playing.
Lazy-load `AudioPlayer` audio only after the user clicks play, avoiding unnecessary audio initialization on page open.
Drive `content-site` event countdown progress bars with `requestAnimationFrame` while keeping countdown digits on second-level updates.
Fix `content-site` event BGM asset URLs to point directly to `<bgmAssetbundleName>.mp3`.
