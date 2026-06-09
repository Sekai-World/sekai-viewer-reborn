# @platform/ui-shell

## 0.1.3

### Patch Changes

- d44571f: Improve viewer shell drawer accessibility with semantic controls.
  Optimize content-site app shell controls and mobile list touch targets.
  Localize content-site navigation drawer screen reader labels and clarify scaffold copy in the secondary app shells.
  Harden content-site settings menus with Escape dismissal, focus restoration, and stable controlled menu regions.
  Align content-site region badge and list toolbar touch targets across xs and sm viewports.
  Extract content-site list toolbar icon controls into a shared component.
- d44571f: Add a low motion setting for content-site animations.

  Improve content-site accessibility and motion polish by labeling music toolbar icon buttons, tokenizing music difficulty colors, optimizing card split hover animation, and quieting navbar/menu styling.
  Narrow image preview transitions to opacity and transform.

  Refresh the content-site favicon with a simplified high-contrast diagonal Sekai Viewer SV mark.

## 0.1.2

### Patch Changes

- 6721ff0: Add a configurable `SEKAI_API_BASE_URL` for `content-site` and scaffold a generated `@platform/sekai-api-sdk` package aligned with `@platform/sekai-master-api-sdk`.
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
  Split `content-site` event detail presentation into focused Svelte components and reuse shared date parsing helpers.
  Remove the obsolete `@platform/i18n-dicts` workspace and load `content-site` i18n dictionaries from the external `sekai-i18n-reborn` CDN through `svelte-i18n`.
  Extract remote i18n loading and `svelte-i18n` registration into the shared `@platform/i18n-runtime` package so other apps can reuse the same CDN-backed runtime.
  Add `content-site` i18n source manifests plus CI and GitHub Actions automation to sync source strings into the translation repository through a pull request.
  Move app-scoped i18n source manifests into the shared `@platform/i18n-source` package.
  Constrain the `content-site` home page version info table width for easier reading.
  Render `content-site` home page current event banners through the shared event image component.
  Show unit icons next to the `content-site` event detail unit field.
  Show compact unit markers next to current event ids on `content-site` home cards.
  Show unit icons on `content-site` event list card banners and move the current-event badge to the banner footer.
  Update `@platform/sekai-master-api-sdk` generated client to include the new aggregated `/versions` endpoint and switch `content-site` home page version loading to use it.
  Regenerate `@platform/sekai-master-api-sdk` to add `gameCharacters`, `gameCharacterUnits`, and `unitProfiles` endpoints from the latest API spec.
  Display the banner game character's portrait and name in the left info section of `content-site` event detail pages.
  Remove legacy `content-site` event routes that redirected `/event/:id` URLs to region-scoped event URLs.
  Use local `chr_il` static assets for banner character icons on `content-site` event detail pages.
  Use theme-aware border and background colors for banner character icons on `content-site` event detail pages.
  Use matching theme-aware border and background colors for unit icons on `content-site` event detail pages.

## 0.1.1

### Patch Changes

- ab99d20: Improve `content-site` event detail asset fallbacks, split shared image preview trigger/modal components, and page streaming/favicon polish.
