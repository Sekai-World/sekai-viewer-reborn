# Tools-Site Yield Validation

This document records the evidence boundary for issue #380. It is a
prerequisite for any tools-site feature that recommends songs by expected score
or event points. It does not define a current-game formula where the repository
has no authoritative evidence.

## Decision

No yield metric is enabled by the current viewer contracts. The repository can
display tracker scores and event bonus data, but it cannot currently calculate
or validate a per-song score or event-point yield for a user deck.

The following modes are therefore **blocked / unverified**:

| Mode              | Score yield | Event-point yield | Current reason                                                                           |
| ----------------- | ----------- | ----------------- | ---------------------------------------------------------------------------------------- |
| Solo              | Unverified  | Unverified        | No score coefficients or validated formula implementation.                               |
| Auto              | Unverified  | Unverified        | No Auto-specific score inputs or validated formula implementation.                       |
| Multi             | Unverified  | Unverified        | No live-result inputs, skill arrays, or validated multi formula.                         |
| Challenge         | Unverified  | Unverified        | No challenge-result contract or validated mode formula.                                  |
| Cheerful Carnival | Unverified  | Unverified        | Event type is represented, but its live-result and bonus semantics are not validated.    |
| World Bloom       | Unverified  | Unverified        | Tracker chapter metadata exists, but no chapter yield/bonus calculation evidence exists. |

This status is intentional. Difficulty, note count, tracker score, `eventPointIcon`,
or an unverified duration field must not be presented as a calculated yield.

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
evidence that those formulas remain correct for every current region or event
version. Its music recommender computes per-song results for a fixed deck and
returns provider order; it does not sort by yield or plan cumulative targets.
Its event calculator contains mode-specific constants and rounding behavior,
but those values require independent validation before reuse.

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
The expected value remains `unverified` until an authoritative or reproducible
source is attached.

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
  "formulaVersion": null,
  "expected": {
    "score": { "value": null, "status": "unverified" },
    "eventPoints": { "value": null, "status": "unverified" }
  },
  "observed": null,
  "tolerance": null,
  "evidence": [],
  "assumptions": [],
  "missingFields": []
}
```

The vector is deliberately not executable as a calculator fixture yet. A
vector becomes eligible for an enabled metric only when it has:

1. A region and event/version scope.
2. A complete set of required inputs with units and provenance.
3. An authoritative or reproducible observed result.
4. A documented formula version and rounding order.
5. An independent test that fails when a required input or formula branch is
   changed.

## Minimum Validation Matrix

Use a fixed baseline and change one variable at a time. Do not pre-populate
numeric expectations from the legacy implementation.

| Vector                   | Purpose                                                                                 | Required evidence before passing                                  |
| ------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| V0: Solo, no bonus       | Baseline score/yield path.                                                              | Complete score inputs and observed result.                        |
| V1: Solo + Auto          | Detect Auto-specific behavior.                                                          | Auto inputs and independent result.                               |
| V2: Multi                | Validate other-player/live-result contribution and rounding.                            | Complete multi result inputs and boundary vectors.                |
| V3: Challenge            | Validate the dedicated challenge path and limits.                                       | Challenge result contract and boundary vectors.                   |
| V4: Cheerful Carnival    | Validate event-mode compatibility, team/bonus, other-player result, and life semantics. | Event-scoped evidence and reproducible live results.              |
| V5a: World Bloom event   | Validate ordinary event context separately from chapter metadata.                       | Event bonus/progression evidence.                                 |
| V5b: World Bloom chapter | Validate whether chapter selection changes yield or only ranking context.               | Explicit chapter bonus contract or a documented no-effect result. |

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

Issue #380 can unblock the single-song recommendation work only after the
following are true for an explicitly limited set of modes and metrics:

- the required fields have an authoritative source;
- region/event/formula compatibility is documented;
- fixed vectors have observed and expected values;
- rounding, bonus, duration, and energy semantics are tested;
- missing, stale, partial, and unsupported data states are defined;
- any missing contract work is split into a linked API issue.

Until then, #381 must not display personalized or precise-looking farming
recommendations, and #382 must not produce exact or optimal cumulative plans.
