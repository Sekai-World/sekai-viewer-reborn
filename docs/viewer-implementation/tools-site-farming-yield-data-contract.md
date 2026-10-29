# Tools-Site Farming Yield Data Contract

Contract for the data behind tools-site farming yield metrics (issue #385). It
builds on the evidence boundary in
[`tools-site-yield-validation.md`](tools-site-yield-validation.md) (#380) and is
the dependency for single-song recommendations (#381) and cumulative planning
(#382). It defines the first supported metric and its input; it does not define
any recommendation UI.

## Decision Summary

| Question                | Decision                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract owner          | tools-site consumes a licensed, externally supplied `music_metas.json` as an input. It is not assigned to `sekai-master-api` and no repository generator is required (user decision, 2026-09-25).     |
| Authoritative source    | Default: self-hosted `https://storage.sekai.best/sekai-best-assets/music_metas.json`. Explicit alternative: `https://moe.exmeaning.com/data/music_meta/music_metas.json`. Both confirmed by the user. |
| First supported mode    | **JP Solo**, region `jp` only, formula version `jp-solo-community-v1`.                                                                                                                                |
| First supported metrics | Per-live **score** and per-live **event points** for one song and difficulty. No per-hour, per-energy, or cumulative metric.                                                                          |
| Deck and bonus inputs   | Supplied manually by the user for the first mode. No user-data import and no derived event-bonus resolution.                                                                                          |
| Upstream API work       | None required. If the data later moves into `sekai-master-api`, follow the OpenAPI/SDK workflow in `AGENTS.md` and update this contract in the same change.                                           |

The artifact is an input to validate, not a game-result oracle. Data
availability does not validate a formula; the JP Solo formulas remain approved
only as recorded in the validation document.

## Sources and Selection

- The default source is the self-hosted copy. The Moesekai URL is a
  user-selectable external alternative.
- Source choice is explicit. A failed or invalid source must never silently
  select the other one. Changing source recalculates results.
- `https://metadata.pjsk.moe/data/music_meta/music_metas.json` (the historical
  Moesekai fallback) returned 404 on 2026-09-25 and is not a supported source.
- Results must show which source, URL, and revision supplied them.
- Source selection belongs to #381's UI, not Tracker.

The URLs and ids are constants in
`apps/tools-site/src/lib/server/music-metas.ts` (`MUSIC_META_SOURCES`).

## Scope

| Dimension       | Supported              | Everything else                                                                                  |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| Region          | `jp`                   | Blocked. The artifact carries no region field, so it cannot prove coverage for any other region. |
| Mode            | Solo (non-Auto)        | Auto, Multi, Challenge, Cheerful Carnival, World Bloom stay blocked/unverified.                  |
| Formula version | `jp-solo-community-v1` | Any other value is unsupported.                                                                  |

Records for songs that are absent from the selected region's own music list are
not evidence that the song exists there. Only songs the region's master data
lists are offered, and each needs a matching record (see _Missing-data states_).

## Raw Fields

The artifact is a JSON array with one record per `(music_id, difficulty)`.
Validation requires exactly these twelve fields. Any additional field (the
Moesekai source adds score, PT, PSPI, and cycle fields) is ignored and must not
be shown as yield evidence.

| Field               | Type                                                   | Meaning / unit                                                                           | Used by the first metric |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------ |
| `music_id`          | positive integer                                       | Song id.                                                                                 | key                      |
| `difficulty`        | `easy`, `normal`, `hard`, `expert`, `master`, `append` | Difficulty.                                                                              | key                      |
| `music_time`        | number > 0                                             | Song length. Seconds (observed values such as `123.2`; unit not independently verified). | no                       |
| `event_rate`        | positive integer                                       | Song event-point rate in percent (`114` is ×1.14); divided by 100 in the formula.        | **yes**                  |
| `base_score`        | number ≥ 0                                             | Base score coefficient, a multiplier on `deck_power × 4`.                                | **yes**                  |
| `base_score_auto`   | number ≥ 0                                             | Auto base score coefficient.                                                             | no (validated only)      |
| `skill_score_solo`  | 6 numbers ≥ 0                                          | Solo skill score coefficients, multiplied by the matching `effective_skill_rate / 100`.  | **yes**                  |
| `skill_score_auto`  | 6 numbers ≥ 0                                          | Auto skill coefficients.                                                                 | no (validated only)      |
| `skill_score_multi` | 6 numbers ≥ 0                                          | Multi skill coefficients.                                                                | no (validated only)      |
| `fever_score`       | number ≥ 0                                             | Fever coefficient.                                                                       | no (validated only)      |
| `fever_end_time`    | number ≥ 0                                             | Fever end time. Seconds (observed; unit not independently verified).                     | no (validated only)      |
| `tap_count`         | integer ≥ 0                                            | Note count. Never used to infer yield.                                                   | no                       |

Fields not used by the first metric are still validated so the revision digest
covers the same twelve fields for every consumer and a later mode does not need
a new contract. How the six skill slots map to deck cards follows the JP Solo
reference implementation and is owned by #381; this contract does not
reinterpret the arrays.

Validation is implemented by `parseMusicMetas`. It is fail-closed: a non-array
or empty payload, one malformed record, a wrong-length skill array, a
non-finite number, or a duplicate `(music_id, difficulty)` rejects the whole
source. Partial records are never dropped and filled in.

## Units, Formulas, and Rounding

Formulas are the approved JP Solo community references from the validation
document, restated here as the contract's rounding order:

```text
score        = floor((base_score + Σ skill_score_solo[i] × effective_skill_rate[i] / 100) × deck_power × 4)
event points = floor((100 + floor(score / 20000)) × (event_rate / 100) × (1 + deck_bonus / 100)) × boost_multiplier
```

- `effective_skill_rate` and `deck_bonus` are percentages; `boost_multiplier` is
  an integer multiplier.
- Round only where `floor` is written: once after the whole score expression,
  then the nested `floor(score / 20000)`, then the outer `floor` _before_
  multiplying by `boost_multiplier`. Do not round intermediate products.
- Use IEEE double arithmetic, as the reference implementation does.
- For the first mode the skill sequence is supplied explicitly and complete;
  preserve its order and do not reorder or reassign rates.

## Provenance, Revision, and Freshness

Every displayed result must carry a provenance record:

| Item            | Rule                                                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source id / URL | One of `MUSIC_META_SOURCES`.                                                                                                                                                                                                                  |
| Revision        | `computeMusicMetasRevision`: SHA-256 hex of `JSON.stringify` over the records projected to the twelve contract fields in the table order, sorted by `music_id` ascending, then `difficulty` string ascending. Derived fields never affect it. |
| Record count    | Number of validated records.                                                                                                                                                                                                                  |
| Last-Modified   | The HTTP `Last-Modified` header of the response, or recorded as absent.                                                                                                                                                                       |
| Fetched at      | Time the artifact was fetched.                                                                                                                                                                                                                |

The artifact has no embedded version or timestamp, and ETags are not comparable
between the two hosts, so the content digest is the revision and `Last-Modified`
is the only freshness signal.

Freshness (`assessMusicMetasFreshness`):

- `fresh`: `Last-Modified` is no older than `MUSIC_METAS_MAX_AGE_MS` (30 days).
- `stale`: older than that.
- `unknown`: the header is missing, unparsable, or in the future.

`stale` and `unknown` are not served as current: fail closed (see below). The
30-day limit is a proposed default and is listed under _Open Decisions_.

Audit on 2026-10-29: both sources returned HTTP 200 and 3,810 records
(731 each of `easy`/`normal`/`hard`/`expert`, 732 `master`, 154 `append`). Every
record passed validation, and both produced revision
`d165e760a5d14cc6fb2e085626371704c37be13d46aa09180f1ef022b02f921f`. Last-Modified
was 2026-10-25 (self-hosted) and 2026-10-29 (Moesekai). The earlier 2026-09-25
audit recorded 3,727 records and revision
`7875548d5da4b1b5ee65f2671d61126dcc660ee32b371596f48214a7ed96e01e`, so the
revision legitimately changes as songs are added. Equality at one timestamp does
not prove the sources stay equivalent; each selected source is validated on its
own.

## Missing-Data and Failure States

| State                                   | Behavior                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fetch failed, timed out, or non-2xx     | Source unavailable. Show it as unavailable; do not switch sources and do not use stale cached values as current. |
| Payload invalid (`parseMusicMetas`)     | Source invalid. Show no yield figures.                                                                           |
| Freshness `stale` or `unknown`          | Source not current. Show no yield figures; explain that the data is out of date.                                 |
| No record for the song and difficulty   | That song is "data unavailable". Never use zero, a neighbouring difficulty, or a value inferred from note count. |
| A manual deck input is missing/invalid  | The metric for that input is unavailable. No default is substituted.                                             |
| Region other than `jp`, or another mode | Unsupported. Show no figures.                                                                                    |

## Input-to-Output Vector

Vector V0 follows the schema in the validation document. Coefficients come from
the real record of music 1, master, in the 2026-10-29 audit; the deck inputs are
synthetic and are not an in-game observation. The expected values come from the
approved JP Solo formula, not from an observed result. It is asserted by
`apps/tools-site/src/lib/server/music-metas.test.ts`.

```json
{
  "vectorId": "V0",
  "region": "jp",
  "liveMode": "solo",
  "auto": false,
  "songId": 1,
  "difficulty": "master",
  "deck": { "source": "manual", "deckPower": 300000, "deckBonusPercent": 200 },
  "liveInputs": { "effectiveSkillRatePercent": [140, 130, 120, 110, 100, 90] },
  "bonusInputs": { "boostMultiplier": 1 },
  "musicMeta": {
    "event_rate": 114,
    "base_score": 1.1599442522953187,
    "skill_score_solo": [
      0.03796830587347502, 0.03652851213683813, 0.05339327757514775, 0.04202641177210418,
      0.0637942585838259, 0.05121274053578169
    ]
  },
  "formulaVersion": "jp-solo-community-v1",
  "expected": {
    "score": { "value": 1776928, "status": "community-validated" },
    "eventPoints": { "value": 642, "status": "community-validated" }
  },
  "observed": null,
  "evidence": ["Moesekai re_sekai-calculator reference formulas (see validation document)"],
  "assumptions": ["Synthetic deck inputs", "Six explicit skill rates applied positionally"],
  "missingFields": []
}
```

Step check: score = floor(1.4807736574015946 × 300000 × 4) = 1,776,928;
floor(1,776,928 / 20000) = 88; floor(188 × 1.14 × 3) = floor(642.96) = 642. With
`boostMultiplier` 5 the result is 3,210, which confirms the floor happens before
the boost.

## Blocked

These stay blocked and are not treated as implementation-ready:

- Any region other than `jp`, and Auto, Multi, Challenge, Cheerful Carnival, and
  World Bloom yields.
- Per-hour, per-energy, and cumulative planning metrics. Duration and energy
  semantics are undefined, and the Moesekai `cycles_*`/`pt_per_hour_*` fields are
  derived from preset teams, not personalized observations.
- Deck state derived from user data, and event/card bonus resolution from master
  data (display-oriented and partial per the validation document).
- Independent in-game observed vectors are not required for JP Solo but remain
  required for every other mode.

## Dependencies

- #381 (single-song recommendations) may implement only the JP Solo score and
  event-point metrics above, with manual deck inputs, the provenance display, and
  the explicit source selector. It must not add other modes or regions.
- #382 (cumulative planning) stays blocked until #381 delivers its single-song
  figures and duration/energy semantics are defined.
- #380 remains the gate for any mode other than JP Solo.

## Open Decisions

1. **Maximum age.** 30 days is proposed. The artifact only changes when songs or
   coefficients change, and a stale file mainly yields missing songs, so the
   limit trades availability against silent coefficient drift. The owner should
   confirm or change `MUSIC_METAS_MAX_AGE_MS`.
2. **Skill slot mapping.** The artifact has six slots per live type. The mapping
   to deck cards must be taken from the JP Solo reference by #381 and recorded
   there; this contract deliberately does not guess it.
3. **Units of `music_time` and `fever_end_time`.** Treated as seconds from
   observation. They do not feed the first metric, so this only matters if a
   duration-based metric is later added.
