# Model Bundle Manifest (issue #262)

The asset contract for the media-lab 3D Asset/Animation Lab: which files the
asset pipeline publishes for a Unity model or animation bundle, and the two JSON
files that describe them. The pipeline (`sekai-assets-updater`) writes the
files; media-lab reads and validates them. This document defines no rendering,
playback, or viewer UI.

- Types and validation:
  `apps/media-lab-site/src/lib/asset-viewer/model-bundle-manifest.ts`
- Tests: `apps/media-lab-site/src/lib/asset-viewer/model-bundle-manifest.test.ts`
- Earlier audit: [`api-contract-audit.md`](api-contract-audit.md) (issue #256)

## Status

Schema version 1 is final for the fields below. **No manifest or index is
published yet**: the pipeline has to be changed to write them (see
_What the pipeline has to do_). #263 can be built against this contract and its
fixtures, and verified on real data only after that change and a new export.

Owner decisions, 2026-11-15:

- The 3D output in the JP bucket is a one-off run of 2026-08-31. It is not
  updated with the game.
- Other regions will export, at most, models that only that region has. None
  exists today.
- The viewer reads the FBX export directly while that is good enough. The
  pipeline's GLB code stays unused; this contract has no derived GLB field.
  This replaces the earlier plan to treat FBX as an ingestion format only.
- The pipeline generates the manifest and the index.

## Published layout

Surveyed on 2026-11-15 in the JP bucket
(`https://storage.sekai.best/sekai-jp-assets/`) by bucket listing and by reading
sample files, and in the pipeline source (`sekai-assets-updater` at `539a2f7`).
It is a sample, not a count: how many bundles have a model export is not known.
A failed export is logged by the pipeline and leaves nothing in the bucket
(`updater/extract/sync_worker.py:124-128`).

Every bundle keeps its own directory, named after the bundle. A model bundle
gets an `fbx/` directory next to the ordinary per-object extraction:

```text
live_pv/model/characterv2/body/01/0001/ladies_m/
  body.prefab                       GameObject, type tree JSON, about 310 B
  guitar_body.prefab
  sit_body.prefab
  fbx/model.fbx                     ASCII FBX 7.4, 4,346,850 B
  fbx/mdl_bdy_kei_a_00.fbx          Avatar, type tree JSON (not an FBX), 139 KB
  fbx/materials/mtl_bdy_00.mat      Material, type tree JSON
  fbx/tex_bdy_KEI_A_00_{C,H,S}.png  textures the FBX references
  sourceimages/tex_bdy_kei_a_00_{c,h,s}.{png,webp}   ordinary texture export
```

- The model export is always `fbx/model.fbx`
  (`updater/extract/sync_worker.py:90-98`). It is one bundle's meshes and
  skeleton; the pipeline does not assemble a character from its bundles. It is
  written only when the pipeline runs with `ENABLE_MODEL3D_FBX_EXPORT` and the
  bundle has a mesh.
- Another file in `fbx/` can end in `.fbx` and be JSON. Objects are saved
  under their Unity container path, and here that path ends in `.fbx`; in the
  sample the object saved there is the Avatar. Which object lands on such a
  path depends on the bundle, so it must be told from the object's type, never
  from the extension. Discovery must never glob for `*.fbx`.
- Textures exist twice. `fbx/*.png` keeps the names the FBX references. The
  ordinary texture export writes the same images under their container paths,
  which are lowercase and in a `sourceimage` or `sourceimages` directory. Only
  the first set is part of this contract.
- Objects with no dedicated handler (AnimationClip, Avatar, Material,
  GameObject, among others) are dumped as Unity type tree JSON under their
  container file name; meshes and cubemaps are skipped
  (`updater/extract/unity_objects.py:167-181,239-242`).

An animation bundle has no `fbx/` directory, only its clips:

```text
model3d/motion/common/default/
  blink.anim                        AnimationClip, type tree JSON, 12,891 B
  breath_loop.anim
  lipsync_{a,e,n,o,u}_01.anim
model3d/motion/result/<nn>/
  face.anim  face_loop.anim  motion.anim  motion_loop.anim   30 to 775 KB
```

Where things are:

| Prefix                                                                  | Content                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| `live_pv/model/characterv2/{body,face,head_optional,color_variation}/`  | Character parts, one bundle each.               |
| `live_pv/model/{character,stage,stage_decoration,penlight,music_item}/` | Older character models and live props.          |
| `model3d/model/stage_object/`                                           | Stage objects only; no characters.              |
| `model3d/motion/{common/default,result/<nn>}/`                          | Shared face and lip-sync clips, result motions. |

Dance and music-video motion (`live_pv/timeline`, `live_pv/mv_data`,
`virtual_live/…`) was not surveyed.

Files are served with CORS for any origin and support range requests; the
content type is `application/octet-stream`.

## The two files

Paths are relative, use `/`, and have no `.`, `..`, empty segment, or
backslash. A file path is relative to its bundle directory; a bundle path is
relative to the region's bucket. A path also has no `%`, `?`, `#`, or control
character, and no segment starts or ends with a space, so a URL built from it
cannot leave the bundle. Readers ignore fields they do not know, so the
pipeline may add fields without a new version. Removing or changing the meaning
of a field needs `schemaVersion` 2 and a new index path (`…/v2/…`).

A file that fails validation is refused as a whole, the index included: the
pipeline writes these files, so a bad entry is a fault to fix there, and a
viewer that skipped it would hide the fault.

### Bundle manifest: `<bundlePath>/fbx/manifest.json`

Written next to the model export, one per model bundle.

| Field           | Required | Meaning                                                                                 |
| --------------- | -------- | --------------------------------------------------------------------------------------- |
| `schemaVersion` | yes      | `1`.                                                                                    |
| `region`        | yes      | `jp`, `en`, `tw`, `kr`, or `cn`.                                                        |
| `bundlePath`    | yes      | The bundle directory. It is also the source bundle name.                                |
| `model`         | yes      | `{ "path": "fbx/model.fbx", "format": "fbx-ascii" }`. No other path or format is valid. |
| `textures`      | yes      | PNG files directly in `fbx/`. May be empty.                                             |
| `avatars`       | yes      | `{ path, format: "unity-typetree-json" }` for each Avatar. May be empty.                |
| `materials`     | yes      | The same shape, for each Material.                                                      |
| `prefabs`       | yes      | The same shape, for each GameObject file.                                               |
| `rig`           | no       | `boneNames` and `blendShapeNames`; both when present. See _Rig and compatibility_.      |
| `source`        | no       | `unityVersion` and `dependencies` (bundle names), each optional.                        |

A path appears once in a manifest: one file has one role.

Example (the files of the bundle above; the `rig` and `source` values are
illustrative, not read from the bundle):

```json
{
  "schemaVersion": 1,
  "region": "jp",
  "bundlePath": "live_pv/model/characterv2/body/01/0001/ladies_m",
  "model": { "path": "fbx/model.fbx", "format": "fbx-ascii" },
  "textures": [
    "fbx/tex_bdy_KEI_A_00_C.png",
    "fbx/tex_bdy_KEI_A_00_H.png",
    "fbx/tex_bdy_KEI_A_00_S.png"
  ],
  "avatars": [{ "path": "fbx/mdl_bdy_kei_a_00.fbx", "format": "unity-typetree-json" }],
  "materials": [{ "path": "fbx/materials/mtl_bdy_00.mat", "format": "unity-typetree-json" }],
  "prefabs": [
    { "path": "body.prefab", "format": "unity-typetree-json" },
    { "path": "guitar_body.prefab", "format": "unity-typetree-json" },
    { "path": "sit_body.prefab", "format": "unity-typetree-json" }
  ],
  "rig": { "boneNames": ["Position", "Hip", "Waist"], "blendShapeNames": [] },
  "source": {
    "unityVersion": "2022.3.21f1",
    "dependencies": ["live_pv/model/characterv2/shader"]
  }
}
```

### Region index: `model3d-manifest/v1/index.json`

One per region bucket. It is the only way to discover bundles; a viewer does
not list the bucket.

| Field           | Required | Meaning                                                                                 |
| --------------- | -------- | --------------------------------------------------------------------------------------- |
| `schemaVersion` | yes      | `1`.                                                                                    |
| `region`        | yes      | As above.                                                                               |
| `generatedAt`   | yes      | ISO 8601 UTC timestamp, for example `2026-11-15T00:00:00Z`.                             |
| `models`        | yes      | `{ bundlePath }` for every bundle that has a manifest. May be empty.                    |
| `animations`    | yes      | `{ bundlePath, clips }` for every animation bundle; `clips` is not empty. May be empty. |

A clip is `{ name, path, format: "unity-typetree-json" }`. Clips are told apart
by `path`; two clips may share a name. Animation bundles are listed here in full
because they have no `fbx/` directory to hold a manifest. A bundle that holds
both a model and clips is listed under both.

```json
{
  "schemaVersion": 1,
  "region": "jp",
  "generatedAt": "2026-11-15T00:00:00Z",
  "models": [{ "bundlePath": "live_pv/model/characterv2/body/01/0001/ladies_m" }],
  "animations": [
    {
      "bundlePath": "model3d/motion/common/default",
      "clips": [
        { "name": "blink", "path": "blink.anim", "format": "unity-typetree-json" },
        { "name": "breath_loop", "path": "breath_loop.anim", "format": "unity-typetree-json" }
      ]
    }
  ]
}
```

## Rig and compatibility

Models, textures, clips, rig facts, and source dependencies are separate
entries. A clip never names a model and a model never names a clip.

- **Skeleton**: the Avatar file. Its `m_TOS` table maps a 32-bit hash to a full
  transform path (126 entries in the body sample). The manifest does not repeat
  it.
- **`rig.boneNames`**: the bones the meshes are skinned to. The body sample's
  FBX has 468 limb nodes.
- **`rig.blendShapeNames`**: BlendShape channels of the meshes. A face sample
  has 85 (`look_up`, `mouth_a`, …); a body has none.
- **Clips**: a clip's bindings (`genericBindings`) hold transform path hashes
  and attributes, never names. The index records nothing about them.

Whether a clip fits a model is decided by inspecting the clip's bindings against
the model's Avatar and names. It is never inferred from a character number, a
directory, or a file name. How the hashes are matched is #264's work and is not
asserted here.

`rig` saves reading a multi-megabyte FBX to list names. When it is absent the
names are read from the model.

A character is several bundles (body, face, and optionally `head_optional` and
`color_variation`). This contract describes bundles only. Putting a character
together belongs to #263.

### Not in version 1

Each can be added later as an optional field without a new version:

- Per-clip binding summaries. If #264 needs them, they go in a per-bundle file,
  not inline in the index.
- A size or content hash per file. Today the only cache key is the index's
  `generatedAt`, which is enough for a one-off export.
- Summary fields on `models` entries, so that a list needs no manifest fetch
  per model.
- The ordinary texture export (`sourceimage(s)/`).

The index lists every clip inline. The surveyed motion is small; dance and
music-video motion was not surveyed and may be large enough to need the index
split, which would be version 2.

## Known, unsupported, to be confirmed

| Item                                     | State                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Per-bundle directory, model path         | Known: observed and in the pipeline source.                                                |
| Textures, Avatar, Material, prefab files | Known: observed in the samples.                                                            |
| Clip format                              | Known: Unity AnimationClip type tree JSON with hashed bindings. Not FBX or glTF animation. |
| Skeleton paths                           | Known: in the Avatar file's `m_TOS`.                                                       |
| Bone and BlendShape names                | Known to exist in the FBX. In the manifest only once the pipeline writes `rig`.            |
| Unity version, dependencies              | Not in any published file. In the manifest only once the pipeline writes `source`.         |
| An Avatar file for every model bundle    | To be confirmed: seen in the sample; which object a container path holds varies by bundle. |
| Animator and AnimatorController          | Unsupported: none is published, and the prefab JSON holds component IDs only.              |
| glTF or GLB                              | Unsupported: nothing is published and the pipeline's GLB code is unused.                   |
| Assembled characters                     | Unsupported in the contract; see above.                                                    |
| Regions other than JP                    | Unsupported today: EN has no output; TW, KR, and CN were not checked.                      |
| Dance and music-video motion             | To be confirmed: not surveyed.                                                             |
| Share of bundles with a model export     | To be confirmed: not counted, and failed exports leave no trace.                           |
| FBX loading in a browser runtime         | To be confirmed in #263: skin weights and BlendShapes were counted, not loaded.            |

## What the pipeline has to do

Nothing below exists in `sekai-assets-updater` yet. Items 1 and 3 are the
contract; item 2 is optional and is the larger piece of work.

1. **Bundle manifest.** When the model export of a bundle succeeds, write
   `fbx/manifest.json` in the bundle directory with the required fields. List
   only files that were written, and sort each file into `avatars`,
   `materials`, or `prefabs` by the Unity object type saved there, never by
   extension.
2. **`rig` and `source` (optional).** The model export step does not have
   these today: it returns the FBX and its textures only, and no Python code on
   that path reads the Avatar or the meshes.
   - `rig` needs the bone and BlendShape names from the exporter, or from
     parsing the ASCII FBX (limb nodes, BlendShape channels).
   - `source.unityVersion` is a worker setting that is not passed to the export
     step and may be unset (auto-detect).
   - `source.dependencies` should be in the bundle's asset-bundle-info record.
   - Leave a field out when it is not known. Never write a guessed value.
3. **Region index.** Write `model3d-manifest/v1/index.json` to the region's
   bucket: every bundle with a manifest under `models`, and every bundle that
   holds AnimationClip objects under `animations` with its clips. A run only
   processes changed bundles and removes its local output after upload, so the
   index cannot be built from one run's output. It has to be rebuilt from kept
   state or from a bucket listing.
4. **Names stay.** Keep file names and directories as they are today.
5. **Existing JP output.** The 2026-08-31 output has no manifests. Either the
   export runs again, or a one-time task writes manifests and the index for
   what is in the bucket. This is the owner's decision and is open.

A manifest or index can be checked with `parseModelBundleManifest` and
`parseModelBundleIndex`, which return every problem found.

## Acceptance criteria (issue #262)

- Versioning, required and optional fields, examples: _The two files_.
- TypeScript interfaces with validation tests: the two files named at the top.
- Per-bundle directory structure preserved: `bundlePath` plus bundle-relative
  paths; the model path is fixed.
- Models, textures, clips, rig facts, and dependencies represented separately:
  _Rig and compatibility_.
- Known, unsupported, and to be confirmed: the table above.
