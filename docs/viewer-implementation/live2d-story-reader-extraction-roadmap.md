# Live2D Story Reader Extraction Roadmap

This note describes the Live2D implementation in the legacy `sekai-viewer`
project and the migration target in
`sekai-viewer-reborn/apps/media-lab-site`. The legacy analysis was made against
commit `0504bee6` (`1.19.3`); the target-side notes are based on the current
reborn repository structure.

## Executive conclusion

The Story Reader is not primarily a React renderer. Its playback engine is an
imperative PixiJS scene graph with a scenario action interpreter. React currently
owns the page shell, loading orchestration, Pixi application lifecycle, playback
state, and settings UI.

The recommended extraction is therefore:

1. Keep the existing PixiJS/Cubism/Howler runtime and behavior initially.
2. Move it behind a framework-neutral imperative API.
3. Inject data, asset URLs, text/translation lookup, logging, and media factories
   instead of reading React hooks or application stores from the runtime.
4. Keep a thin React compatibility adapter for parity checks, then mount the
   same runtime from a SvelteKit page with a normal HTML canvas.

The production destination is `media-lab-site`, which is currently only a
shell. Its first Live2D feature should be delivered as a complete vertical
slice: one route, one supported story type, one data adapter, and one player
flow before expanding story coverage.

Do not start by rewriting the player in Svelte or replacing `@pixi/react`. The
important boundary is the player lifecycle and its data adapters, not the JSX.

## Current architecture

### Loading and playback pipeline

```text
story route + region
  -> storyLoader hooks resolve scenario URL and metadata
  -> scenario asset is fetched and normalized
  -> all media URLs are derived from scenario snippets
  -> images, videos, Howler sounds, model JSON and model assets are preloaded
  -> model motions are pruned to those referenced by the scenario
  -> Live2DController is created with a Pixi Application
  -> controller loads a bounded model queue and applies scenario checkpoints
```

The loading stages are implemented in
`sekai-viewer/src/pages/storyreader-live2d/StoryReaderLive2DContent.tsx` and
`sekai-viewer/src/utils/Live2DPlayer/load.ts`:

- `useScenarioInfo()` maps unit, event, character, card, area, and special story
  metadata to a scenario asset URL.
- `getProcessedScenarioDataForLive2D()` inserts synthetic initial background,
  BGM, and character-layout snippets from `FirstBackground`, `FirstBgm`, and
  `FirstLayout`.
- `useMediaUrlForLive2D()` scans snippets and resolves talk voice, background,
  full-screen text voice, movie, BGM, and SE assets.
- Live2D asset requests share an app-controlled limiter with four in-flight
  requests and at most twelve starts per second. HTTP 429 responses retry up to
  four times, honoring a valid `Retry-After` value or using bounded exponential
  backoff with jitter when it is absent.
- After scenario data is available, media URL resolution and Live2D model-list /
  model-metadata resolution begin concurrently. Media preloading starts once its
  URLs resolve, while model metadata continues; each result is awaited once for
  controller construction.
- `preloadModels()` loads texture, moc, and physics assets, then prunes unused
  motions.
- `preloadModelMotion()` preloads the remaining motion and expression JSON files.
- `Live2DController.step_until_checkpoint()` groups `ProgressBehavior.Now`
  snippets, applies parallel actions, waits for the checkpoint boundary, and
  waits for active talk audio to finish.

The standalone `src/pages/live2d/Live2D.tsx` page is a separate model showcase.
It shares model-data loading and the Pixi/Live2D dependency, but it does not use
the Story Reader scenario controller. It should not be coupled to the extracted
Story Reader package unless a shared model loader is intentionally introduced.

### Technology stack

| Area           | Current implementation                                                     | Extraction implication                                                            |
| -------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Framework      | React 18, Vite, TypeScript                                                 | Keep only in the host adapter and page UI.                                        |
| 2D renderer    | PixiJS 7.4.3                                                               | Keep Pixi 7 for the first extraction.                                             |
| Live2D runtime | `@sekai-world/pixi-live2d-display-mulmotion@0.5.1`                         | This is the Cubism 4 / multi-motion integration and has a Pixi 7 peer dependency. |
| Model loading  | `Live2DModel.from`, model JSON plus moc/texture/physics/motion files       | Keep model data normalization separate from the renderer.                         |
| Animation      | Pixi `Ticker`, custom `AnimationController`, `AbortController`, promises   | Move into the runtime; expose cancellation as an API.                             |
| Audio          | Howler; Web Audio `AnalyserNode` for lip sync                              | Hide Howler and the analyzer behind an audio adapter.                             |
| UI/media       | Pixi `Text`, `Sprite`, `Graphics`, filters, HTML video, browser fullscreen | Pixi scene UI can stay in the runtime; page controls stay in the host.            |
| Data/network   | Axios, `fetch`, `Image`, HTML video, MinIO asset URL helpers               | Inject a browser asset loader and a Sekai-specific URL resolver.                  |
| Translation    | `TranslationCache`, `LlmTranslationService`, `rootStore`                   | Pass a text resolver/config object; do not import the global store.               |

## What the player actually renders

`Live2DPlayer` creates and orders Pixi layers for background, Live2D models,
scene effects, memory/flashback filters, telop, Sekai transitions, wipes,
full-color overlays, full-screen text, movies, dialog, and place information.
The layers are ordinary Pixi containers; no React component is involved in the
actual draw/update operations.

`Live2D` model handling currently includes:

- model creation with `motionPreload: ALL`;
- two parallel motion managers, one for motions and one for expressions;
- model visibility/position/show/hide/move animations;
- bounded model replacement, with a default queue size of six;
- direct parameter reset for `ParamMouthOpenY`;
- lip sync by routing a Howler gain node through an `AnalyserNode`;
- hologram and color/filter effects;
- explicit sound, image, Pixi container, and animation cleanup.

The action interpreter supports these `SnippetAction` values:

- `Talk`: dialog text, optional translated text, motions, voice, and lip sync;
- `CharacterLayout`: appear, move, and clear models;
- `CharacterMotion`: motion/expression changes;
- `SpecialEffect`: background, transitions, wipes, filters, telops, movies,
  camera changes, and scenario effects;
- `Sound`: BGM/SE stack, loop, cross-fade, stop, and volume changes;
- `CharacterLayoutMode`: normal versus three-model layout.

The current dispatchers do not implement `None`, `InputName`, or `Selectable`
snippet actions. They also do not dispatch `None`, `ChangeCardStill`,
`ChangeBackgroundStill`, or `SimpleSelectable` special effects. This must be
recorded as compatibility scope rather than silently lost during extraction.

## React coupling map

### Already close to framework-neutral

These modules are imperative TypeScript and can move with relatively little
structural change:

- `sekai-viewer/src/utils/Live2DPlayer/Live2DPlayer.ts`
- `sekai-viewer/src/utils/Live2DPlayer/Live2DController.ts`
- `sekai-viewer/src/utils/Live2DPlayer/layer/`
- `sekai-viewer/src/utils/Live2DPlayer/animation/`
- most of `sekai-viewer/src/utils/Live2DPlayer/action/`
- `sekai-viewer/src/utils/Live2DPlayer/types.d.ts`

They depend on Pixi, Howler, browser media, and the legacy scenario types, but
not on React rendering.

### Must be split or adapted

| Current location                                                                              | Coupling                                                                  | Required change                                                                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pages/storyreader-live2d/StoryReaderLive2DContent.tsx`                                       | React state/effects, MUI, i18next, snackbar, `rootStore`                  | Split load orchestration from page UI. Expose progress/state events from a loader service.          |
| `StoryReaderLive2DStage.tsx`                                                                  | `@pixi/react` `useApp`, `forwardRef`, `useEffect`                         | Replace with an imperative `Application` + canvas mount adapter.                                    |
| `StoryReaderLive2DCanvas.tsx`                                                                 | React state/effects, click handlers, autoplay effects, MUI overlays       | Move playback state and commands to a controller facade; render controls in the host.               |
| `utils/storyLoader.ts`                                                                        | `useCallback`, `useTranslation`, cached-data hooks, legacy utility barrel | Split pure URL/data functions from React hook wrappers.                                             |
| `action/talk.ts`, `action/special_effect/Telop.ts`, `action/special_effect/FullScreenText.ts` | Direct `rootStore` and `TranslationCache` imports                         | Inject a `TextResolver` for talk, telop, and full-screen text.                                      |
| `translation/LlmTranslationService.ts`                                                        | Direct `rootStore` access                                                 | Make API configuration and cache explicit dependencies; keep optional translation outside the core. |
| `load.ts`                                                                                     | `window`, `document`, `Image`, HTML video, Howler, Axios                  | Move browser media creation into an injected loader.                                                |
| `ui_assets.ts`                                                                                | Vite SVG imports and `import.meta.env` through URL helpers                | Provide UI asset URLs from the host or a package asset manifest.                                    |
| `utils/urls.ts`                                                                               | Vite environment variables                                                | Provide a region-aware `AssetResolver` interface.                                                   |

The `@pixi/react` dependency is only required by the legacy React page
wrappers — including the Live2D page that renders through
`StoryReaderLive2DStage` (`useApp`). Only the extracted framework-neutral
runtime can drop it; the wrappers keep it until they are retired.

## Target site: `media-lab-site`

### Confirmed starting point

`apps/media-lab-site` is a SvelteKit 2 / Svelte 5 app with a minimal home page.
It already uses `ViewerShell`, `RegionSwitcher`, Tailwind 4, daisyUI 5, and a
route transition shell, but it does not yet have story routes, server data
loads, an i18n layout, a Live2D host, or a scenario data adapter.

The target should follow the content-site conventions without importing code
from the `content-site` app. Shared behavior belongs in `packages/*`; app-only
route loaders and presentation components stay inside `media-lab-site`.

### Recommended route shape

Use path parameters for region and story identity, matching the content-site
pattern:

```text
apps/media-lab-site/src/routes/
  +layout.server.ts                         # locale and route namespaces
  +layout.svelte                            # ViewerShell and shared chrome
  +page.svelte                              # media lab landing page
  live2d/
    +page.svelte                            # Live2D tool/catalog landing page
    story-reader/
      [region]/
        [storyType]/
          [storyId]/
            +page.server.ts                  # metadata and normalized route data
            +page.svelte                     # header, stage, controls, settings
            +error.svelte
```

`storyType` should be a constrained union derived from the supported legacy
story loaders, not an unchecked string. The exact public URL can change during
Phase 0, but region must remain part of the route so that metadata, scenario,
voice, and Live2D assets use one explicit region context.

The page split should be:

| Responsibility                                                                                     | Location                                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Story metadata, route validation, region availability, SEO title                                   | `+page.server.ts`                                                       |
| ViewerShell, PageHeader-like presentation, region navigation, controls, settings, loading/error UI | `+page.svelte` and app-local components                                 |
| Pixi canvas, model layers, checkpoint playback, media lifecycle                                    | `@platform/live2d-story-player`                                         |
| Sekai master-data and asset-path mapping                                                           | `media-lab-site/src/lib/server` or a shared package, depending on reuse |

Use the content-site visual language (`ViewerShell`, semantic archive surfaces,
responsive `gap-4` layouts, and a detail-page header), but keep the player stage
as a dedicated black/immersive surface. The existing `RegionSwitcher` can stay
on the landing page; the playback route should derive its active region from
`[region]` and navigate between valid region URLs rather than maintaining a
second global primary/secondary selection.

### Target-side data and asset boundary

The current `@platform/sekai-master-api-sdk` exports card, event, character,
music, gacha, and virtual-live operations. A complete scenario/Live2D story
catalog and scenario-asset API was not found in its generated exports. This is
an explicit migration gate: do not make the new page depend on an assumed SDK
method.

Resolve this in Phase 0/2 by choosing one of the following and documenting the
decision in the adapter:

1. Add the required story contract to `sekai-master-api` and regenerate the
   SDK through the documented cross-repository workflow.
2. Add a media-lab server adapter for an existing raw master-data/scenario
   source, returning a stable normalized `StoryDocument`.
3. Use the SDK for catalog metadata and a separately configured scenario
   endpoint for the playback document, while keeping that endpoint out of the
   Pixi package.

The target asset resolver should reuse the confirmed remote-asset convention:
`PUBLIC_REMOTE_ASSET_BASE_URL` plus the `sekai-live2d-assets` bucket, with the
story region passed explicitly. `media-lab-site` must not import
`apps/content-site/src/lib/assets`; either create a local adapter first or
extract a genuinely shared URL builder into `packages/*`.

Keep heavy scenario media and model preloading browser-side. Server `load`
functions should resolve route metadata and a normalized playback descriptor;
they must not instantiate Pixi, Howler, `Image`, HTML video, or WebGL objects.

## Target architecture

Create a framework-neutral package,
`sekai-viewer-reborn/packages/live2d-story-player`, with these boundaries. The
package name is provisional until the dependency spike passes:

```text
live2d-story-player
  core/
    controller, checkpoint scheduler, action dispatch, layers, animations
  model/
    scenario types, model-data normalization, motion pruning
  adapters/
    asset resolver, media loader, audio/lip-sync adapter, logger, text resolver
  pixi/
    Pixi Application/canvas mount, resize, ticker initialization

media-lab-site
  src/lib/live2d/
    story-data.ts       # Sekai-specific StoryDocument adapter
    asset-resolver.ts   # region/bucket URL mapping
    player-host.svelte  # browser-only package mount
    story-reader-state.ts
```

`@platform/live2d-story-player` must not import Svelte, React, `ui-shell`, an
app's SDK client, or an application store. It should accept already-resolved
scenario/model/media data where possible. The media-lab adapter owns the Sekai
story URL rules, region behavior, i18n policy, and route-specific metadata.

If the first dependency spike shows that the runtime needs substantial
media-lab-only changes, keep the adapter in
`apps/media-lab-site/src/lib/live2d/` temporarily, but preserve the same
interfaces so it can move into `packages/*` without another architecture
rewrite.

### Proposed imperative API

Names are illustrative; the important property is that no API type mentions
React, MUI, or a global store. The lifecycle verbs used later in Phase 4 and
the acceptance checklist (`load`, `play`, `pause`, `reload`) are conceptual
shorthands over this surface — for example, `playUntilCheckpoint()` is the
checkpoint-scoped form of `play`.

```ts
const player = await createLive2DStoryPlayer({
  canvas,
  size: [width, height],
  controllerData,
  assets: assetAdapter,
  text: textResolver,
  audio: audioAdapter,
  onProgress,
  onWarning,
});

await player.loadInitialModels();
await player.playUntilCheckpoint();
player.abort();
player.resize(width, height);
player.setSettings(settings);
player.destroy();
```

The final API should also provide a state/event stream for `ready`, `loading`,
`loaded`, `playing`, `waiting`, `finished`, and `error`. Autoplay should be a
command or scheduler option, not a React effect that races with `playing` state.

### Dependency injection requirements

At minimum, inject:

- `resolveAsset(path, region, kind)` for MinIO/CDN URLs;
- `fetchJson`/`fetchBinary` or a model/media loader;
- `createImage`, `createVideo`, and `createSound` for browser media;
- `getTalkText(referenceIndex, originalText)` for translation/display policy;
- `logger` and warning reporting;
- UI asset URLs;
- optional audio/lip-sync implementation.

The core may still depend on Pixi and the custom Live2D package. “Framework
neutral” here means renderer-host neutral, not DOM-free or server-side renderable.

## Target-specific roadmap

### Phase 0 — Compatibility and dependency gate

Goal: know what can be migrated and what the reborn platform must provide.

- Select one representative story fixture for the first vertical slice, then
  add unit, card, area-talk, and special-story fixtures as coverage grows.
- Capture legacy screenshots/video for initial layout, talk/lip sync, model
  movement, BGM/SE, full-screen text, movie, wipes, filters, and finish state.
- Build an action/effect coverage table from real scenario data, including the
  currently unsupported values.
- Audit the generated master API SDK and the raw scenario source. Resolve the
  missing scenario/catalog contract before implementing a route loader.
- Run a browser-only compatibility spike with Pixi 7.4.3,
  `@sekai-world/pixi-live2d-display-mulmotion@0.5.1`, Howler, Vite 8, and the
  SvelteKit client build. Do not upgrade Pixi or the Live2D package yet.

Exit criteria: a written `StoryDocument` shape, a chosen data source, a proven
asset URL for one region, and a dependency decision that does not require SSR
to load browser-only libraries.

### Phase 1 — Bootstrap `media-lab-site` like `content-site`

Goal: make the empty target site capable of hosting a content/detail route
before adding the player.

- Add `+layout.server.ts` and route-aware i18n namespaces. Put new source
  strings under `packages/i18n-source/media-lab-site/`; remove the current
  hardcoded shell labels as part of this phase.
- Keep the existing `ViewerShell` and route transition behavior. Add an
  app-local header/sidebar vocabulary for Media Lab; do not copy the entire
  content-site layout or import another app's `$lib` files.
- Replace the placeholder region cards with a Live2D tool entry point and a
  story catalog/selector shell. Use region links that lead to real path-param
  URLs rather than hash-only cards.
- Establish the route tree
  `/live2d/story-reader/[region]/[storyType]/[storyId]`, with `+error.svelte`
  and a loading/error presentation consistent with content-site detail pages.
- Add `+page.server.ts` for route validation and metadata only. Keep the first
  page render useful when JavaScript is unavailable; the canvas is an enhanced
  browser feature.

Exit criteria: the target route renders a localized detail shell and a stable
loading/error state with no Pixi or Howler import during SSR.

### Phase 2 — Build the Sekai data and asset adapter

Goal: produce one normalized playback descriptor independent of React and Pixi.

- Split the legacy `storyLoader.ts` into pure scenario/asset functions and a
  `SekaiStoryDataSource`. The old React page can keep a compatibility wrapper
  while the new adapter is tested independently.
- Define a serializable `StoryDocument` containing story identity, scenario
  URL or payload, normalized media references, model references, region, and
  text/translation references. Keep browser factories out of this type.
- Resolve the data-source decision from Phase 0. If a new API contract is
  required, follow the workspace's OpenAPI → local SDK regeneration workflow;
  do not add an untyped fetch directly to `+page.svelte`.
- Implement the `live2d` asset bucket mapping using
  `PUBLIC_REMOTE_ASSET_BASE_URL`. Keep region and endpoint normalization in a
  media-lab adapter or a genuinely shared package, not in the player.
- Keep metadata in `+page.server.ts`. Load large scenario/model/media payloads
  through the browser-side adapter with progress and cancellation. Validate
  CORS for images, audio, video, and model files from the deployed origin.
- Make preprocessing clone input before adding synthetic initial background,
  BGM, and layout snippets; keep source data immutable across readers.

Exit criteria: one route can resolve a complete descriptor and asset list, and
the legacy React reader can consume the same pure adapter without regressions.

### Phase 3 — Extract the framework-neutral player package

Goal: move playback behavior, not page concerns, into
`@platform/live2d-story-player`.

- Move the controller, layers, animations, actions, types, model-data
  normalization, checkpoint scheduler, and motion pruning into the package.
- Replace imports of legacy types, `urls.ts`, `rootStore`, translation cache,
  and utility barrels with package types and injected adapters.
- Inject `AssetResolver`, `MediaLoader`, `AudioAdapter`, `TextResolver`,
  `Logger`, and progress/warning callbacks. The text resolver must cover talk,
  telop, and full-screen text.
- Preserve checkpoint semantics, effect order, six-model default queue,
  `ParamMouthOpenY` lip sync behavior, and cleanup behavior for the first
  release.
- Make `load`, `abort`, and `destroy` idempotent. Every failed preload must
  settle a terminal error state or event and release partially created
  resources; rendering that error stays in the React or Svelte host.
- Add non-WebGL tests for checkpoint grouping, model queue generation, motion
  pruning, action dispatch, volume mapping, and abort/cleanup behavior.
- Keep a thin React compatibility adapter only as a parity harness. It is not
  the migration destination and must not leak React types into the package.

Exit criteria: package checks pass and its dependency graph contains no React,
MUI, `react-i18next`, application store, or reborn app import.

### Phase 4 — Mount the player from a Svelte 5 route

Goal: complete the first `media-lab-site` vertical slice.

- In `+page.svelte`, receive route data through `$props`; use `$state` for
  player lifecycle and UI state, and `$effect` only for command synchronization
  with explicit cleanup.
- Dynamically import the browser-only player host from `onMount` or an
  equivalent client boundary. Do not construct Pixi, Howler, `Image`, video,
  or WebGL objects during SSR.
- Mount against a `<div bind:this={stageHost}>` and let the host create the
  canvas/application. Use `ResizeObserver` for sizing, preserve the 16:9 stage,
  and keep browser fullscreen controls in the page layer.
- Render player events as Svelte state: loading progress, ready, playing,
  waiting, finished, warning, and error. Commands should be explicit actions
  (`play`, `pause`/checkpoint step if supported, `abort`, `reload`, `destroy`),
  not effects racing against a boolean `playing` flag.
- Key or explicitly tear down the player when the route's story identity or
  region changes. Verify that route navigation releases Pixi, models, Howler
  sounds, videos, filters, and tickers.
- Build the page as a content-site-like detail layout: header/metadata rail,
  immersive stage card, controls/settings panel, progress/warnings, and related
  story links. Keep selector and presentation UI outside the player package.

Exit criteria: one real story plays in `media-lab-site` from a path-param route,
with localized controls, visible progress/errors, responsive resize, and clean
route navigation.

### Phase 5 — Expand coverage and reach parity

Goal: migrate behavior incrementally without turning the first route into a
second monolith.

- Add story selectors for unit, event, character, card, area-talk, and special
  stories only after each type has a data adapter and fixture.
- Add region availability and fallback handling at the route/data layer; never
  silently fall back to another region's scenario or voice asset.
- Add browser integration tests for one story per supported type, plus visual
  checks for model motion, transitions, movies, filters, telop, full-screen
  text, and responsive sizes.
- Add audio checks for voice volume, BGM cross-fade, SE loop/stop, and lip sync.
- Compare the legacy React page and media-lab output until representative parity
  is reached. Unsupported actions/effects remain explicit warnings.
- Keep the standalone legacy `live2d/Live2D.tsx` model showcase separate from
  the Story Reader migration; introduce a shared model loader only as a separate
  decision.

### Phase 6 — Release and maintain the boundary

- Run `pnpm --filter @apps/media-lab-site check`, lint, build, and browser tests;
  run package checks for `@platform/live2d-story-player` when it exists.
- Add a Changeset for implementation changes under the reborn monorepo; this
  documentation-only roadmap does not need one.
- Test repeated load, abort, route leave, reload, fullscreen, and low-memory
  model replacement in a production-like build.
- Confirm deployed asset CORS, cache behavior, and failure telemetry for the
  Live2D bucket.
- Only after parity is stable, consider a Pixi/runtime upgrade as a separate
  change with its own compatibility snapshots.

## Known risks and decisions

- **Scenario API gap:** the current reborn master SDK does not expose the full
  legacy scenario/story data surface. This is a delivery gate, not an
  implementation detail. Select an API or server-adapter strategy before the
  first playback route is coded.
- **SvelteKit SSR boundary:** Pixi, Howler, `Image`, HTML video, and WebGL are
  browser-only. Route `load` functions may return metadata and descriptors, but
  player construction must happen after hydration and must be disposable.
- **App boundary:** `media-lab-site` must not import `content-site` internals.
  Shared asset or data helpers need an explicit package boundary, otherwise
  keep the adapter local to media-lab.
- **Pixi/runtime compatibility:** `@sekai-world/pixi-live2d-display-mulmotion`
  declares Pixi 7 as its peer dependency. Keep one Pixi 7 instance during the
  extraction; do not mix a Pixi 8 host into the first migration.
- **Ticker ownership:** the current React wrapper obtains the Pixi application
  from `@pixi/react`, while model loading uses `Ticker.shared`. The extracted host
  must initialize extensions and ticker ownership once and test route remounts.
- **Audio internals:** lip sync currently reaches into Howler's private
  `_sounds[0]._node`. Hide this behind an adapter and decide whether to preserve
  the private-node implementation or replace it with a supported audio graph.
- **Resource lifecycle:** `reloadStage()` creates a new controller without first
  destroying the old one. The extracted API must destroy/abort the previous
  instance before replacement.
- **State mutation:** scenario preprocessing and motion pruning mutate data in
  place. Clone or document ownership before sharing data between text and Live2D
  readers.
- **Progress/error semantics:** media preload may return only successfully loaded
  assets, while model asset preload throws if any task fails. Normalize this into
  one explicit error policy in the new loader.
- **Volume semantics:** the current controller uses truthy checks, so setting a
  volume to zero is not equivalent to muting, and BGM volume is scaled during
  updates. Define absolute volume semantics in the new API and test them.
- **Unsupported actions:** preserve warnings and behavior for unsupported snippet
  and effect types until compatibility requirements decide otherwise.
- **Asset policy:** preserve region-aware scenario/voice rules and lowercase/path
  fallbacks in the Sekai adapter; do not embed those rules in Pixi layers.
- **Shared audio UI:** `@platform/ui-shell`'s `AudioPlayer` owns a normal HTML
  audio element and is suitable for page-level music playback, but it should
  not replace the Story Reader audio adapter, which coordinates voice, BGM, SE,
  and lip sync simultaneously.

## Acceptance checklist

- [ ] `media-lab-site` has a localized shell, route-aware i18n, and a
      content-site-like Live2D detail route.
- [ ] A documented data-source decision supplies a normalized `StoryDocument`;
      no assumed SDK endpoint or untyped page-side fetch remains.
- [ ] The old React Story Reader and compatibility adapter render the same
      representative stories as the extracted runtime.
- [ ] The extracted runtime has no React/Svelte/MUI/i18n/store imports.
- [ ] A host supplies a canvas, size, data, assets, text policy, and callbacks;
      no host-specific globals are read by the core.
- [ ] `load`, `play`, `abort`, `resize`, and `destroy` are deterministic and safe
      across remounts.
- [ ] Pixi/Howler/WebGL are created only in the browser and are released on
      Svelte route navigation.
- [ ] All supported action/effect types have parity tests; unsupported types are
      explicit.
- [ ] Voice playback, lip sync, BGM/SE behavior, model motion, filters, movies,
      transitions, and responsive sizing pass visual/audio checks.
- [ ] The package can be mounted by a non-React host without `@pixi/react`.
- [ ] `media-lab-site` passes check, lint, build, and browser validation with
      production asset URLs and CORS enabled.

## Source map

Legacy `sekai-viewer` paths are pinned to commit `0504bee6`. Reborn target
paths are repository-relative to this monorepo root.

- Page loading and UI: `sekai-viewer@0504bee6:src/pages/storyreader-live2d/`
- Runtime controller: `sekai-viewer@0504bee6:src/utils/Live2DPlayer/Live2DController.ts`
- Pixi root and layer ordering: `sekai-viewer@0504bee6:src/utils/Live2DPlayer/Live2DPlayer.ts`
- Model/audio layer: `sekai-viewer@0504bee6:src/utils/Live2DPlayer/layer/Live2D.ts`
- Scenario actions: `sekai-viewer@0504bee6:src/utils/Live2DPlayer/action/`
- Loading/preload: `sekai-viewer@0504bee6:src/utils/Live2DPlayer/load.ts`
- Scenario and asset URL resolution:
  `sekai-viewer@0504bee6:src/utils/storyLoader.ts`
- Scenario action/type contract: `sekai-viewer@0504bee6:src/story-scenerio.d.ts`
- Model JSON/motion URL normalization: `sekai-viewer@0504bee6:src/utils/live2dLoader.ts`
- Pixi/Live2D dependency versions: `sekai-viewer@0504bee6:package.json`
- Target app shell: `apps/media-lab-site/src/routes/`
- Target app manifest: `apps/media-lab-site/package.json`
- Target SvelteKit layout pattern: `apps/content-site/src/routes/+layout.server.ts`
- Target remote asset convention: `apps/content-site/src/lib/assets/index.ts`
- Target shared shell: `packages/ui-shell/src/`
- Target master API exports: `packages/sekai-master-api-sdk/src/index.ts`
- Target i18n source package: `packages/i18n-source/`
