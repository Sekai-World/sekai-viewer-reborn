# sekai-master-api SDK consumer patterns

Consumer-side implementation patterns for `@platform/sekai-master-api-sdk` in
this monorepo. The cross-repo regeneration workflow lives in the workspace
`docs/cross-repository/sdk-integration.md`.

## Lazy client-triggered master-data reads

When a detail page needs a large master-data scan only for an optional dialog or
panel, keep the initial `+page.server.ts` payload limited to data needed for the
page shell. Add a same-origin `+server.ts` route that reads the private
`SEKAI_MASTER_API_BASE_URL`, calls the generated SDK, and returns the small DTO
needed by the client. The client component should open its dialog immediately,
guard the first request with a cached promise/state transition, and reuse the
result on later opens. This keeps private server configuration out of the browser
and prevents streamed page promises from starting expensive work before the user
asks for it.

For probability/detail panels that need a large metadata scan, the same-origin
route should also normalize the upstream response into a bounded DTO. The gacha
probability panel loads card metadata only on first open, caches the successful
result, and uses the generated SDK operation for the rate-choice configuration
endpoint. Rate-choice responses provide group/segment selection counts, while
card membership must come from explicit gacha wish details; do not infer slots
from array order. Source: `apps/content-site/src/lib/server/gacha-probability.ts`
and `apps/content-site/src/lib/components/gacha/GachaProbabilityDetailsDialog.svelte`.

For gacha probability metadata, use `GET /api/v1/cards/{region}/batch?ids=...`
after regenerating the SDK rather than scanning card list pages. The endpoint
accepts at most 100 positive integer IDs, omits missing records, and returns
only `id`, `prefix`, `assetbundleName`, `attr`, and `rarityType` in first-seen
request order. Source: `sekai-master-api/internal/transport/http/handlers/cards/card_handler.go`.

## Virtual Live route / filter / loader composition

`content-site` consumes Virtual Live through `@platform/sekai-master-api-sdk`
generated operations. Composition pattern (verified in `apps/content-site/src`):

- **List route** `routes/virtual-lives/[region]/+page.server.ts`:
  - Parses `URLSearchParams` via `parseVirtualLiveListQueryState`
    (name/id/virtual_live_type/spoiler/sort_by/sort_order).
  - Builds the request query with `createVirtualLiveListRequestQuery`, calling
    `getVirtualLivesByRegionList`.
  - `virtual_live_type` is multi-value (comma-joined on the wire, comma-split on
    parse) — mirrors `sekai-master-api`'s `virtual_live_type` comma-separated OR
    filter.
  - Falls back to an empty page on error; the promise is attached a no-op `.catch`
    to avoid unhandled rejection during SvelteKit streaming.
- **Detail route** `routes/virtual-live/[region]/[id]/+page.server.ts`:
  - Aggregates `getVirtualLivesByRegionById` + `...ByIdSchedules` +
    `...ByIdSetlists` in a single `Promise.all`.
  - Merges schedules/setlists from the dedicated endpoints only when the base
    detail did not already include them (`baseDetail.schedules.length > 0 ? ...`).
  - Derives available regions from the detail response, then falls back to
    `getVirtualLivesRegionsByIdAvailability` when the record is missing in the
    current region.
- **Boundary / tolerant parsing** (`lib/server/virtual-live-detail.ts`,
  `lib/server/virtual-live-list.ts`):
  - Region master-data JSON is not uniform; parsers accept both snake_case
    (`start_at`, `assetBundleName`) and the canonical keys via `pickFirst*`
    helpers, and coerce numbers/strings defensively (`getNumber`, `getDateValue`,
    `getStringLike`).
  - `parseVirtualLiveReward` handles the EN sparse-legacy singular
    `virtualLiveReward` object as well as the `virtualLiveRewards` array.
  - `parsePagination` tolerates `pagination` / `meta` / `data` envelope variants
    and infers `hasNext` from `totalPages` or item-count fallback.
  - `deriveVirtualLiveStatus` (in `lib/domain/virtual-live.ts`) computes
    `upcoming | ongoing | ended` client-side from `startAt`/`endAt`.

## Swipe-to-switch-region pattern

`lib/actions/swipe-region.ts` is a Svelte action mounted on the page root that
navigates between adjacent region options in a `[data-region-switcher]`
switcher. Reusable across list and detail pages. Guards that prevent conflicts
with page gestures:

- Edge guard: ignores touches within `EDGE_GUARD_PX` (24px) of the screen edge.
- Skips targets matching `[data-swipe-region-skip]`, `dialog`, `input`,
  `textarea`, `select`, `[role='slider']`, or any ancestor with horizontal
  scroll (`overflowX: auto|scroll` and `scrollWidth > clientWidth`).
- Requires at least two visible `[data-region-option]` entries.
- Cancels the gesture on clear vertical intent (`VERTICAL_SLOP_PX` + horizontal
  dominance ratio), multi-touch, or `touchmove` past a vertical threshold.
- Suppresses only the compatibility click from the recognized gesture
  (`event.preventDefault()` on cancelable `touchend`) and respects
  `prefers-reduced-motion` for feedback animation.

This pattern is the canonical way to add mobile region switching on new
list/detail pages without fighting existing scroll or control interactions.
