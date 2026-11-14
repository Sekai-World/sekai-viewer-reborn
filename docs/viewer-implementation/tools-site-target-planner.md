# Tools-Site Target Planner

How the music recommender plans the lives needed to reach a cumulative score or
event-point target (issue #382). It builds on the per-live JP Solo yields of the
recommender (#381) and the data contract in
[`tools-site-farming-yield-data-contract.md`](tools-site-farming-yield-data-contract.md).

## Scope

- Region `jp`, Solo, formula `jp-solo-community-v1` only. The planner takes the
  per-live score and event points the recommender already calculated for the
  entered deck; it never recalculates a yield.
- The target is a total **score** or a total **event points**, selected by the
  recommender's metric control.
- Two objectives, always chosen by the user: **fewest lives** and **least
  overshoot**.
- **Not supported, and refused rather than approximated:** energy and time
  objectives (semantics defined in
  [`tools-site-yield-duration-energy.md`](tools-site-yield-duration-energy.md),
  implementation tracked in #544), modes other than Solo and Auto
  (#538), regions other than `jp`, `tw`, `en`, and `kr`, and decks or event bonuses derived
  from user data (#541).

## Inputs

| Input                 | Meaning                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `target`              | Whole number from 1 to 100,000,000,000.                                                                              |
| `objective`           | `fewestPlays` or `leastOvershoot`.                                                                                   |
| `maxPlays`            | Whole number from 1 to 10,000: the most lives played, required songs included.                                       |
| `allowRepeats`        | When false, each song and difficulty is played at most once.                                                         |
| `allowedDifficulties` | Optional limit on the difficulties used; none means all.                                                             |
| `requiredSongs`       | Optional songs that are each played at least once.                                                                   |
| `yields`              | Per-live `score` and `eventPoints` for every song and difficulty, each a positive whole number up to the target cap. |

Required songs are played once up front and count toward the target and the
lives limit. When repeats are allowed they may also be played again; when not,
they are excluded from the remaining pool. Duplicate or unknown songs and
non-integer or non-positive values make the request `invalid-input`; nothing is
defaulted.

## Objectives and guarantees

Every plan returned is **provably optimal for its declared objective**. There is
no heuristic mode in this version; a request the exact solvers cannot cover is
refused (see _Bounds_).

**Fewest lives.** After the required songs, let `need` be the target minus their
yield.

- Repeats allowed: every life yields at most the largest yield `y_max`, so
  `ceil(need / y_max)` lives are necessary, and `(that - 1)` lives of the best song
  plus one life of the smallest sufficient yield reach the target.
- No repeats: the `k` highest yields have the largest possible sum for any `k`,
  so taking songs from the highest down until the sum reaches `need` uses the fewest.
- The number of lives is optimal. The overshoot is **not** minimized as a second
  criterion; the plan only avoids the obvious waste of a larger final song.

**Least overshoot.** The smallest total that is at least the target, using at
most the allowed lives; among plans with that total, the fewest lives.
Dropping any one life from a plan that overshoots by a full `y_max` would still
reach the target, so the optimum lies below `need + y_max`. When a table of those
sums fits the bounds, it gives the fewest lives to reach each sum:

- Repeats allowed: unbounded-knapsack table over the distinct yields.
- No repeats: 0/1-knapsack table over the songs, with one bit per song and sum to
  rebuild the plan.

Otherwise an exact search in `lib/least-overshoot-search.ts` answers instead,
going through the number of lives `k` from the fewest that can reach `need`. Yields
are first divided by their common factor, so every total is a multiple of it and
the smallest possible overshoot is known. Stopping is proven: every life yields at
least `y_min`, so once `k × y_min - need` reaches the best overshoot, more lives
cannot beat it.

- **Repeats allowed.** A `k`-life total is `k × y_max` minus the deficits
  `y_max - y` of its lives. A deficit of 0 is always available, so `k` lives can make
  a total exactly when `k × y_max - total` is a sum of at most `k` positive deficits.
  That number is below one yield at the first `k`, whatever the target. Bitsets of
  the sums of at most `j` deficits, layer by layer, give the largest deficit at or
  below `k × y_max - need`, which is the smallest overshoot for that `k`.
- **No repeats.** Branch and bound over the rows from the largest down settles each
  `k`. A subtree is cut when its next rows cannot reach `need`, or when its smallest
  rows cannot beat the best overshoot; equal yields are tried once.
- **Shortcuts that prove themselves.** The overshoot cannot be below the smallest
  possible one, and every smaller `k` has already been ruled out, so a plan that
  hits that total at the current `k` needs no further search. With repeats, the search
  looks for one as repeats of the widest deficit plus at most four others, meeting
  in the middle over the sums of two. Without repeats, it picks each life closest to
  the average still needed and closes with an exact pair.

## Bounds and complexity

| Bound                               | Value           | Applies to             |
| ----------------------------------- | --------------- | ---------------------- |
| Target and per-live yield cap       | 100,000,000,000 | all requests           |
| Maximum lives                       | 10,000          | all requests           |
| Table sum span (`need + y_max`)     | 5,000,000       | least overshoot table  |
| Table work                          | 50,000,000      | least overshoot table  |
| Search deficit span (`deficitSpan`) | 67,108,864      | least overshoot search |
| Search work (`searchWork`)          | 400,000,000     | least overshoot search |

- **Fewest lives** is `O(n)` (repeats) or `O(n log n)` (no repeats) in the number
  of song and difficulty rows, with no dependence on the size of the target.
- **Least overshoot table** is `O(span × distinct yields)` time and `O(span)` memory
  with repeats, and `O(span × songs)` time with `O(span × songs / 8)` bytes without.
  A request beyond either table bound goes to the search.
- **Least overshoot search** with repeats takes `O(n²)` bit operations for the
  shortcut, independent of the target. Ruling a `k` out takes at most
  `O(layers × n × deficit / 32)` word operations and `layers × deficit / 8` bytes. Without
  repeats, it takes `O(k log n + n)` for the shortcut, and branch and bound is
  exponential in the worst case, with each node charged as 8 operations of work.
  A request beyond either search bound is answered `out-of-bounds` with the bound
  that was exceeded and by how much. Nothing else is ever returned in its place.

Measured with random targets on the 3,832 rows of the 2026-11-06 `music_metas.json`,
with all difficulties allowed and 10,000 lives, 250 targets per row:

| Deck (power / bonus % / boost / effects 100) | Metric and target range  | Repeats | Exact / with overshoot / out of bounds | Median | Slowest |
| -------------------------------------------- | ------------------------ | ------- | -------------------------------------- | ------ | ------- |
| 300,000 / 200 / 1                            | score, 3M to 100M        | yes     | 245 / 4 / 1                            | 22 ms  | 306 ms  |
| 300,000 / 200 / 1                            | score, 3M to 100M        | no      | 250 / 0 / 0                            | 23 ms  | 216 ms  |
| 300,000 / 200 / 1                            | score, 100M to 5B        | yes     | 250 / 0 / 0                            | 22 ms  | 26 ms   |
| 300,000 / 200 / 1                            | score, 100M to 5B        | no      | 250 / 0 / 0                            | 62 ms  | 240 ms  |
| 400,000 / 300 / 5                            | score, 3M to 100M        | yes     | 244 / 6 / 0                            | 22 ms  | 322 ms  |
| 400,000 / 300 / 5                            | score, 3M to 100M        | no      | 244 / 6 / 0                            | 30 ms  | 208 ms  |
| 400,000 / 300 / 5                            | score, 100M to 5B        | yes     | 250 / 0 / 0                            | 22 ms  | 27 ms   |
| 400,000 / 300 / 5                            | score, 100M to 5B        | no      | 250 / 0 / 0                            | 83 ms  | 252 ms  |
| 300,000 / 200 / 1                            | event points, 340K to 5M | yes     | 250 / 0 / 0                            | 1 ms   | 1 ms    |
| 400,000 / 300 / 5                            | event points, 340K to 5M | yes     | 51 / 199 / 0                           | 1 ms   | 1 ms    |

The event-point overshoots on the second deck are expected: its yields are all
multiples of 5, so a target that is not has no exact total. Below about 340,000
event points, the table still answers, so those results are unchanged. Without
repeats, event-point targets above the sum of every row are `target-unreachable`.

A narrower pool stays in bounds too: a sweep of 400 score targets from 2M to 80M for
each deck, with and without repeats, limited to `append` or to `easy` and `normal`,
returned no `out-of-bounds`. With all difficulties in that sweep, one target of 1,600
was refused (5,854,981 with repeats on the first deck). Small-looking targets
are the hard ones: few lives leave few combinations, so an exact total is often
impossible and every combination has to be ruled out.

## Ties and determinism

Rows are ordered by song id, then difficulty (easy to append). Equal yields are
interchangeable, so the lowest song id and difficulty is used. The same request
returns the same plan whatever the input order. Where several plans are equally
optimal, one is returned; the others are not listed.

## Unavailable states

| Reason                 | Meaning                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `invalid-input`        | A control or yield row is malformed; the offending fields are named.                 |
| `no-candidates`        | No yield rows remain after the difficulty filter.                                    |
| `required-unavailable` | A required song is not among the candidates.                                         |
| `plays-limit`          | Required songs alone exceed the lives limit, or the target needs more lives.         |
| `target-unreachable`   | Even every allowed song once (no repeats) falls short, or nothing is left to play.   |
| `out-of-bounds`        | Least overshoot beyond the search bounds.                                            |
| `yields-unavailable`   | (page only) The recommender could not calculate yields, so there is nothing to plan. |

When required songs exceed the lives limit the lives limit is reported first.

## Page integration

The planner lives on `/music-recommender` as the _Target plan_ panel. It is
driven by query parameters, so a plan is shareable and runs on the server:

`target`, `objective`, `maxPlays`, `repeats` (`true`/`false`), `difficulties`
(comma list, empty for all), `required` (`songId:difficulty`, comma list).

- No plan parameter means no plan; the panel stays idle.
- Some but not all of the required parameters is `invalid`, with the missing and
  invalid fields named. The recommendations still render.
- The form validates with the same parser as the server
  (`lib/target-plan-query.ts`) before submitting, and submits together with the
  deck settings, so a plan is always made for the deck as entered.
- Only the plan result is sent to the browser; the planner never runs there.

A result shows the lives, target, total, overshoot, the other metric's total,
per-song counts and subtotals, whether each song was required, the source and
formula it is based on, and the assumptions: every live uses the entered deck
and the recommender's per-live values, and energy and time are not planned.

## Verification

- Unit tests cover single-live, repeated, mixed-song, no-repeat, required-song,
  lives-limit, difficulty-filter, tie, overshoot, unreachable, invalid, and
  out-of-bounds cases, and re-sum every plan from the input rows.
- A seeded run of 4,000 random small problems compares both objectives, with and
  without repeats and required songs, against exhaustive search over every legal
  play count vector. Injecting an off-by-one in each solver makes it fail.
- A seeded run of 3,000 problems too large to table does the same for least
  overshoot, with difficulty filters and required songs, through `planTarget`.
- Seeded runs of 5,000 denser problems compare the search directly against a full
  table of every sum. Of 27 off-by-one and logic mutations of the search, 24 fail the
  tests. The other 3 change only speed, not answers: an early exit from a shortcut,
  the frontier used to build a layer, and a shortcut tried at one life fewer.
- Tests on 3,800 generated yields shaped like the real score data check a proven plan
  at the fewest possible lives, and that both search bounds refuse.
- Component and loader tests cover input validation, the loading, idle, invalid,
  unavailable, and result states, and accessible controls.

## Out of scope

- Energy, boost cost, and time objectives, and per-hour or per-energy efficiency.
  [`tools-site-yield-duration-energy.md`](tools-site-yield-duration-energy.md)
  makes these available to #544: the objectives "least live bonus" and
  "shortest play time", and a cap on either. The time objective and cap need the
  user's overhead per live. Natural recovery and "per day" planning stay
  blocked.
- Modes other than Solo and Auto, and regions other than `jp`, `tw`, `en`, and `kr`.
- Heuristic or approximate plans. If one is added later it must be labelled
  as such and kept separate from the exact objectives above.
