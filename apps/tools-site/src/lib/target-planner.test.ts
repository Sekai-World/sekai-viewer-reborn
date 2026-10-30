import { describe, expect, it } from "vitest";
import { MUSIC_META_DIFFICULTIES } from "#lib/music-recommender.js";
import {
  PLANNER_MAX_SUM_SPAN,
  PLANNER_MAX_WORK,
  planTarget,
  type PlannerInput,
  type PlannerYield,
  type PlanResult,
  type TargetPlan
} from "#lib/target-planner.js";

const row = (
  musicId: number,
  difficulty: string,
  score: number,
  eventPoints: number = score
): PlannerYield => ({ musicId, difficulty, score, eventPoints });

const make = (overrides: Partial<PlannerInput> = {}): PlannerInput => ({
  yields: [row(1, "expert", 100)],
  metric: "score",
  target: 100,
  objective: "fewestPlays",
  maxPlays: 10,
  allowRepeats: true,
  ...overrides
});

const ready = (result: PlanResult): TargetPlan => {
  if (result.status !== "ready") throw new Error(`expected a plan, got ${JSON.stringify(result)}`);
  return result;
};

/** Re-derives every reported figure from the input rows, independent of the planner. */
const assertPlanMatchesInput = (plan: TargetPlan, input: PlannerInput): void => {
  const byKey = new Map(
    input.yields.map((entry) => [`${entry.musicId}:${entry.difficulty}`, entry])
  );
  let plays = 0;
  let total = 0;
  let score = 0;
  let eventPoints = 0;
  for (const item of plan.items) {
    const source = byKey.get(`${item.musicId}:${item.difficulty}`);
    expect(source).toBeDefined();
    expect(item.plays).toBeGreaterThanOrEqual(1);
    expect(item.yieldPerPlay).toBe(source?.[input.metric]);
    expect(item.subtotal).toBe(item.yieldPerPlay * item.plays);
    if (!input.allowRepeats) expect(item.plays).toBe(1);
    if (input.allowedDifficulties) expect(input.allowedDifficulties).toContain(item.difficulty);
    plays += item.plays;
    total += item.subtotal;
    score += (source?.score ?? 0) * item.plays;
    eventPoints += (source?.eventPoints ?? 0) * item.plays;
  }
  expect(plan.plays).toBe(plays);
  expect(plan.plays).toBeLessThanOrEqual(input.maxPlays);
  expect(plan.total).toBe(total);
  expect(plan.total).toBeGreaterThanOrEqual(input.target);
  expect(plan.overshoot).toBe(total - input.target);
  expect(plan.totals).toEqual({ score, eventPoints });
  for (const required of input.requiredSongs ?? []) {
    const item = plan.items.find(
      (candidate) =>
        candidate.musicId === required.musicId && candidate.difficulty === required.difficulty
    );
    expect(item?.required).toBe(true);
  }
  const ordered = [...plan.items].sort(
    (a, b) =>
      a.musicId - b.musicId ||
      MUSIC_META_DIFFICULTIES.indexOf(a.difficulty) - MUSIC_META_DIFFICULTIES.indexOf(b.difficulty)
  );
  expect(plan.items).toEqual(ordered);
};

describe("planTarget results", () => {
  it("plans a single live when one song reaches the target", () => {
    const input = make({ target: 90 });

    const plan = ready(planTarget(input));

    expect(plan).toMatchObject({ plays: 1, total: 100, overshoot: 10, objectiveValue: 1 });
    expect(plan.items).toEqual([
      {
        musicId: 1,
        difficulty: "expert",
        plays: 1,
        yieldPerPlay: 100,
        subtotal: 100,
        required: false
      }
    ]);
    assertPlanMatchesInput(plan, input);
  });

  it("repeats the best song for the fewest plays, ending on the smallest sufficient song", () => {
    const input = make({
      yields: [row(1, "expert", 100), row(2, "expert", 95), row(3, "expert", 60)],
      target: 190
    });

    const plan = ready(planTarget(input));

    expect(plan.plays).toBe(2);
    expect(plan.items.map(({ musicId, plays }) => [musicId, plays])).toEqual([
      [1, 1],
      [2, 1]
    ]);
    expect(plan.overshoot).toBe(5);
    assertPlanMatchesInput(plan, input);
  });

  it("repeats one song when it is the only candidate", () => {
    const input = make({ target: 250 });

    const plan = ready(planTarget(input));

    expect(plan.items).toEqual([
      {
        musicId: 1,
        difficulty: "expert",
        plays: 3,
        yieldPerPlay: 100,
        subtotal: 300,
        required: false
      }
    ]);
    expect(plan.overshoot).toBe(50);
  });

  it("finds an exact mix with zero overshoot for the least-overshoot objective", () => {
    const input = make({
      yields: [row(1, "expert", 100), row(2, "expert", 70)],
      target: 240,
      objective: "leastOvershoot"
    });

    const plan = ready(planTarget(input));

    expect(plan).toMatchObject({ overshoot: 0, plays: 3, objectiveValue: 0 });
    expect(plan.items.map(({ musicId, plays }) => [musicId, plays])).toEqual([
      [1, 1],
      [2, 2]
    ]);
    assertPlanMatchesInput(plan, input);
  });

  it("accepts a target that exactly equals the total", () => {
    const input = make({ target: 200, yields: [row(1, "expert", 100)] });

    expect(ready(planTarget(input))).toMatchObject({ plays: 2, overshoot: 0 });
  });

  it("plays each song at most once when repeats are not allowed", () => {
    const input = make({
      yields: [row(1, "expert", 100), row(2, "expert", 90), row(3, "expert", 80)],
      target: 250,
      allowRepeats: false
    });

    const plan = ready(planTarget(input));

    expect(plan.items.every((item) => item.plays === 1)).toBe(true);
    expect(plan).toMatchObject({ plays: 3, total: 270 });
    assertPlanMatchesInput(plan, input);
  });

  it("is unreachable when every song once still falls short", () => {
    const input = make({
      yields: [row(1, "expert", 100), row(2, "expert", 90), row(3, "expert", 80)],
      target: 280,
      allowRepeats: false
    });

    expect(planTarget(input)).toMatchObject({
      status: "unavailable",
      reason: "target-unreachable"
    });
    expect(planTarget({ ...input, objective: "leastOvershoot" })).toMatchObject({
      reason: "target-unreachable"
    });
  });

  it("separates the score and event-point metrics but reports both totals", () => {
    const yields = [row(1, "expert", 1_000, 10), row(2, "expert", 500, 40)];

    const byScore = ready(planTarget(make({ yields, metric: "score", target: 1_000 })));
    const byPoints = ready(planTarget(make({ yields, metric: "eventPoints", target: 40 })));

    expect(byScore.items.map((item) => item.musicId)).toEqual([1]);
    expect(byPoints.items.map((item) => item.musicId)).toEqual([2]);
    expect(byScore.totals).toEqual({ score: 1_000, eventPoints: 10 });
    expect(byPoints.totals).toEqual({ score: 500, eventPoints: 40 });
  });

  it("limits the candidates to the allowed difficulties", () => {
    const input = make({
      yields: [row(1, "expert", 100), row(1, "master", 300), row(2, "master", 280)],
      target: 100,
      allowedDifficulties: ["expert"]
    });

    const plan = ready(planTarget(input));

    expect(plan.items.map((item) => item.difficulty)).toEqual(["expert"]);
    assertPlanMatchesInput(plan, input);
  });
});

describe("planTarget constraints", () => {
  it("includes required songs and counts them in the plays", () => {
    const input = make({
      yields: [row(1, "expert", 30), row(2, "expert", 60)],
      target: 100,
      requiredSongs: [{ musicId: 1, difficulty: "expert" }]
    });

    const plan = ready(planTarget(input));

    // 30 (required) + 60 leaves 10 short of 100, and the smallest sufficient yield is song 1 again.
    expect(plan.items.find((item) => item.musicId === 1)).toMatchObject({
      plays: 2,
      required: true
    });
    expect(plan).toMatchObject({ plays: 3, total: 120 });
    assertPlanMatchesInput(plan, input);
  });

  it("returns only the required songs when they already reach the target", () => {
    const input = make({
      yields: [row(1, "expert", 80), row(2, "expert", 60)],
      target: 100,
      objective: "leastOvershoot",
      requiredSongs: [
        { musicId: 1, difficulty: "expert" },
        { musicId: 2, difficulty: "expert" }
      ]
    });

    const plan = ready(planTarget(input));

    expect(plan).toMatchObject({ plays: 2, total: 140, overshoot: 40 });
  });

  it("does not replay a required song when repeats are not allowed", () => {
    const input = make({
      yields: [row(1, "expert", 50), row(2, "expert", 30)],
      target: 80,
      allowRepeats: false,
      requiredSongs: [{ musicId: 1, difficulty: "expert" }]
    });

    const plan = ready(planTarget(input));

    expect(plan.items.map((item) => [item.musicId, item.plays])).toEqual([
      [1, 1],
      [2, 1]
    ]);
  });

  it("refuses when the required songs alone exceed the plays limit", () => {
    const result = planTarget(
      make({
        yields: [row(1, "expert", 10), row(2, "expert", 10)],
        maxPlays: 1,
        requiredSongs: [
          { musicId: 1, difficulty: "expert" },
          { musicId: 2, difficulty: "expert" }
        ]
      })
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "plays-limit" });
  });

  it.each(["fewestPlays", "leastOvershoot"] as const)(
    "refuses a %s plan that needs more plays than allowed",
    (objective) => {
      const result = planTarget(make({ target: 1_000, maxPlays: 5, objective }));

      expect(result).toMatchObject({ status: "unavailable", reason: "plays-limit" });
    }
  );

  it("treats a required song that is not a candidate as unavailable", () => {
    const missing = planTarget(make({ requiredSongs: [{ musicId: 9, difficulty: "expert" }] }));
    const filtered = planTarget(
      make({
        yields: [row(1, "expert", 100), row(1, "master", 200)],
        allowedDifficulties: ["expert"],
        requiredSongs: [{ musicId: 1, difficulty: "master" }]
      })
    );

    expect(missing).toMatchObject({ status: "unavailable", reason: "required-unavailable" });
    expect(filtered).toMatchObject({ status: "unavailable", reason: "required-unavailable" });
  });

  it("reports no candidates when nothing is eligible", () => {
    expect(planTarget(make({ yields: [] }))).toMatchObject({ reason: "no-candidates" });
    expect(planTarget(make({ allowedDifficulties: [] }))).toMatchObject({
      reason: "no-candidates"
    });
  });

  it("is unreachable when repeats are off and only required songs exist", () => {
    const result = planTarget(
      make({
        target: 500,
        allowRepeats: false,
        requiredSongs: [{ musicId: 1, difficulty: "expert" }]
      })
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "target-unreachable" });
  });
});

describe("planTarget determinism", () => {
  it.each(["fewestPlays", "leastOvershoot"] as const)(
    "returns the same %s plan whatever the input order",
    (objective) => {
      const yields = [
        row(3, "expert", 100),
        row(1, "master", 100),
        row(1, "expert", 100),
        row(2, "expert", 70),
        row(4, "hard", 70)
      ];
      const input = make({ yields, target: 340, objective });
      const baseline = planTarget(input);

      for (const order of [
        [...yields].reverse(),
        [yields[2], yields[0], yields[4], yields[1], yields[3]]
      ]) {
        expect(planTarget({ ...input, yields: order })).toEqual(baseline);
      }
    }
  );

  it("breaks ties between equal yields by the lowest song id, then difficulty", () => {
    const plan = ready(
      planTarget(
        make({
          yields: [row(7, "expert", 100), row(2, "master", 100), row(2, "expert", 100)],
          target: 100
        })
      )
    );

    expect(plan.items.map((item) => [item.musicId, item.difficulty])).toEqual([[2, "expert"]]);
  });

  it("does not mutate its input", () => {
    const input = make({
      yields: [row(2, "expert", 70), row(1, "expert", 100)],
      requiredSongs: [{ musicId: 2, difficulty: "expert" }],
      allowedDifficulties: ["expert"]
    });
    const snapshot = JSON.stringify(input);

    planTarget(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("planTarget invalid input", () => {
  it.each([
    ["a zero target", { target: 0 }, "target"],
    ["a fractional target", { target: 1.5 }, "target"],
    ["a target above the cap", { target: 200_000_000_000 }, "target"],
    ["zero plays", { maxPlays: 0 }, "maxPlays"],
    ["too many plays", { maxPlays: 10_001 }, "maxPlays"],
    ["an unknown metric", { metric: "time" as never }, "metric"],
    ["an unknown objective", { objective: "cheapest" as never }, "objective"],
    ["a non-boolean repeat flag", { allowRepeats: "yes" as never }, "allowRepeats"],
    [
      "an unknown allowed difficulty",
      { allowedDifficulties: ["extreme"] },
      "allowedDifficulties[0]"
    ],
    [
      "a malformed required song",
      { requiredSongs: [{ musicId: 0, difficulty: "expert" }] },
      "requiredSongs[0]"
    ],
    [
      "a duplicate required song",
      {
        requiredSongs: [
          { musicId: 1, difficulty: "expert" },
          { musicId: 1, difficulty: "expert" }
        ]
      },
      "requiredSongs[1].duplicate"
    ]
  ])("rejects %s", (_label, overrides, field) => {
    const result = planTarget(make(overrides as Partial<PlannerInput>));

    expect(result).toMatchObject({ status: "unavailable", reason: "invalid-input" });
    expect(result.status === "unavailable" && result.invalidFields).toContain(field);
  });

  it.each([
    ["a zero score", row(1, "expert", 0, 5), "yields[0].score"],
    ["a non-integer yield", row(1, "expert", 1.5, 5), "yields[0].score"],
    ["a zero event-point yield", row(1, "expert", 5, 0), "yields[0].eventPoints"],
    ["an unknown difficulty", row(1, "extreme", 5, 5), "yields[0].difficulty"],
    ["a missing song id", { ...row(1, "expert", 5, 5), musicId: 0 }, "yields[0].musicId"]
  ])("rejects a yield row with %s", (_label, entry, field) => {
    const result = planTarget(make({ yields: [entry] }));

    expect(result).toMatchObject({ status: "unavailable", reason: "invalid-input" });
    expect(result.status === "unavailable" && result.invalidFields).toContain(field);
  });

  it("rejects duplicate song and difficulty rows instead of picking one", () => {
    const result = planTarget(make({ yields: [row(1, "expert", 100), row(1, "expert", 90)] }));

    expect(result).toMatchObject({
      reason: "invalid-input",
      invalidFields: ["yields[1].duplicate"]
    });
  });
});

describe("planTarget bounds", () => {
  it("refuses a least-overshoot table wider than the supported sum span", () => {
    const result = planTarget(
      make({
        yields: [row(1, "expert", 1_000_000), row(2, "expert", 900_000)],
        target: 10_000_000,
        maxPlays: 100,
        objective: "leastOvershoot"
      })
    );

    expect(result).toMatchObject({
      status: "unavailable",
      reason: "out-of-bounds",
      bound: { name: "sumSpan", limit: PLANNER_MAX_SUM_SPAN }
    });
    expect(result.status === "unavailable" && result.bound?.actual).toBeGreaterThan(
      PLANNER_MAX_SUM_SPAN
    );
  });

  it("refuses a least-overshoot table with too much work", () => {
    const yields = Array.from({ length: 3_000 }, (_, index) =>
      row(index + 1, "expert", 1_000 + index)
    );

    const result = planTarget(
      make({ yields, target: 40_000, maxPlays: 100, objective: "leastOvershoot" })
    );

    expect(result).toMatchObject({
      reason: "out-of-bounds",
      bound: { name: "work", limit: PLANNER_MAX_WORK }
    });
  });

  it("still plans the fewest plays for targets far beyond the least-overshoot bounds", () => {
    const plan = ready(
      planTarget(
        make({
          yields: [row(1, "expert", 1_000_000), row(2, "expert", 900_000)],
          target: 9_000_000_000,
          maxPlays: 10_000
        })
      )
    );

    expect(plan.plays).toBe(9_000);
  });
});

/** Seeded PRNG so a failing random case can be reproduced. */
const makeRandom = (seed: number) => {
  let state = seed;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return {
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1)),
    chance: (probability: number): boolean => next() < probability
  };
};

type Oracle =
  | { feasible: true; plays: number; overshoot: number }
  | { feasible: false; reason: "plays-limit" | "target-unreachable" };

/** Exhaustive search over every legal play count vector, independent of the planner's solvers. */
const bruteForce = (input: PlannerInput): Oracle => {
  const allowed = input.allowedDifficulties;
  const candidates = input.yields.filter((entry) => !allowed || allowed.includes(entry.difficulty));
  const isRequired = (entry: PlannerYield): boolean =>
    (input.requiredSongs ?? []).some(
      (song) => song.musicId === entry.musicId && song.difficulty === entry.difficulty
    );
  const required = candidates.filter(isRequired);
  const pool = input.allowRepeats ? candidates : candidates.filter((entry) => !isRequired(entry));
  const requiredSum = required.reduce((sum, entry) => sum + entry[input.metric], 0);
  const freeBudget = input.maxPlays - required.length;
  // The plays limit is reported before reachability, as the planner does.
  if (freeBudget < 0) return { feasible: false, reason: "plays-limit" };

  let best: { plays: number; overshoot: number } | null = null;
  const consider = (plays: number, sum: number): void => {
    if (sum < input.target) return;
    const candidate = { plays: required.length + plays, overshoot: sum - input.target };
    const better =
      best === null ||
      (input.objective === "fewestPlays"
        ? candidate.plays < best.plays
        : candidate.overshoot < best.overshoot ||
          (candidate.overshoot === best.overshoot && candidate.plays < best.plays));
    if (better) best = candidate;
  };

  const visit = (index: number, plays: number, sum: number): void => {
    if (index === pool.length) {
      consider(plays, sum);
      return;
    }
    const amount = pool[index][input.metric];
    const maxCount = input.allowRepeats ? freeBudget - plays : Math.min(1, freeBudget - plays);
    for (let count = 0; count <= maxCount; count += 1) {
      visit(index + 1, plays + count, sum + count * amount);
    }
  };
  visit(0, 0, requiredSum);

  if (best !== null) return { feasible: true, ...(best as { plays: number; overshoot: number }) };
  const everything = requiredSum + pool.reduce((sum, entry) => sum + entry[input.metric], 0);
  const reachableWithoutLimit = input.allowRepeats ? pool.length > 0 : everything >= input.target;
  return { feasible: false, reason: reachableWithoutLimit ? "plays-limit" : "target-unreachable" };
};

describe("planTarget against exhaustive search", () => {
  it("matches the true optimum on random small problems", () => {
    const random = makeRandom(20261030);
    let feasibleCases = 0;
    let requiredCases = 0;
    let noRepeatCases = 0;

    for (let round = 0; round < 4_000; round += 1) {
      const songCount = random.int(1, 5);
      const used = new Set<string>();
      const yields: PlannerYield[] = [];
      while (yields.length < songCount) {
        const difficulty = MUSIC_META_DIFFICULTIES[random.int(0, 2)];
        const musicId = random.int(1, 3);
        if (used.has(`${musicId}:${difficulty}`)) continue;
        used.add(`${musicId}:${difficulty}`);
        yields.push(row(musicId, difficulty, random.int(1, 12), random.int(1, 12)));
      }
      const requiredSongs = yields
        .filter(() => random.chance(0.25))
        .slice(0, 2)
        .map(({ musicId, difficulty }) => ({ musicId, difficulty }));
      const input: PlannerInput = {
        yields,
        metric: random.chance(0.5) ? "score" : "eventPoints",
        target: random.int(1, 45),
        objective: random.chance(0.5) ? "fewestPlays" : "leastOvershoot",
        maxPlays: random.int(1, 6),
        allowRepeats: random.chance(0.5),
        allowedDifficulties: random.chance(0.3) ? ["easy", "normal"] : null,
        requiredSongs
      };
      const hasRequired = requiredSongs.some((song) =>
        yields.some(
          (entry) =>
            entry.musicId === song.musicId &&
            entry.difficulty === song.difficulty &&
            (!input.allowedDifficulties || input.allowedDifficulties.includes(entry.difficulty))
        )
      );
      const result = planTarget(input);
      if (
        result.status === "unavailable" &&
        ["no-candidates", "required-unavailable"].includes(result.reason)
      ) {
        continue;
      }

      const oracle = bruteForce(input);
      const label = JSON.stringify(input);
      if (!oracle.feasible) {
        expect(result, label).toMatchObject({ status: "unavailable", reason: oracle.reason });
        continue;
      }
      const plan = ready(result);
      feasibleCases += 1;
      if (hasRequired) requiredCases += 1;
      if (!input.allowRepeats) noRepeatCases += 1;
      assertPlanMatchesInput(plan, input);
      if (input.objective === "fewestPlays") {
        expect(plan.plays, label).toBe(oracle.plays);
      } else {
        expect(plan.overshoot, label).toBe(oracle.overshoot);
        expect(plan.plays, label).toBe(oracle.plays);
      }
    }

    expect(feasibleCases).toBeGreaterThan(1_500);
    expect(requiredCases).toBeGreaterThan(100);
    expect(noRepeatCases).toBeGreaterThan(500);
  });
});
