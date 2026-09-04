# Media Lab API and Asset Contract Audit

Status: draft decision record for
[#256](https://github.com/Sekai-World/sekai-viewer-reborn/issues/256)
(roadmap Phase 0). Evidence is code-confirmed; open questions are listed
explicitly and must be resolved in the issues that consume this document.

## Evidence sources

- `sekai-master-api` repo and generated SDK in this monorepo
  (`packages/sekai-master-api-sdk/`).
- Current reborn asset conventions:
  `apps/content-site/src/lib/assets/index.ts`.
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
`gameCharacterUnits`, `character3ds` (batch only), `virtualLives`
(list/by-id/items/schedules/setlists), admin master-data endpoints,
`health`/`build-info`.

What is missing for media-lab:

- **StoryReader**: no story/scenario catalog endpoints, no scenario document
  endpoint, no Live2D model metadata. Nothing scenario-related exists in
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
The remaining verification is tracked by
[#268](https://github.com/Sekai-World/sekai-viewer-reborn/issues/268): pin one
real `sekai-live2d-assets` URL, confirm the JP-only asset scope, and verify that
a deployed media-lab origin has the required CORS access. The adapter
implementation remains tracked by
[#258](https://github.com/Sekai-World/sekai-viewer-reborn/issues/258).

## Verification result: #268

The public asset source now provides a concrete catalog entry and a complete
base model bundle. The current product contract treats the entire
`sekai-live2d-assets` source as JP-only: the descriptor region is `jp`, while
`v1/main` and `v1/collabo` remain internal asset namespaces rather than locale
values. The evidence closes the current region decision, but not deployed-origin
browser verification:

- Catalog source: `https://storage.sekai.best/sekai-live2d-assets/live2d/model_list.json`
  (an S3 object, `application/json`). The entry for the sample is:
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
- The catalog's `v1/main` segment is an internal asset namespace (`main`,
  alongside `collabo` and `sub`), not a locale path. Under the current
  JP-only product contract, the resolved descriptor uses `region: "jp"` for
  this bucket and for its collabo models; no `main → jp` URL inference or
  cross-region fallback is performed. Supporting other Live2D regions later
  requires separate product and asset-source confirmation.
- Browser-shaped `GET` requests with an `Origin` header and CORS preflight
  `OPTIONS` requests returned `200`, an origin-specific
  `Access-Control-Allow-Origin`, `Vary: Origin`, an allowed GET method, and no
  `Access-Control-Allow-Credentials` for the catalog, model, MOC, texture,
  physics, motion metadata, and motion files. This supports anonymous public
  fetches. It is not yet deployed-origin proof: `media-lab.example.com` is the
  Helm placeholder host, and `media-lab.sekai.best` was not DNS-resolvable in
  this environment, so neither can be claimed as the actual running
  media-lab deployment.

The preview catalog and test descriptors in the reborn viewer remain
intentionally synthetic; they must not be promoted to production metadata.
Accordingly, #268 is partially unblocked: the current JP-only region contract,
catalog-backed model sample, resource evidence, and documented sample are now
available. It remains blocked for a production resolver or fixture until the
actual deployed origin is confirmed for browser CORS. No resolver, production
fixture, Pixi/Cubism dependency, or guessed URL was added.

## Data-source strategy decision

For the first vertical slice, use a **split approach** (roadmap option 3):

1. Catalog metadata comes from the existing SDK where it already exists.
2. Scenario documents are fetched by a media-lab-owned data/asset adapter from
   the configured existing asset source and normalized into `StoryDocument`.
   The adapter owns URL rules, region behavior, and i18n policy; the player
   package must not import them.
3. Defer adding story catalog endpoints to `sekai-master-api` until #258 has
   proven which fields routes actually need. The `character3ds` batch endpoint
   is the precedent for adding lookups on demand. Activating this later
   follows the documented cross-repo workflow: change `sekai-master-api` →
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

1. CORS from the deployed origin: #268 now has a catalog-backed model sample,
   a confirmed current JP-only product contract, and resource-level
   CORS/content-type observations. The actual media-lab deployment origin
   remains unconfirmed: `media-lab.example.com` is only a Helm placeholder and
   `media-lab.sekai.best` was not DNS-resolvable in the verification
   environment. #268 must confirm the running origin before the production
   adapter freezes.
2. Upstream availability of 3D compatibility metadata (skeleton paths, bone
   names, Avatar/Animator, BlendShape, Unity version, source bundles): the
   asset pipeline is not in this workspace; #262 must confirm before the
   manifest leaves draft.
3. `IScenarioData`'s full action/effect surface remains defined by the legacy
   pin (`sekai-viewer@0504bee6:src/story-scenerio.d.ts`); the coverage table
   from real scenario data is #258/#259 work.

## Acceptance criteria mapping (issue #256)

- Gap analysis document — this file.
- Data-source strategy decision with trade-offs — §Data-source strategy.
- `StoryDocument` / `ModelBundleManifest` draft interfaces — §Draft contracts.
- Cross-repo workflow steps — §Data-source strategy decision, item 3.
- Region/asset URL assumptions backed by a confirmed sample or explicit
  blocker — §Reborn asset rule and legacy comparison plus §Verification result:
  #268 and §Open questions 1 (catalog/resource/CORS evidence is recorded;
  current JP-only scope is explicit; deployed-origin verification remains
  explicit).
