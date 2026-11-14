# Media Lab Chibi Player

Runtime, asset descriptor and viewer routes for Chibi (SD) models in
`media-lab-site` (issues #621 and #622).

Asset facts (families, paths, which models exist) live in the workspace
knowledge base: `docs/game-data-knowledge/assets.md`, "Chibi（SD 小人）资源".

## Code

All under `apps/media-lab-site/src/lib/chibi/`:

- `chibi-model.ts` — `resolveChibiModelDescriptor(name)` maps a
  `costume2ds.spineAssetbundleName` to its atlas, texture and skeleton URLs.
  JP only. A name outside the three known families is `invalid`; no path is
  guessed.
- `chibi-player.ts` — `createChibiPlayer(runtime).load(descriptor, host, signal)`
  returns a resource with `animations`, `setAnimation`, `resize` and `destroy`.
  It has no browser imports; the runtime is injected.
- `chibi-catalog.ts` — catalog types shared by the server and the pages, and
  the labels derived from asset names.
- `chibi-spine-runtime.ts` — the browser runtime: `pixi.js` 7 and
  `@esotericsoftware/spine-pixi` 4.1, both imported lazily.

Behavior worth knowing:

- The skeletons are Spine `4.1.23` binary files, so the runtime must stay on
  the 4.1 line. `.skel` loads correctly (the legacy comment saying otherwise
  is wrong).
- Each family shares one skeleton of 2–3 MB. A player downloads it once and
  reuses the bytes for every model of that family.
- The atlas must name exactly one texture page, `sekai_atlas.png`; anything
  else is an error.
- Texture alpha follows the atlas: `pma:true` (main and v2 families) is
  uploaded as-is, an atlas without it (mob family) is premultiplied by Pixi.

## Routes (issue #622)

- `/chibi` — the catalog. `src/lib/server/chibi-catalog.ts` reads every page
  of `GET /costume2ds/jp/list?has_spine=true`, lists each asset name once and
  groups models by game character through the Character2D lookup that Live2D
  already uses. Models of mob and other non-playable characters share the
  "Others" tab. The loader streams the catalog; a failed character lookup
  still lists the models, ungrouped.
- `/chibi/[modelName]` — the viewer. The descriptor comes from the name alone,
  so the page does not call the master API. A name outside the known families
  is a 404. A well-formed name whose atlas the asset host answers with 404 is
  shown as "not available" (`ChibiAssetLoadError.status`); any other failure
  offers a retry.

Master data has no display names for Chibi costumes, so labels are derived
from the asset name (`describeChibiModelName` in `chibi-catalog.ts`).

The e2e suite covers the catalog states and the viewer's failure states. It
does not play a model: game skeleton files cannot be committed as fixtures.
Check playback by hand against the dev API.

## Local preview

The asset host rejects requests whose `Referer` is a `localhost` origin, so
open the site through `127.0.0.1` and start the dev server with
`--host 127.0.0.1`:

```bash
pnpm --filter @apps/media-lab-site exec vite dev --port 4103 --host 127.0.0.1
```

## Spine Runtimes license (decided 2026-11-12)

The Spine Runtimes may be integrated only by a holder of a Spine Editor
license (Spine Runtimes License Agreement, and Section 2 of the Spine Editor
License Agreement). The repository owner confirmed on 2026-11-12 that
Sekai-World holds a Spine Editor license, so the dependency is allowed.

Keep the license valid for as long as the runtime ships. The license text is
in the header of every file of the `@esotericsoftware/spine-pixi` package.
