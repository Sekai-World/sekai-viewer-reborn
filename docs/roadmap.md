# Roadmap

This document tracks the high-level direction of the multi-site viewer platform.
Statuses are intentionally explicit and **no dates or delivery promises are implied**.

Status legend:

- **Available** — shipped and usable in the current codebase.
- **In progress** — actively being built in the current development branch.
- **Planned** — scoped next priorities, not yet started on the frontend.
- **Exploratory** — later candidate ideas, not committed scope.

## Platform / Four-Site Architecture

The workspace is a monorepo of four deployable SvelteKit apps. Only
`content-site` carries real feature coverage today; the other three are
scaffolded placeholders and are **not** feature-complete.

| App              | Status      | Notes                                   |
| ---------------- | ----------- | --------------------------------------- |
| `content-site`   | Available   | Primary game-data browser (see below).  |
| `tools-site`     | Exploratory | Scaffold only; no feature work started. |
| `media-lab-site` | Exploratory | Scaffold only; no feature work started. |
| `account-site`   | Exploratory | Scaffold only; no feature work started. |

## content-site — Content Catalogue

### Available

Catalogue (list + detail) coverage already shipped for:

- **Cards** — list (`/cards/[region]`), detail (`/card/[region]/[id]`).
- **Musics** — list (`/musics/[region]`), detail (`/music/[region]/[id]`).
- **Events** — list (`/events/[region]`), detail (`/event/[region]/[id]`).
- **Gachas** — list (`/gachas/[region]`), detail (`/gacha/[region]/[id]`).
- **Virtual Lives** — list (`/virtual-lives/[region]`), detail (`/virtual-live/[region]/[id]`).

These read from the public `sekai-master-api` contracts and serve all supported
regions with localized labels.

### Available — Content Center Phase One

Content Center Phase One merged to `main` in PR #81. The catalogue and detail
routes use the public `sekai-master-api` contracts and generated SDK:

- **Character catalogue** — region-aware character list (`/characters/[region]`)
  with unit filtering, search, and a result count, plus a character detail page
  (`/character/[region]/[id]`) showing profile, unit, height, and sequence
  metadata. Both list/unit list requests use paginated aggregation
  (`aggregateGameCharactersByRegion` / `aggregateGameCharacterUnitsByRegion` in
  `apps/content-site/src/lib/server/character-pages.ts`) requesting `page_size:
100`, following `pagination.has_next` / `total_pages`, capped at 20 pages, and
  deduplicating overlapping results — so the full current catalogue loads without
  the earlier truncation.
- **Character-to-card discovery** — the character detail page links to a cards
  list filtered by the character ID, so related cards are one navigation away.
- **Cross-links into character profiles** — three reliable entry points now link
  to `/character/[region]/[id]` when a positive `gameCharacterId` is present:
  card detail character identity, event detail banner character, and music detail
  vocal characters. These are linked only when the source payload carries a
  confirmed positive `gameCharacterId`.
- **Virtual Live detail expansion** — detail pages now provide date-grouped,
  keyboard-accessible schedules; enriched character profile links; typed
  additional data; setlist music previews; and on-demand MC Timeline details.
  Modern `mc_timeline` playable assets and legacy `mc` scenario assets are both
  parsed server-side. Timeline 3D IDs are resolved through the public
  Character3D batch contract before avatars/profile links are shown.
- **Virtual Live rewards** — expanded `virtual_live_reward` boxes render their
  concrete item quantities. Resource boxes are resolved in the current content
  region only; unavailable boxes remain absent rather than falling back across
  regions.
- **Homepage database directory** — the homepage now exposes a database
  directory entry that links to the character catalogue; the sidebar adds a
  Characters entry for discovery.

### Planned — Next Content Priorities

Requested by the user and **not yet viewer-ready**. Each requires the full
cross-repo pipeline before frontend work can begin:

1. `sekai-master-api` must expose the relevant public contracts (or extend
   existing ones).
2. Regenerate the Swagger/OpenAPI spec (`mise run swagger`).
3. Restart the local `sekai-master-api` dev server (`mise run dev`).
4. Regenerate the viewer SDK
   (`mise run update-sekai-master-api-sdk-local`) and validate
   (`pnpm --filter @platform/sekai-master-api-sdk check`).

Specific next priorities:

- **Costumes / Decorations**
- **Degrees / Titles**
- **Missions / Rewards**

Until the corresponding public API contracts exist and the SDK is regenerated,
these remain **Planned** and should not be implemented on the frontend.

### Exploratory — Later Candidates

Broader game content such as **Stories** and **MySekai** are considered later
candidates only. They are not part of the committed current scope and have no
timeline.

## Cross-Repo Dependency Note

Frontend content work depends on `sekai-master-api` (separate repository). Any
content item that lacks a public, SDK-generated contract cannot be built on the
viewer side. See `AGENTS.md` (Cross-Repository Integration) for the full
contract → SDK regeneration workflow.
