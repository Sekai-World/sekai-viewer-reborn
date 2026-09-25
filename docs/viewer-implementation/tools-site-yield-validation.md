# Tools-Site Yield Validation

This document records the evidence boundary for issue #380. It is a
prerequisite for any tools-site feature that recommends songs by expected score
or event points. The JP Solo formulas below are approved as community-validated
implementation references; that approval does not extend to other modes.

## Decision

JP Solo score yield and event-point yield are **approved / community-validated**
as formula behavior. The current viewer still lacks some user-deck and live
inputs needed to calculate personalized yields; missing inputs must not be
approximated or treated as zero. This formula approval does not validate or
enable any other mode.

The approved formulas apply only to JP Solo:

```text
score = floor((base_score + Σ(skill_score_solo[i] * effective_skill_rate[i] / 100)) * deck_power * 4)

event points = floor((100 + floor(live_score / 20000)) * (event_rate / 100) * (1 + deck_bonus / 100)) * boost_multiplier
```

The formula basis is the Moesekai `re_sekai-calculator` community reference
implementation (`live-calculator.ts`, `event-calculator.ts`) and its
deterministic tests. Use `formulaVersion: "jp-solo-community-v1"` and record the
reference revision used by the implementation (the audited local revision is
`c438c6bb6178ec008871db73f5013bd4fcf3abae`). Those tests make the calculation
reproducible; they are not independent in-game observations. Independent game
sampling is not a JP Solo enablement gate. Keep the following boundaries when
implementing the formulas:

- Apply the score `floor` only after the full score expression; do not round
  individual skill contributions or intermediate products.
- Solo has no additional active-bonus term in the score formula.
- For the default Solo allocation, sort card skill effects by score-up value and
  sort the first `cardLength` music coefficients by value, then multiply the
  resulting positions as the reference implementation does. If a complete
  explicit skill sequence is supplied, preserve that sequence and do not reorder
  it or reassign its rates.
- For event points, preserve the nested `floor(live_score / 20000)` and the
  outer `floor` before multiplying by `boost_multiplier`; do not reorder or
  combine the rounding steps.

Mode status is summarized below; all modes other than JP Solo remain
**blocked / unverified**:

| Mode              | Score yield                    | Event-point yield              | Current reason                                                                                   |
| ----------------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| JP Solo           | Approved / community-validated | Approved / community-validated | Moesekai reference formulas and deterministic tests; complete runtime inputs are still required. |
| Auto              | Unverified                     | Unverified                     | No Auto-specific score inputs or validated formula implementation.                               |
| Multi             | Unverified                     | Unverified                     | No live-result inputs, skill arrays, or validated multi formula.                                 |
| Challenge         | Unverified                     | Unverified                     | No challenge-result contract or validated mode formula.                                          |
| Cheerful Carnival | Unverified                     | Unverified                     | Event type is represented, but its live-result and bonus semantics are not validated.            |
| World Bloom       | Unverified                     | Unverified                     | Tracker chapter metadata exists, but no chapter yield/bonus calculation evidence exists.         |

This status is intentional. Difficulty, note count, tracker score, `eventPointIcon`,
or an unverified duration field must not be presented as a calculated yield.

## Approved Music Meta Input for #385

The user has approved licensed, externally supplied `music_metas.json` as a
coefficient input. The planned Music Recommender defaults to the self-hosted
k3s/SeaweedFS URL
`https://storage.sekai.best/sekai-best-assets/music_metas.json`; its future UI
must offer an explicit switch to the external Moesekai URL
`https://moe.exmeaning.com/data/music_meta/music_metas.json`. A failed source
must not silently select the other one. Show the selected source and the
revision/hash used with results, and recalculate when the user changes source.

Both endpoints returned 3,727 records on 2026-09-25. Sorting by song and
difficulty and hashing only the shared score-input fields yielded the same
SHA-256, `7875548d5da4b1b5ee65f2671d61126dcc660ee32b371596f48214a7ed96e01e`.
This is a point-in-time comparison, not a guarantee of future equivalence.
Validate identifiers, coefficient types, all three six-element skill arrays,
completeness, freshness, and revision on each selected source; ignore the
external CDN's preset-team score/PT/ranking fields as yield evidence. The
historical Moesekai fallback `metadata.pjsk.moe` returned 404 and is not an
available source. Team Haruki consumes caller-supplied metas rather than
specifying a CDN. See the workspace-root
`docs/game-data-knowledge/calculations.md` for the provenance audit; this
section records only the tools-site source choice.

Neither CDN data nor the source selector validates a formula by itself; the
Moesekai community reference implementation and deterministic tests are the
formula basis for JP Solo. The selected source, URL, revision/hash, and validated
inputs must still be recorded. Other modes remain blocked until they have their
own mode-specific evidence. The selector belongs to #381, not Tracker.

## Current Contract Audit

| Required input                              | Current evidence                                                                                                                                                                                                                      | Status                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Region-scoped event identity and timestamps | `apps/tools-site/src/lib/server/event-catalog.ts:10-40,77-91` exposes event ID/name and start, aggregate, and close timestamps.                                                                                                       | Available for context only; not a yield formula version.                                            |
| Tracker score/rank records                  | `packages/sekai-api-sdk/src/types.gen.ts:43-97,99-125` contains ranking scores, ranks, and user-card/ranking data.                                                                                                                    | Available as observed ranking data; not score coefficients or a live-yield contract.                |
| Event deck/card/rarity bonus definitions    | `packages/sekai-master-api-sdk/src/types.gen.ts:282-304` and `apps/content-site/src/lib/server/event-detail.ts:146-208` expose/parse parts of event bonus data.                                                                       | Partial; display-oriented data is not proven sufficient for a user-specific deck calculation.       |
| User deck state                             | No current tools-site yield model or contract was found.                                                                                                                                                                              | Missing. Ownership, training, skill, leader, and support state cannot be inferred from master data. |
| Base score coefficients                     | No matching fields were found in the current music SDK model.                                                                                                                                                                         | Missing.                                                                                            |
| Live-type skill score arrays and Fever data | No matching fields or tools-site calculation path were found.                                                                                                                                                                         | Missing.                                                                                            |
| Song `event_rate`                           | No matching field or equivalent yield-rate value was found.                                                                                                                                                                           | Missing.                                                                                            |
| Energy/stamina semantics                    | No current yield input or calculation contract was found.                                                                                                                                                                             | Missing.                                                                                            |
| Yield duration semantics                    | Event timestamps exist, but no per-live yield duration semantics were found.                                                                                                                                                          | Missing.                                                                                            |
| Formula/data version                        | `apps/tools-site/src/routes/+layout.server.ts:24` exposes the site package version; the Master API SDK exposes region version operations in `packages/sekai-master-api-sdk/src/sdk.gen.ts:446-453`. Neither is a yield-model version. | Missing for yield calculations.                                                                     |

The existing World Bloom code only groups, de-duplicates, and orders chapter
metadata (`apps/tools-site/src/lib/server/world-bloom.ts:16-28,66-85,103-123`).
World Bloom tracker tests cover chapter loading and UI, not production or bonus
calculation (`apps/tools-site/src/routes/tracker-loader.test.ts:269`,
`apps/tools-site/src/routes/tracker-page-ui.test.ts:214,274`).

## Historical Reference Boundary

The legacy calculator is useful for identifying candidate inputs, but it is not
evidence that its formulas remain correct for every region, event version, or
mode. The JP Solo formulas approved above are based on the Moesekai community
reference implementation and deterministic tests; they do not require an
independent game-result vector. Other mode-specific constants and rounding
behavior still require their own evidence before reuse. The legacy music
recommender computes per-song results for a fixed deck and returns provider
order; it does not sort by yield or plan cumulative targets.

The following legacy fields are therefore **candidate requirements**, not
current contracts:

- `base_score` / `base_score_auto`
- live-type skill score arrays
- `fever_score`
- `event_rate`
- calculated deck power, card skill state, leader/support bonuses
- live-result inputs for Multi, Challenge, and Cheerful

Do not fill missing values with zero, infer them from note count, or silently
apply the legacy defaults for other-player scores or life.

## Validation Vector Schema

Every future vector must preserve the source value and evidence for every input.
For JP Solo, the expected formula status is `community-validated` based on the
Moesekai reference implementation and deterministic tests; an in-game observed
value is not required. Other modes remain `unverified` until their own
mode-specific authoritative contract or reproducible evidence is attached.

```json
{
  "vectorId": "V0",
  "region": "jp",
  "eventId": null,
  "eventType": null,
  "liveMode": "solo",
  "auto": false,
  "songId": null,
  "difficulty": null,
  "deck": {
    "source": "manual|user-data|contract",
    "members": [],
    "leader": null,
    "support": [],
    "eventBonus": null
  },
  "liveInputs": {},
  "bonusInputs": {},
  "energyInputs": {},
  "sourceRevision": null,
  "formulaVersion": "jp-solo-community-v1",
  "expected": {
    "score": { "value": null, "status": "community-validated" },
    "eventPoints": { "value": null, "status": "community-validated" }
  },
  "observed": null,
  "tolerance": null,
  "evidence": [],
  "assumptions": [],
  "missingFields": []
}
```

The example is a JP Solo template: its formula status is approved, while values
remain null until the vector has complete inputs. A JP Solo vector becomes
eligible for an enabled metric when it has:

1. A region and event/version scope.
2. A complete set of required inputs with units and provenance.
3. A reproducible expected result from the approved JP Solo formula; an
   independently observed game result is not required.
4. A documented formula version and rounding order.
5. A deterministic test that fails when a required input or formula branch is
   changed.

For every other mode, its vector remains unverified until its own authoritative
contract or reproducible mode-specific evidence and expected result are
available.

## Minimum Validation Matrix

Use a fixed baseline and change one variable at a time. For JP Solo, compute
expectations with the approved community formula and fixed inputs; do not infer
expectations for other modes from the Solo or legacy implementation.

| Vector                   | Purpose                                                                                 | Required evidence before passing                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| V0: JP Solo, no bonus    | Baseline score/yield path.                                                              | Complete JP Solo inputs and deterministic expected results from the approved formula; no game observation required. |
| V1: Solo + Auto          | Detect Auto-specific behavior.                                                          | Auto-specific inputs, formula, and its own reproducible or authoritative result.                                    |
| V2: Multi                | Validate other-player/live-result contribution and rounding.                            | Complete multi result inputs and mode-specific boundary vectors.                                                    |
| V3: Challenge            | Validate the dedicated challenge path and limits.                                       | Challenge result contract and mode-specific boundary vectors.                                                       |
| V4: Cheerful Carnival    | Validate event-mode compatibility, team/bonus, other-player result, and life semantics. | Event-scoped evidence and reproducible live results for this mode.                                                  |
| V5a: World Bloom event   | Validate ordinary event context separately from chapter metadata.                       | Event bonus/progression evidence for this mode.                                                                     |
| V5b: World Bloom chapter | Validate whether chapter selection changes yield or only ranking context.               | Explicit chapter bonus contract or a documented no-effect result.                                                   |

Each vector should be repeated for every region/event-version combination that
will be exposed. A passing vector in one region does not authorize a formula in
another region.

## Required Data Contract If Validation Finds Missing Fields

If authoritative yield inputs are absent, the next implementation task is an
API/data-contract change, not a tools-site UI approximation. The contract must
identify, at minimum:

- region and event/formula version;
- song and difficulty identifiers;
- base score and mode-specific skill/Fever inputs;
- event rate and event/card/deck bonus semantics;
- units and rounding order;
- duration and energy semantics if efficiency metrics are supported;
- provenance and freshness/version metadata;
- explicit unsupported-mode and missing-data behavior.

If the result is calculated by `sekai-master-api`, the OpenAPI/SDK integration
workflow must be followed. If raw calculation data is returned instead, the
versioned calculation library must remain separately tested and auditable.

## Exit Criteria for #380

Issue #380 can unblock the single-song recommendation work independently for an
explicitly limited set of modes and metrics. For JP Solo, the approved
community-validated formula and deterministic tests can satisfy the formula
evidence; an independent game-result vector is not required. Other modes need
their own evidence before they can be included. For each enabled mode/metric:

- the required fields have a validated source and the formula has
  mode-appropriate evidence (the approved Moesekai community reference and
  deterministic tests for JP Solo; mode-specific evidence for all others);
- region/event/formula compatibility is documented;
- fixed vectors have complete inputs and deterministic expected values; an
  observed game value is required only where that mode's evidence requires it;
- rounding, bonus, duration, and energy semantics are tested;
- missing, stale, partial, and unsupported data states are defined;
- any missing contract work is split into a linked API issue.

Until these criteria are met for a specific mode, #381 must not display
personalized or precise-looking recommendations for that mode, and #382 must
not produce exact or optimal cumulative plans for it. JP Solo formula approval
does not supply missing user-deck inputs or by itself enable a feature before
those inputs and deterministic tests are implemented.
