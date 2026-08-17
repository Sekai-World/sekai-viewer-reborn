# Tools Site Ranking History Chart

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
continues to own loading, unavailable, and request-cancellation states.

`parseEventTrackerRankings` must include `timestamp` in its de-duplication
identity. List and snapshot responses may collapse duplicate rank/player rows,
but graph responses intentionally contain the same rank/player at many
timestamps; omitting the timestamp silently reduces a complete graph to only
the points where the player identity changes.

The ranking table uses visual tiers for the requested ladder ranks: rank 1,
top 10, top 100, top 1000, and other milestones. Tier labels are localized in
the tools-site tracker dictionary and do not change ranking semantics.

The graph proxy deliberately uses a direct upstream request rather than the
generated SDK. For a current graph it must request
`/event/{id}/rankings/graph?region={region}&rank={rank}` without `timestamp`,
which preserves parity with the legacy API response; add `timestamp` only for
an explicitly selected historical snapshot. See
`apps/tools-site/src/lib/server/tracker-graph.ts`.

Recent-rate details use the active hovered graph point as the target, or the
latest time-sorted point when there is no hover selection. Each horizon uses
the latest snapshot at or before target minus the horizon and divides the score
delta by the actual elapsed hours, remaining unavailable without a baseline.
This avoids look-ahead estimates when graph cadence or gaps differ.
