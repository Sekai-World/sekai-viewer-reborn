# Tools-Site Yield Duration and Energy Semantics

Defines what "per energy" and "per unit of time" mean for one live, so that
efficiency metrics and the planner objectives of #544 can be built on verified
inputs (issue #540). It extends
[`tools-site-farming-yield-data-contract.md`](tools-site-farming-yield-data-contract.md)
and changes no formula in it.

Scope: Solo and Auto lives, per-live event points, region `jp`. Nothing here
ships code; #544 implements what this document enables.

## Summary

| Metric                                  | Status                               | Basis                                                                                 |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Energy cost of a live                   | **Enabled**                          | `boosts.json` `costBoost` (master data), on the assumption stated under _Energy_.     |
| Event points per live bonus             | **Enabled**                          | Per-live event points ÷ `costBoost`. Undefined when `costBoost` is 0.                 |
| Song time of a live                     | **Enabled**                          | `music_time`, verified against the audio files (below).                               |
| Event points per minute of song         | **Enabled**, labelled as song time   | Per-live event points ÷ song time. Not a play-time estimate.                          |
| Event points per hour of play           | **Enabled only with a manual input** | Needs the user's overhead per live. No default exists.                                |
| Score per energy or per time            | Not defined                          | The formula does not multiply score by boost, and no use for the ratio was asked for. |
| Natural recovery, "per day", item costs | **Blocked**                          | No recovery rate or item-to-jewel evidence was collected.                             |
| `fever_end_time`                        | Still unverified                     | Not needed by any metric here.                                                        |
| Modes other than Solo and Auto          | **Blocked**                          | #538.                                                                                 |

## Energy

### Unit and source

Energy is the **live bonus** (`ライブボーナス`) a live consumes. The
authoritative source is the master data table `boosts.json`:

| `costBoost` (live bonus consumed) | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  |
| --------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `eventPointRate`                  | 1   | 5   | 10  | 15  | 20  | 25  | 27  | 29  | 31  | 33  | 35  |

Evidence:

- `sekai-master-db-diff` `origin/main` at `33c06086` (2026-11-12): 11 rows,
  `isEventOnly` false on every row.
- The same eleven `(costBoost, eventPointRate)` pairs are in the EN, KR, TW and
  CN master data (`sekai-master-db-en-diff` `5ce9733b`, `-kr-diff` `ca469875`,
  `-tc-diff` `69459e5d`, `-cn-diff` `a8b9c699`, read 2026-11-14).
- The table has changed before. Until the commit of 2024-09-28 (`33c8292a`) the
  rates for costs 4, 5 and 6 were 19, 23 and 26. The legacy viewer still
  hard-codes those old values (`sekai-viewer/src/utils/scoreCalc.ts`), which is
  why the table must be read from master data and never copied into code.
- `eventPointRate` is the `boost_multiplier` of the contract formula. The
  reference calculator multiplies by it after the outer `floor`
  (`re_sekai-calculator` `event-calculator.ts`, `getEventPoint`, Solo and Auto
  branch), which is the order the contract already records.

Assumption: `costBoost` is the number of live bonus consumed by one live. This
reads the field name and the 0–10 range against the in-game selector; it is not
an observed account balance before and after a live.

`boosts.json` also carries `expRate`, `rewardRate`, `livePointRate` and
`bondsExpRate`. From cost 6 upward they differ from `eventPointRate` (26–30
against 27–35). They are out of scope and must not be used as the event-point
multiplier.

### Rules

- A boost choice is one `boosts.json` row. `boost_multiplier` must equal the
  `eventPointRate` of a row; the energy cost of the live is that row's
  `costBoost`. The rates are distinct, so the lookup is unambiguous in both
  directions.
- A multiplier that is not in the table has no energy cost. Any metric or
  objective that uses energy must reject it as an invalid input. The recommender
  today accepts any positive integer
  (`apps/tools-site/src/lib/music-recommender.ts`); that stays valid for
  per-live figures and is not enough for energy.
- Event points per live bonus = per-live event points ÷ `costBoost`.
- With `costBoost` 0 the ratio is **undefined**. Show it as "no live bonus
  used". Never show zero or infinity, and never rank it against other rows.
- The contract formula applies the multiplier to event points only, so there is
  no score-per-energy metric. This follows from the formula, not from an
  observed live.
- The table is read from master data at run time, with its source and revision
  shown like the other inputs. `sekai-master-api` serves it as
  `GET /api/v1/boosts/{region}/list`; the target planner reads it from there
  ([`tools-site-target-planner.md`](tools-site-target-planner.md), _Live bonus_).
  Known gap: the planner names the boost table as the source of the cost but
  shows no revision, because that endpoint does not carry one.

## Duration

### Song time

`music_time` in `music_metas.json` is the **length of the song in seconds,
without the leading filler**: the audio file's duration minus the song's
`fillerSec` from `musics.json`, to within about 0.1 s. The exact rounding the
generator applies was not determined.

Evidence, measured 2026-11-14 with `ffprobe` on
`sekai-jp-assets/music/long/<vocal>/<vocal>.mp3` (first vocal of each song),
against `music_metas.json` with SHA-256 prefix `df670a4da8d4dd3e` and
`musics.json` at `33c06086`:

| Song | Audio (s) | `fillerSec` | Audio − filler | `music_time` |
| ---- | --------- | ----------- | -------------- | ------------ |
| 1    | 132.20    | 9.00        | 123.20         | 123.2        |
| 47   | 191.07    | 9.00        | 182.07         | 182.1        |
| 74   | 83.77     | 9.00        | 74.77          | 74.8         |
| 388  | 308.40    | 8.70        | 299.70         | 299.7        |

Twenty-five more songs were measured (sixteen drawn at random, nine picked by an
independent re-check). Over all twenty-nine, the difference
`audio − fillerSec − music_time` lies between −0.11 s and +0.01 s; the largest
gap is song 127 (124.295 s against 124.4).
Other facts from the same artifact: every `music_time` has exactly one decimal;
a song has one `music_time` across all its difficulties (741 songs, no
exception); values range from 74.8 s (song 74) to 323.9 s (song 675).

This closes open item 2 of the data contract for `music_time`. It was checked
for `jp` only. `fever_end_time` was not checked.

### Time of a live

Song time is not play time. A live also has loading, the result screens and the
return to the song list, and nothing in master data or in the artifact measures
them. Their length depends on the device, the network and how fast the player
taps. So:

- **Song time** of a live = `music_time`.
- **Play time** of a live = `music_time` + **overhead**, where overhead is a
  number of seconds per live that the user enters. It has no default and no
  suggested value. Without it, no play-time metric or objective is available.
- Overhead is one value for a whole plan. It does not vary by song, mode or
  boost.

### Rules

- Event points per minute of song = per-live event points × 60 ÷ `music_time`.
  It must be labelled as song time wherever it is shown.
- Event points per hour of play = per-live event points × 3600 ÷
  (`music_time` + overhead). Available only when the user entered an overhead.
- The planner's "shortest time" objective minimizes total play time, so it also
  needs the overhead: the best plan changes with it (few long songs against many
  short ones).

## Repeated plays and rounding

- Every live is rounded on its own, as in the contract. N lives of one song at
  one boost yield exactly N × the per-live event points.
- Total energy = Σ `costBoost` over the lives. It is an integer.
- Total time is summed in tenths of a second as integers and converted once at
  the end: `round(music_time × 10)` for a song (every record has one decimal),
  and the overhead, which is entered in whole seconds, × 10. Do not add
  floating-point seconds.
- A ratio is computed once from the exact totals in IEEE double arithmetic.
  Ranking and objectives compare the unrounded values; equal values keep the
  recommender's existing order.
- Display rounds a ratio to one decimal place, half up. Totals of event points
  and energy are shown exactly. A total time is shown to the second.

## Vectors

All use vector V0 of the data contract (song 1, master, 642 event points per
live at multiplier 1) and `music_time` 123.2 s. Like V0, they are computed from
the approved formula and the tables above, not from an in-game observation.

| Vector | Inputs                                        | Expected                                                               |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| E1     | `boost_multiplier` 5                          | `costBoost` 1; 3,210 event points; 3,210.0 per live bonus              |
| E2     | `boost_multiplier` 35                         | `costBoost` 10; 22,470 event points; 2,247.0 per live bonus            |
| E3     | `boost_multiplier` 1                          | `costBoost` 0; 642 event points; per live bonus undefined              |
| E4     | `boost_multiplier` 4                          | Not a table row; energy metrics reject the input                       |
| T1     | `boost_multiplier` 1, no overhead             | 312.662… → 312.7 event points per minute of song; per hour unavailable |
| T2     | `boost_multiplier` 1, overhead 60 s           | Play time 183.2 s; 12,615.720… → 12,615.7 event points per hour        |
| R1     | 10 lives, `boost_multiplier` 5, overhead 60 s | 32,100 event points; 10 live bonus; 1,832.0 s of play (30 min 32 s)    |

## What this enables

For #544, on these semantics:

- Objectives "least live bonus" and "shortest play time", and caps on either.
  The time objective and cap require the overhead input.
- Efficiency columns in the recommender: event points per live bonus, and per
  minute of song; per hour of play when an overhead is entered.

Prerequisites that #544 must meet first: a `boosts` source in
`sekai-master-api`, and input validation that restricts the multiplier to the
table whenever energy is used.

Built so far: the planner shows each plan's live bonus and accepts a cap on it,
reading the table from `sekai-master-api`. It has no separate "least live
bonus" objective, because with one boost per plan that is _fewest lives_. A
multiplier outside the table gets no live bonus figure, and a cap with it is
refused with `boostMultiplier` named as the invalid field; that refusal is how
the planner meets the validation prerequisite above, while per-live figures
keep accepting any multiplier. See [`tools-site-target-planner.md`](tools-site-target-planner.md),
_Live bonus_.

It also takes the overhead per live, shows each plan's play time, and has the
"shortest play time" objective, for `jp` and with repeats; see _Play time_ in
the same document. The time cap and the efficiency columns are not built yet.

Still blocked, with the missing evidence:

- **Natural recovery and "per day" figures.** No recovery interval or cap was
  collected from master data or observation.
- **Cost of recovery items or jewels.** `boostItems.json` lists recovery values,
  but no price or conversion was examined.
- **A default or suggested overhead.** It needs timed observations of real
  lives, which do not exist here.
- **Other regions for song time.** `music_time` was checked against JP audio
  only. The boost table itself is identical in all five regions.
- **Multi, Challenge, Cheerful Carnival and World Bloom.** #538.
