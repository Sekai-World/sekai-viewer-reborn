# Tools Site Ranking History Chart

## Streamed current-event surfaces

The tools home loader returns the cross-region current-event collection as an
unawaited `events` Promise. This lets the brand lockup, hero copy, and primary
tracker link SSR immediately. `apps/tools-site/src/routes/+page.svelte` converts
the runtime Promise (which SvelteKit types as an already awaited value) back to a
local `RegionCurrentEvent[] | null` state and handles both resolution and
rejection. While the state is `null`, it renders one layout-matched daisyUI
`skeleton` card per supported region; those cards are `aria-hidden`, while the
stable region section carries `role="status"`, `aria-busy`, and the localized
loading announcement. Only resolved data may render available, empty, or failure
copy.

Keep the aggregate Promise's noop catch in the loader and the page's rejection
handler together. `fetchCurrentEvent` currently converts ordinary per-region
transport failures itself, but both safeguards prevent an unexpected future
aggregate failure from producing an unhandled rejection or a permanent skeleton.

Available tools-home event cards use the same confirmed event-banner URL contract
as content-site: `{bucket}/home/banner/{assetBundleName}/{assetBundleName}.webp`.
The tools-site helper owns only its supported region-to-bucket map and takes the
configured public asset base from the runtime public environment; it must not
hardcode an asset host. Cards reserve the same `aspect-ratio: 5 / 2` banner frame
in both resolved and skeleton states, and a failed image falls back to a
decorative surface without changing the card's navigation target.

During local development, `PUBLIC_REMOTE_ASSET_BASE_URL=/storage` is served by
the tools-site Vite proxy to `https://storage.sekai.best`; production does not
enable this development-only proxy.

An available card is one anchor rather than a card plus a nested action link.
Its tracker action row is visual affordance only: remove its text underline,
and move the arrow only for fine-pointer hover or keyboard focus when motion is
not reduced. The homepage owns a single one-second clock and passes it to the
existing `getTrackerCountdown` pure helper, which uses `aggregateAt` and only
falls back to `closedAt`; expired results say that ranking has ended instead of
being labeled live.

## Event tracker ladder control

The tracker ladder switch is a two-option, stateful control: its moving accent
indicator communicates the selected ladder without animating the result table.
Keep the buttons' `aria-pressed` state as the source of truth, keep the indicator
decorative, and reduce the indicator transition to an effectively instant change
under `prefers-reduced-motion`.

## Event tracker header clock

The Event Tracker header's countdown derives from the route's existing one-second
`now` state in `apps/tools-site/src/routes/tracker/[region]/+page.svelte`. Do not
add a second interval or copy content-site's requestAnimationFrame-based
`EventCountdownCard`: tools-site needs only a compact text countdown. Its pure
`$lib/tracker-countdown` helper parses current catalog metadata through
`parseTrackerTimestamp`, prioritizes `aggregateAt`, and uses `closedAt` only as
a fallback.

The Event Tracker uses LayerChart v2 for the per-rank history visualization in
the details dialog. LayerChart is Svelte 5-compatible and provides responsive
scales, hover tooltips, and crosshair highlights without hand-maintained SVG
coordinate math.

The chart receives normalized `score` and `timestamp` points from the tracker
page. Invalid points are filtered in the presentation component; the page
continues to own loading, unavailable, and request-cancellation states. Client
history requests use a 15-second `AbortController` deadline that stays active
through response-body JSON parsing, not only until response headers arrive, and
clear the timer in `finally`.

`parseEventTrackerRankings` must include `timestamp` in its de-duplication
identity. List and snapshot responses may collapse duplicate rank/player rows,
but graph responses intentionally contain the same rank/player at many
timestamps; omitting the timestamp silently reduces a complete graph to only
the points where the player identity changes.

The ranking table uses visual tiers for the requested ladder ranks: rank 1,
top 10, top 100, top 1000, and other milestones. Tier labels are localized in
the tools-site tracker dictionary and do not change ranking semantics.

For desktop mouse convenience, an available native ranking-table row may use a
guarded click that ignores targets within `button, a, input`. Keep the real
detail cell button as the keyboard-accessible control, preserving native table
semantics without adding row roles, tabindex, or keyboard handlers.

The graph proxy deliberately uses a direct upstream request rather than the
generated SDK. For a current graph it must request
`/event/{id}/rankings/graph?region={region}&rank={rank}` without `timestamp`,
which preserves parity with the legacy API response; add `timestamp` only for
an explicitly selected historical snapshot. See
`apps/tools-site/src/lib/server/tracker-graph.ts`.

## World Bloom chapter rankings

The event tracker loader resolves World Bloom chapter metadata through the
master-api `worldBlooms/{region}/list` endpoint, then requests each chapter's
live ranking through the existing sekai-api SDK. The chapter workspace is
rendered only when metadata exists for the selected event; unavailable chapter
data is shown inside its own card rather than replacing the main event ranking.
The `/tracker/[region]/chapter` GET route validates `charaId` and provides the
same typed chapter response for future client refresh interactions.

World Bloom uses one ranking workspace: the event ranking and chapter tabs swap
the same table, responsive cards, details dialog, graph, and ranking context.
Ordinary events do not render chapter tabs. A current chapter keeps a separate
current marker from the selected tab, and its countdown targets the next
chapter start or falls back to the current chapter end.

Recent-rate details use the active hovered graph point as the target, or the
latest time-sorted point when there is no hover selection. Each horizon uses
the latest snapshot at or before target minus the horizon and divides the score
delta by the actual elapsed hours, remaining unavailable without a baseline.
This avoids look-ahead estimates when graph cadence or gaps differ.

## Live ranking completeness

Parsed live snapshots are checked against the critical rank ladder. Missing
critical ranks are retried in the same request at most twice, after 500 ms and
1500 ms. Restore/202, SDK/network failures, and invalid payloads retain their
existing status semantics and do not enter completeness retries. The final
compatible `available` result retains its rows and exposes internal
`completeness` metadata with `status: "incomplete"` and `missingRanks` rather
than claiming completeness. KR alone may omit rank 50000 as
`accepted-incomplete`; all other missing-rank combinations remain incomplete.
