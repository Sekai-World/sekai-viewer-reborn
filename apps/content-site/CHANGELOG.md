# @apps/content-site

## 0.4.1

### Patch Changes

- 1a75424: Read the dev server host and allowed hosts from `VITE_DEV_HOST` / `VITE_DEV_ALLOWED_HOSTS` with loopback defaults instead of hardcoding machine-specific Tailscale values in `vite.config.ts`.
- f02e5fa: Migrate shared and content-site UI patterns for daisyUI 5 compatibility.
- 742389d: Improve card detail page layout at large viewport widths by giving right-column content more consistent reading widths and grouping related cards more clearly. Delay the shared desktop navigation rail until extra-large viewports.
- 10fe2a4: Unify the catalogue list surfaces across Cards, Music, Events, Gachas, and Virtual Lives with consistent control, results, and state treatments.
- b18d4d2: Reuse localized common labels across content pages, consolidate duplicate content-site labels, remove unused source keys, and localize breadcrumbs consistently with sidebar navigation.
- Updated dependencies [f02e5fa]
- Updated dependencies [742389d]
  - @platform/ui-shell@0.2.1

## 0.4.0

### Minor Changes

- 615125d: Add the opt-in Prismatic Archive foundation with additive semantic tokens, a
  persistent desktop rail option, and localized skip-to-content navigation. Update
  the content-site home to foreground the current event, group recent releases,
  and clarify its database directory and version provenance. Add deterministic
  browser visual-regression coverage for the streamed current-event banner. Simplify
  the card-list sorting controls to icon-only buttons. Add artifact-backed visual
  failure review and a manual, artifact-only baseline candidate workflow; CI never
  updates or commits snapshots automatically.
  Ensure content-site waits for its target locale dictionary during SSR and client
  navigations, retaining the previous complete locale while a user-requested
  locale change loads instead of visibly resetting to English fallback text.
  Bound remote dictionary cache lookups so timed-out requests are aborted and
  evicted for safe retry rather than permanently poisoning a locale/namespace key.

### Patch Changes

- e0f8744: Refine archive home, current-event, cards, and event-detail presentation.
- d901b1b: Make mosaicked card-list spoilers reveal before opening card details with keyboard activation.
- 5c3cf63: Automatically retry image and preview loading twice before showing a fallback or failure state, improving recovery from temporary asset delivery errors.
- c3ee323: Center solitary card artwork in the agenda and comfy card-list views.
- 65d2675: Group character avatars into content-sized unit cards with proportional unit logos, responsive spacing, and a matching loading skeleton.
- 85c9c43: Allow shared content-site image callers to provide explicit image retry policies, including signed GET URLs that must remain byte-for-byte unchanged and skip same-origin HEAD probes. Interactive previews and card thumbnails use the same shared retry controller contract as direct asset loading.
- 2769d84: Make event bonus-character, event banner-character, and card character information rows link directly to character pages with consistent hover and keyboard feedback.
- 10b1f90: Apply the saved or system theme before the first page paint to prevent a light-to-dark flash.
- 480d812: Improve event and card navigation, including bonus-character card filters and current-event feedback.
- 4087be7: Show time-based sorting before ID sorting consistently across content lists.
- 85c9c43: Add bounded positive jitter to shared image retry scheduling so concurrent image failures recover over staggered 300–360ms and 900–1080ms windows without changing retry policies or adding global concurrency limiting.
- d9ac1e8: Keep resolved translations visible while a streamed locale refresh loads, preventing
  temporary fallback text from replacing an already translated interface. Abort and
  evict timed-out remote dictionary requests so a later locale or namespace load can
  safely retry instead of reusing a failed in-flight result.
- 4087be7: Increase list toolbar button sizing on wider screens.
- 5a7cc8c: Keep card and music artwork at its native scale on hover, reserve current-event banner space
  while it loads, and use outlined metadata badges above current-event titles.
- Updated dependencies [5c3cf63]
- Updated dependencies [85c9c43]
- Updated dependencies [615125d]
- Updated dependencies [07d232f]
- Updated dependencies [1e66948]
- Updated dependencies [85c9c43]
- Updated dependencies [d9ac1e8]
- Updated dependencies [6d814ec]
  - @platform/ui-shell@0.2.0
  - @platform/ui-tokens@0.2.0
  - @platform/i18n-runtime@0.1.3
  - @platform/sekai-master-api-sdk@1.0.0
  - @platform/i18n-source@0.2.0

## 0.3.0

### Minor Changes

- 0657278: Add the region-aware Virtual Live catalogue with artwork, status, search, sorting, pagination, and detail navigation.

  Align the Virtual Live detail layout with the Event detail structure so artwork and identity metadata live in the narrow left column while detailed data stays in the wide right column.

  Unify the primary media preview radius across Event, Card, Music, Gacha, and Virtual Live details, including their loading states and interactive image layers.

  Upgrade every detail-page loading state with a shared, responsive skeleton that mirrors each page's media, metadata, and content-card layout more closely.

  Regenerate `@platform/sekai-master-api-sdk`: the Virtual Live contract gained new dedicated fields, nested arrays, and region-availability responses, so the generated SDK types changed as part of the same feature.

  Add an accessible Virtual Live schedule switcher. Schedules are grouped by local calendar date behind horizontal date tabs (full keyboard navigation, swipe excluded). The selected day shows compact chronological `start time – end time` ranges. No internal Order/seq labels are shown. A schedule whose end crosses midnight appends the date to the end time for clarity. `After Event` schedules remain a secondary badge.

  Reorder the Virtual Live right column so Characters precedes Setlists. Virtual Live characters now rely on reliable `gameCharacterUnitId` → `gameCharacterId`/unit/colorCode enrichment for avatars and profile links, with graceful placeholders when the mapping is unavailable. The main detail page shows only a setlist summary; the full ordered setlist lives in an accessible scrollable dialog. The `character3dId1..6` 3D ID space has no confirmed mapping to `gameCharacterId`, so no guessed avatar or profile link is derived from it.

  Replace generic Virtual Live additional-data field counts with human-readable live-group dates, linked Screen MV song and character details, pamphlet copy, and ticket descriptions.

  Upgrade the full Virtual Live setlist into an expandable performance sequence with enriched music artwork, performers, and on-demand audio playback. MC timeline steps now load only when expanded and provide cached, filterable, progressively rendered event details.

  Polish MC timeline events with character avatars and profile links, concise dialogue and cast presentation, comment-only annotations, and click-to-play voice controls when voice assets are available.

- bc86e6d: Add the character catalogue to the Content Center: a region-aware character list (`/characters/[region]`) with unit filtering, search, and a card count, plus a character detail page (`/character/[region]/[id]`) showing profile, unit, height, and sequence metadata.

  Link characters to their cards from the detail page through the shared cards list filtered by character ID. Surface the new catalogue in the homepage database directory, and add a Characters entry to the sidebar for discovery.

  Enable cross-navigation into character profiles from card detail (character identity), event detail (banner character), and music detail (vocal characters) whenever a positive `gameCharacterId` is present. Load the complete character and unit catalogue through paginated aggregation (`aggregateGameCharactersByRegion` / `aggregateGameCharacterUnitsByRegion`), following pagination cursors and deduplicating results.

  Wire the character routes into the streaming i18n pattern so list/detail labels resolve from the `character` namespace with localized fallbacks.

- 5739f07: Add character profile endpoint support to the SDK and enhance the character catalogue and detail UI with grouped browsing and profile metadata.
- 5fb6646: Add guarded mobile swipe navigation between adjacent regions on content list and detail pages.

  Reuse the shared `swipeRegion` action on the home page instead of bespoke touch handlers, and remove the `maximum-scale`/`user-scalable` viewport restriction so users can pinch-zoom.

### Patch Changes

- ba1d479: Polish detail-page layouts by constraining the media column to one-third of the available width and 400px maximum.
- bf4e5a1: Polish Event Detail navigation with accessible character and Virtual Live links, and fix the honor overlay aspect ratio.
- Updated dependencies [0657278]
- Updated dependencies [5739f07]
  - @platform/sekai-master-api-sdk@0.3.0

## 0.2.2

### Patch Changes

- fc2bb4f: Bind the Vite dev server to the loopback address (`127.0.0.1`) instead of all interfaces, and set `strictPort: true` so Tailscale serve can forward the port over the tailnet. This is a dev-only change with no production impact.
- e11ce97: Fix navbar interactions: prevent menu dismissal clicks from activating page content underneath, and restore the navbar staying fixed at the top (the root `overflow-x: hidden` was breaking `position: sticky`; switched to `overflow-x: clip`).

## 0.2.1

### Patch Changes

- c072bb7: Add an on-demand card asset gallery that probes optional thumbnail, small, cutout, trimmed cutout, and gacha artwork before loading available images.
- Updated dependencies [c072bb7]
  - @platform/i18n-source@0.1.5

## 0.2.0

### Minor Changes

- b673737: Add a gacha detail page with SSR loading, region switching, and pickup card links.

  Show pickup cards and rarity rates side by side on large gacha-detail layouts while keeping them stacked on smaller screens.

  Add a preferred content region selector in content-site settings for default database navigation.

  Improve the content-site homepage hierarchy with a large-screen three-column latest data layout and a lighter footer note.

  Disable 3D event-card hover effects on coarse pointer devices while preserving desktop hover behavior.

  Stabilize event-list region switching by ignoring stale streamed/fetched list results and remounting event cards per region.

  Move list filter dialog close actions to top-right icon buttons and remove the visible bottom Close buttons.

  Polish card list and detail metadata by widening agenda-view artwork, showing character avatars beside unit badges, and reusing filter-style attribute icons on card details.

  Extract card-detail gacha voice playback into a reusable `VoicePlayButton` component in `shared/`.

  Improve `VoicePlayButton` with stop-button playback semantics and a circular progress ring.

  Show a disabled, tooltip-backed error state when card gacha voice audio fails to load.

  Add richer event detail content with bonus summaries, detailed event bonus rules, thumbnail-backed featured card entries, jacket-backed event song entries, ranking reward bands, resolved reward-box contents, honor reward previews, and virtual live metadata.

  Fix event-detail ranking honor reward previews so rarity-specific local degree frames render around the honor body without being clipped.

  Show localized event type badges on the homepage current-event cards.

  Show event-detail virtual live banners from the virtual live asset bundle when available.

  Compact the event-detail virtual live summary layout.

  Restore large-screen event-detail density by showing featured cards in responsive columns and keeping ranking honor reward previews compact within reward rows.

  Render event-detail ranking honor reward previews with compact sub-degree assets on mobile and main-degree assets on larger screens.

- b673737: Add the regional gacha list page with SSR loading, infinite-scroll JSON data, localized controls, and gacha logo cards.

  Add gacha background previews and a localized, accessible card-probability detail dialog that batches metadata lookups for the displayed gacha cards.

  Keep card probability notes available from an accessible info tooltip beside the dialog trigger.

- 6817b6c: Add music detail page with audio preview/download, Media Session API, fillerSec offset handling, and mobile UX improvements

  Fix spoilered music list cards so saved spoiler-display settings are honored on initial page load, the first click reveals the card content, and a second click navigates to the detail page.

  Render the music detail jacket without an extra outer frame.

  Use a view icon for difficulty chart preview links instead of a playback icon.

### Patch Changes

- bf96e6c: Add a branded, user-friendly route-level error page for content-site.

  Add a content-site card detail page with localized card detail labels, region switching, artwork tabs, skill details, stats, and side-story panels.

  Keep the side-story title area top-aligned when the lower card pair grows taller on content-site card detail pages.

  Show localized event start and end times on content-site event list cards.

  Show related events on content-site card detail pages.

  Show computed related-event bonus ranges and story badges on card detail pages.

  Keep multiple skill effect summaries in a compact row on wider card detail layouts.

  Restore gacha phrase display and audio playback on content-site card detail pages.

  Align related gacha card hover, focus, and image brightness states with related event cards.

  Show birthday rarity icons on content-site card detail pages.

  Eliminate first-load blank page by streaming layout i18n messages and using local source messages as the synchronous fallback while remote translations resolve.

- b673737: Add the generated card related-events endpoint client.

  Expose computed related-event bonus range fields.

  Expose enriched event card and music relation response fields.

  Use enriched event relation payloads on the event detail page to avoid per-card and per-music detail requests.

  Add the bounded event detail aggregate endpoint client and use it on the event detail page to reduce first-screen request fan-out.

  Constrain event ranking reward honor badge previews by height while preserving their asset aspect ratio.

  Simplify event detail virtual live metadata by omitting type and showing start/end as one unlabeled formatted time range.

  Show enriched Bonus Character rows on event details, with attributes presented as secondary bonus metadata.

  Load and cache complete ranking rewards only when the event detail Show all rewards control is used.

  Hide ranking reward entries and ranges whose resource box details cannot be resolved.

- fbfcbb1: Standardize content-site character thumbnails, avatars, unit icons, and filter chips on shared components with static per-character and per-unit border colors.

  Keep card unit and support-unit filter chips as consistently spaced standalone controls.

  Present card detail artwork in wider previews: crop normal/after-training art to fill the frame while keeping transparent cutouts uncropped with reduced empty space.

- b673737: Move image preview format choices into the download menu instead of switching the preview image format.

  Align the image preview modal frame radius with rounded preview images.

- dd0c61f: Load content-site page and event labels with the correct i18n namespaces, including
  safe synchronous fallbacks while streamed translations resolve.
- b673737: Extract a shared card thumbnail component for the content site and reuse it in card list agenda/comfy views and gacha pickup cards.
- b673737: Improve the card detail asset tab layout on mobile so normal and trained image choices wrap into two-column rows.

  Polish homepage event, music, and gacha cards with compact metadata, stable surfaces, and a gacha-logo asset fallback.

  Use region-specific latest music jacket URLs on the homepage so region-exclusive songs do not fall back to the JP asset bucket.

  Use region-specific latest gacha banner and logo fallback URLs on the homepage so CN gacha cards can fall back to their local logo assets when banners are unavailable.

- Updated dependencies [b673737]
- Updated dependencies [b673737]
- Updated dependencies [b673737]
- Updated dependencies [b673737]
- Updated dependencies [6817b6c]
- Updated dependencies [b673737]
- Updated dependencies [b673737]
  - @platform/sekai-master-api-sdk@0.2.0
  - @platform/i18n-source@0.1.4
  - @platform/ui-shell@0.1.4
  - @platform/i18n-runtime@0.1.2

## 0.1.4

### Patch Changes

- d44571f: Improve viewer shell drawer accessibility with semantic controls.
  Optimize content-site app shell controls and mobile list touch targets.
  Localize content-site navigation drawer screen reader labels and clarify scaffold copy in the secondary app shells.
  Harden content-site settings menus with Escape dismissal, focus restoration, and stable controlled menu regions.
  Align content-site region badge and list toolbar touch targets across xs and sm viewports.
  Extract content-site list toolbar icon controls into a shared component.
- 70b917b: Fix event list request query serialization for the updated `sekai-master-api-sdk` contract and add content display spoiler settings in the navbar.

  Add a card list page with region switching, sorting, filtering, pagination, and multiple view modes. Extend the card filters with unit, character, skill, and 3DMV cut-in controls backed by the updated `/cards/:region/list` query params without preloading every card page.

  Add color previews to the content-site theme selector.

  Give card list unit icons rounded surfaces for dark theme readability.

  Add a regional song list with jacket artwork, grid and agenda layouts, and searchable, clearable filters for title, MV type, and creator credits.

  Use the checked-in content-site i18n source messages as the runtime fallback for missing remote dictionary keys.

  Prepare the song list filters for vocal character, vocal unit, tag, difficulty, and level fields.

  Add song filter hints, multi-select difficulty, game character and unit pickers, and level condition matching.

  Respect spoiler content display settings on the song list and mosaic unrevealed future songs when enabled.

  Use the same scroll-to-load-more sentinel behavior on the song list as card and event lists.

  Refresh the sekai-master-api SDK after card and song list spoiler query support landed upstream.

  Drive card and song list spoiler loading from the `spoiler` query parameter.

  Make song list vocal filters use game character and unit selectors, add a song-has-append-difficulty switch, and support level filter conditions.

  Regenerate the sekai-master-api SDK for the music difficulties endpoint and make the song tag filter use the fixed multi-select tag set.

  Show song tags as localized badges above song titles in the music list cards.

  Forward the song play level filter to the master API and parse list response difficulty levels correctly.

  Merge the song vocal unit filter into the tag filter with unit-style icons and legacy vocal unit filter migration.

  Resolve unit display names from the regional unit profile API instead of hardcoded translations.

  Cache regional unit profiles until the `/versions/:region` data version changes.

- d44571f: Add a low motion setting for content-site animations.

  Improve content-site accessibility and motion polish by labeling music toolbar icon buttons, tokenizing music difficulty colors, optimizing card split hover animation, and quieting navbar/menu styling.
  Narrow image preview transitions to opacity and transform.

  Refresh the content-site favicon with a simplified high-contrast diagonal Sekai Viewer SV mark.

- Updated dependencies [d44571f]
- Updated dependencies [70b917b]
- Updated dependencies [d44571f]
  - @platform/ui-shell@0.1.3
  - @platform/i18n-source@0.1.3
  - @platform/sekai-master-api-sdk@0.1.4

## 0.1.3

### Patch Changes

- 3522a93: Enhance event list filtering and locale-loading UX in content-site, add local event filter debug logging, reduce navbar blur, soften current event unit icon borders, remove the banner-unit filter from the event list page, make startAt descending the default event list sort, replace event card hover effects with DaisyUI hover-3d, and regenerate sekai-master-api-sdk for updated events list query capabilities.
- Updated dependencies [3522a93]
  - @platform/sekai-master-api-sdk@0.1.3

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
- Updated dependencies [6721ff0]
  - @platform/i18n-runtime@0.1.1
  - @platform/sekai-master-api-sdk@0.1.2
  - @platform/ui-shell@0.1.2

## 0.1.1

### Patch Changes

- ab99d20: Improve `content-site` event detail asset fallbacks, split shared image preview trigger/modal components, and page streaming/favicon polish.
- Updated dependencies [ab99d20]
- Updated dependencies [2be6c80]
  - @platform/ui-shell@0.1.1
  - @platform/sekai-master-api-sdk@0.1.1
