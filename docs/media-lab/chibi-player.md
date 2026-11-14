# Media Lab Chibi Player

Runtime and asset descriptor for Chibi (SD) models in `media-lab-site`
(issue #621). There is no user-facing route yet; that is issue #622.

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

## Developer preview

`/dev/chibi` shows one model from each family. It exists only in the dev
server and returns 404 in production builds.

The asset host rejects requests whose `Referer` is a `localhost` origin, so
open the preview through `127.0.0.1` and start the dev server with
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
