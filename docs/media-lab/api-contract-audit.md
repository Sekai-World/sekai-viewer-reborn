# Media Lab API and Asset Contract Audit

Status: draft decision record for
[#256](https://github.com/Sekai-World/sekai-viewer-reborn/issues/256)
(roadmap Phase 0). Evidence is code- or resource-confirmed; open questions are
listed explicitly and must be resolved in the issues that consume this document.

## Evidence sources

- `sekai-master-api` repo and generated SDK in this monorepo
  (`packages/sekai-master-api-sdk/`).
- Current reborn asset conventions:
  `apps/content-site/src/lib/assets/index.ts`.
- Verified future-viewer associated Live2D catalog and representative resources:
  `https://storage.sekai.best/sekai-live2d-assets/live2d-associated/v1/model_list.json`.
- Extraction roadmap:
  `docs/viewer-implementation/live2d-story-reader-extraction-roadmap.md`
  (§Target-side data and asset boundary, §Phase 0, §Source map).
- Legacy scenario/asset URL rules, read-only from the workspace external
  reference `Moesekai/web/src/lib/storyAsset.ts`, `Moesekai/web/src/lib/assets.ts`,
  and `Moesekai/web/src/lib/storyLoader.ts`. The canonical pin remains
  `sekai-viewer@0504bee6`; Moesekai is used here because it is inspectable
  inside the workspace.

## Findings: sekai-master-api and SDK

What exists (public operations in `packages/sekai-master-api-sdk/src/sdk.gen.ts`):
`cards`, `events`, `gachas`, `musics`, `unitProfiles`, `gameCharacters`,
`gameCharacterUnits`, `character3ds` and `character2ds` (batch-only lookup
operations), `virtualLives`
(list/by-id/items/schedules/setlists), admin master-data endpoints,
`health`/`build-info`.

The typed `character2ds/{region}/batch` result is the effective identity source
for Live2D model associations: its `gameCharacterId` and `characterType` are
used before any catalog-provided identity. Ordinary `game_character` labels
come from `gameCharacters`. A `mob` label may be provided through
`mobCharacters.name` (surfaced by the Character2D result). A
`sub_game_character` label comes from `subGameCharacters.name` (the authoritative
table is `sekai-master-db-diff/subGameCharacters.json`; for example, `1` is
ハローキティ and `121` is 漣ジュン), not `mobCharacters`.
For either non-game type, when `displayName` is missing, the viewer uses
`assetName` and then `#<gameCharacterId>`. The viewer does not issue a separate
`mobCharacters` or `subGameCharacters` lookup.

What is missing for media-lab:

- **StoryReader / Live2D API**: no story/scenario catalog endpoints or scenario
  document endpoint exist in the SDK. The associated catalog supplies future
  viewer model/motion metadata outside `sekai-master-api`, but it does not
  supply scenario-to-model mapping. Nothing scenario-related exists in the
  `sekai-master-api` transport, storage, or usecase layers.
- **3D track**: `character3ds/{region}/batch` returns name-level lookup data
  only (`SharedCharacter3dBatchItem { gameCharacterId, id, name?, unit? }`,
  `types.gen.ts:148-158`). No model bundle manifests, animation bundles, or
  rig/compatibility metadata.
- Virtual live responses carry asset bundle _names_ (for example
  `assetbundleName`, `bgmAssetbundleName`), never URLs or manifests.

## Findings: asset URL conventions

Confirmed reborn convention (`apps/content-site/src/lib/assets/index.ts`):

- `getRemoteAssetBaseURL()` requires `PUBLIC_REMOTE_ASSET_BASE_URL`
  (`.env.example` dev default `/storage`).
- Bucket map (line 31-41): region buckets `sekai-{jp,en,tc,kr,cn}-assets`
  plus `live2d → sekai-live2d-assets`, `comic`, `musicChart`, `best`.
- Absolute URLs pass through unchanged (line 63-64).
- `media-lab-site` must not import `apps/content-site` internals; it needs a
  local adapter first, or a shared URL builder extracted into `packages/*`
  (roadmap line 239-241).

Confirmed legacy URL rules (Moesekai reference, read-only):

- Scenario JSON templates by story type
  (`storyAsset.ts:40-59`): `scenario/unitstory/{bundle}/{id}.json`,
  `event_story/{bundle}/scenario/{id}.json`,
  `character/member_scenario/{bundle}/{id}.json` (or `character/member/...`),
  `scenario/actionset/group{group}/{id}.json`,
  `scenario/profile/{id}.json`, `scenario/special/{bundle}/{id}.json`.
- Legacy scenario assets are served from **region buckets**
  (`assets.ts:37`: `{domain}/sekai-{region}-assets`).
- Media paths (`assets.ts:307-338`): backgrounds
  `scenario/background/{name}/{name}.webp`; voices
  `sound/scenario/voice/{scenarioId}/{voiceId}.mp3`,
  `sound/card_scenario/voice/...`, `sound/actionset/voice/...`;
  BGM `sound/scenario/bgm/{name}/{name}.mp3`; SE `sound/scenario/se/{name}.mp3`.
- `storyLoader.ts:188-209` selects the voice path by story type and falls back
  to `part_voice` paths using scenario `character2d` `assetName`/`unit`.

## Reborn asset rule and legacy comparison

The reborn roadmap is authoritative for the new implementation:
Live2D scenario/model assets use the `sekai-live2d-assets` bucket, with the
current Live2D product scope fixed to JP (`region: "jp"`) and passed explicitly
to the adapter. The bucket map in `apps/content-site/src/lib/assets/index.ts:31-41`
records the independent Live2D bucket convention; it must not be replaced with
the ordinary per-locale buckets.

The legacy reference uses region buckets (`{domain}/sekai-{region}-assets`) for
its scenario and story media paths. That is historical evidence for logical
object-path patterns only; it does not override the reborn bucket contract.
For future viewer model and motion discovery, the source of truth is the
associated catalog at
`https://storage.sekai.best/sekai-live2d-assets/live2d-associated/v1/model_list.json`.
The previously verified
`https://storage.sekai.best/sekai-live2d-assets/live2d/model_list.json`
endpoint remains prior evidence; it is not the future associated-catalog
contract.

The associated-catalog contract and deployment browser-loading guarantee now
complete the #268 verification scope. The broader story/playback data-adapter
work remains tracked by
[#258](https://github.com/Sekai-World/sekai-viewer-reborn/issues/258); the
associated-catalog adapter and its route/UI integration are now present.

## Verification result: #268

Verification now covers both the previously checked catalog and the future
associated catalog. The current product contract treats the entire
`sekai-live2d-assets` source as JP-only: the descriptor region is `jp`, while
`v1/main` and `v1/collabo` remain internal asset namespaces rather than locale
values. The evidence closes the catalog-association, region, and browser
asset-loading decisions.

### Previously verified catalog evidence

The earlier catalog source was
`https://storage.sekai.best/sekai-live2d-assets/live2d/model_list.json` (an S3
object, `application/json`). It remains prior verified evidence.

- Sample entry:
  `modelName=01ichika_cloth001_3.1_f_t01`,
  `modelBase=01ichika_cloth001`,
  `modelPath=v1/main/01_ichika/01ichika_cloth001`, and
  `modelFile=01ichika_cloth001_3.1_f_t01.model3.json`.
- Model descriptor:
  `https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/main/01_ichika/01ichika_cloth001/01ichika_cloth001_3.1_f_t01.model3.json`
  returns Live2D Version 3 JSON and references exactly one MOC, one PNG
  texture, and one physics file. The referenced objects return `200` with
  `application/octet-stream`, `image/png`, and `application/json`
  respectively.
- Motion metadata: the same prefix contains `motions/BuildMotionData.json`,
  which names `w-normal-posetrouble02`, `w-normal-tilthead01r`, and
  `w-normal-trouble02`. Each corresponding `.motion3.json` is present, valid
  Version 3 motion JSON, and returns `200` with `application/json`.
- No expression file is referenced by this `model3.json`, and no `.exp3.json`
  object was found in the sample prefix. The sample therefore proves a model
  with known motions and no verified expression set; it must not be presented
  as having expressions.

### Future associated catalog evidence

- The future viewer source of truth is
  `https://storage.sekai.best/sekai-live2d-assets/live2d-associated/v1/model_list.json`.
  It returns a JSON array. Each model record has positive-integer
  `characterId` and `character2dId` association fields, plus `modelBase`,
  `modelFile`, `modelName`, `modelPath`, and `motionSets`. `characterId` maps to
  a game character only as a fallback identity, while `character2dId`
  identifies the associated 2D model variant and the typed Character2D batch
  result determines the effective identity. One character can have multiple 2D
  model variants. The current response contains both fields on every record
  (239 records verified on 2026-09-09).
- Each `motionSets` entry has `motionSetId`, `motionPath`, `motionFiles`,
  `facialPath`, and `facialFiles`. The explicit grouped association removes
  the prior lack-of-motion/expression-metadata blocker for a catalog/resolver
  plan.
- `modelPath`, `motionPath`, and `facialPath` are bucket-relative paths, such
  as `model/v1/main/...` and `motion/v1/main/...`. A model URL is derived from
  the bucket root plus `modelPath` plus `modelFile`; motion URLs use the
  corresponding motion path and file. Resolution must remain safe and reject
  absolute or traversal paths.
- The first verified sample is `01ichika_normal_3.0_f_t04`. It resolves a
  model3/MOC3/PNG/physics bundle and body and facial `.motion3.json` files.
  The verified expression contract for this source is `facialFiles`: these are
  facial-motion resources played through the facial-motion runtime path. A
  separate Cubism `.exp3.json` asset is not required or expected.
- The current associated catalog exposes no voice or sound URL fields. Model
  voiceline playback is therefore not part of this slice.
- The source has no locale field. `region: "jp"` remains an explicit product
  convention for the whole independent Live2D bucket, not an inference from
  `v1/main`; no cross-region fallback is allowed.

### Browser CORS and deployment guarantee

Browser-shaped `GET` requests with an `Origin` header and CORS preflight
`OPTIONS` requests have public-resource CORS evidence: tested catalog, model,
MOC, texture, physics, and motion resources returned successful responses with
origin-specific access headers and an allowed GET method. This supports
anonymous public fetches. The deployed media-lab environment is additionally
covered by the product deployment guarantee for browser asset loading; a
separate public deployment-origin curl/browser transcript is not required for
this acceptance.

The legacy preview and test descriptors in the reborn viewer remain
intentionally synthetic and must not be promoted to production metadata. The
current `/live2d` route instead consumes the validated associated catalog and
lists its model metadata, while `/live2d/[modelId]` resolves a serializable
descriptor only after a successful catalog lookup and returns 404 for an
unknown model only in that ready state. Catalog unavailable/error results stay
explicit in the route data. Accordingly, #268 is complete: the current JP-only
region contract, associated-catalog model/motion/facial-motion sample, resource
evidence, deployment browser-loading guarantee, and documented sample are all
available. The standalone `/live2d/[modelId]` route has an SSR-safe Pixi/Cubism adapter with a
dedicated non-shared ticker, separate body/facial motion handling, lifecycle
cleanup, and model fit/resize. The production Cubism Core artifact is now
pinned and vendor-controlled at
`apps/media-lab-site/static/live2d/cubism-core/live2dcubismcore.min.js`, from
SDK 5-r.5, with SHA-256
`8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47`.
Redistribution approval and the SDK license terms must be maintained with
the artifact. Story Reader scenario-to-model mapping and player runtime remain
outside this issue's scope.

## Data-source strategy decision

For the first vertical slice, use a **split approach** (roadmap option 3):

1. Catalog metadata comes from the existing SDK where it already exists.
2. Future viewer Live2D model and motion metadata comes from the associated
   catalog and is fetched, validated, and normalized by a media-lab-owned
   server adapter. The adapter owns URL rules, region behavior, and catalog
   availability policy; the player package must not import them.
3. Scenario documents are fetched by a media-lab-owned data/asset adapter from
   the configured existing asset source and normalized into `StoryDocument`.
   The adapter owns URL rules, region behavior, and i18n policy; the player
   package must not import them.
4. Defer adding story catalog endpoints to `sekai-master-api` until #258 has
   proven which fields routes actually need. The `character3ds` and
   `character2ds` batch endpoints are precedents for adding lookups on demand.
   Activating this later follows the documented cross-repo workflow: change
   `sekai-master-api` →
   `mise run swagger` → `mise run dev` →
   `mise run update-sekai-master-api-sdk-local` →
   `pnpm --filter @platform/sekai-master-api-sdk check`.

Trade-offs: the split approach ships the first slice without speculative API
design and without loading large scenario payloads through `sekai-master-api`,
at the cost of a temporary media-lab-owned adapter layer. This layer consumes
the existing configured asset source; it does not create a new CDN, storage
mirror, or asset copy. If multiple consumers appear later, the adapter
interfaces are shaped to move into `packages/*` without an architecture
rewrite (roadmap line 277-281).

## Draft contracts

- `apps/media-lab-site/src/lib/live2d/story-document.ts` — draft
  `StoryDocument` for #258.
- `apps/media-lab-site/src/lib/asset-viewer/model-bundle-manifest.ts` —
  draft `ModelBundleManifest` for #262.

Both are type-only drafts. Do not build player or viewer code against them
before the consuming issues finalize the shapes.

## Open questions

1. CORS from the deployed origin: public catalog/resource CORS observations
   and the product deployment guarantee establish the browser asset-loading
   contract for #268. The concrete deployment hostname remains an operational
   configuration concern rather than an acceptance blocker.
2. Facial-motion runtime semantics: the associated catalog's `.motion3.json`
   facial files are the verified expression input for this source. No separate
   `.exp3.json` resource is expected.
3. Upstream availability of 3D compatibility metadata (skeleton paths, bone
   names, Avatar/Animator, BlendShape, Unity version, source bundles): the
   asset pipeline is not in this workspace; #262 must confirm before the
   manifest leaves draft.
4. `IScenarioData`'s full action/effect surface remains defined by the legacy
   pin (`sekai-viewer@0504bee6:src/story-scenerio.d.ts`); the coverage table
   from real scenario data is #258/#259 work.

## Acceptance criteria mapping (issue #256)

- Gap analysis document — this file.
- Data-source strategy decision with trade-offs — §Data-source strategy.
- `StoryDocument` / `ModelBundleManifest` draft interfaces — §Draft contracts.
- Cross-repo workflow steps — §Data-source strategy decision, item 4.
- Region/asset URL assumptions backed by a confirmed sample or explicit
  blocker — §Reborn asset rule and legacy comparison plus §Verification result:
  #268 and §Open questions 1 (associated-catalog/resource/CORS evidence is
  recorded; current JP-only scope is explicit; deployed-origin verification
  remains explicit).
