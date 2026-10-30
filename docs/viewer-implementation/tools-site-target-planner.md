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
  objectives (no semantics yet, tracked in #540), modes other than Solo
  (#538), regions other than `jp` (#539), and decks or event bonuses derived from
  user data (#541).

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
reach the target, so the optimum lies below `need + y_max`. An exact table over
those sums gives the fewest lives to reach each sum:

- Repeats allowed: unbounded-knapsack table over the distinct yields.
- No repeats: 0/1-knapsack table over the songs, with one bit per song and sum to
  rebuild the plan.

## Bounds and complexity

| Bound                         | Value           | Applies to      |
| ----------------------------- | --------------- | --------------- |
| Target and per-live yield cap | 100,000,000,000 | all requests    |
| Maximum lives                 | 10,000          | all requests    |
| Sum span (`need + y_max`)     | 5,000,000       | least overshoot |
| Table work                    | 50,000,000      | least overshoot |

- **Fewest lives** is `O(n)` (repeats) or `O(n log n)` (no repeats) in the number
  of song and difficulty rows, with no dependence on the size of the target.
- **Least overshoot** is `O(span × distinct yields)` time and `O(span)` memory with
  repeats, and `O(span × songs)` time with `O(span × songs / 8)` bytes without.
  A request beyond either of the last two bounds is answered `out-of-bounds` with
  the bound that was exceeded and by how much.

Measured on the 3,810 rows of the 2026-10-29 `music_metas.json`, with all
difficulties allowed and 10,000 lives:

| Deck (power / bonus % / boost) | Metric       | Distinct yields | Largest exact least-overshoot target                     |
| ------------------------------ | ------------ | --------------- | -------------------------------------------------------- |
| 300,000 / 200 / 1              | event points | 147             | about 339,000 with repeats (80 ms); about 12,000 without |
| 400,000 / 300 / 5              | event points | 210             | about 232,000 with repeats (60 ms); about 7,400 without  |
| 300,000 / 200 / 1              | score        | 3,794           | none: every target is out of bounds                      |
| 400,000 / 300 / 5              | score        | 3,798           | none: every target is out of bounds                      |

Event-point yields repeat across songs, so the tables stay small. Score yields
are almost all different and about two million per live, so the table is wider
than the span bound allows even for the smallest target. **In this version
_least overshoot_ is therefore effectively available for event-point targets
only; score targets are planned exactly for _fewest lives_.** A smarter exact
solver for score (for example a search over a few lives) is a possible
follow-up, not part of this version.

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
| `out-of-bounds`        | Least overshoot beyond the sum-span or work bound.                                   |
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
- Component and loader tests cover input validation, the loading, idle, invalid,
  unavailable, and result states, and accessible controls.

## Out of scope

- Energy, boost cost, and time objectives, and per-hour or per-energy efficiency.
- Modes other than JP Solo and regions other than `jp`.
- Heuristic or approximate plans. If one is added later it must be labelled
  as such and kept separate from the exact objectives above.
