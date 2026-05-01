---
"@apps/content-site": patch
"@apps/account-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/i18n-runtime": patch
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
Tighten the `content-site` favicon framing so the icon fills more of the canvas with less wasted transparent padding.
Preload `AudioPlayer` track duration metadata before playback starts so the total time is visible earlier.
Refine the `AudioPlayer` control layout so the volume slider is shorter and more visually distinct from the main seek bar.
Move event BGM metadata embedding into the `content-site` server download route and offer MP3/WAV download actions from `AudioPlayer`.
Speed up large event BGM downloads by using parallel byte-range fetches from remote storage when the upstream asset server supports them.
Show an SSE-driven download progress bar for event BGM downloads and close the format menu immediately after the user picks a format.
Present event BGM download progress in a non-dismissible floating panel and cancel unfinished downloads when the page closes.
Allow `content-site` server-side BGM downloads to use a separately configured internal remote asset base URL.
Show the event point icon on the event detail ID badge in `content-site`.
Remove the obsolete `@platform/i18n-dicts` workspace and load `content-site` i18n dictionaries from the external `sekai-i18n-reborn` CDN through `svelte-i18n`.
Extract remote i18n loading and `svelte-i18n` registration into the shared `@platform/i18n-runtime` package so other apps can reuse the same CDN-backed runtime.
