import { describe, expect, it } from "vitest";
import {
  LEAST_OVERSHOOT_MAX_DEFICIT_SPAN,
  LEAST_OVERSHOOT_MAX_SEARCH_WORK,
  searchLeastOvershootWithoutRepeats,
  searchLeastOvershootWithRepeats,
  type LeastOvershootOutcome
} from "#lib/least-overshoot-search.js";

type Answer = { total: number; plays: number } | "plays-limit" | "unreachable";

const NONE = Number.MAX_SAFE_INTEGER;

/** The first sum at or above `need` whose fewest plays fit, from a full table of every sum. */
const readTable = (fewest: readonly number[], need: number, budget: number): Answer => {
  let reachable = false;
  for (let total = need; total < fewest.length; total += 1) {
    if (fewest[total] === NONE) continue;
    reachable = true;
    if (fewest[total] <= budget) return { total, plays: fewest[total] };
  }
  return reachable ? "plays-limit" : "unreachable";
};

const tableWithRepeats = (yields: readonly number[], need: number, budget: number): Answer => {
  const fewest = new Array<number>(need + Math.max(...yields) + 1).fill(NONE);
  fewest[0] = 0;
  for (let sum = 1; sum < fewest.length; sum += 1) {
    for (const amount of yields) {
      if (amount <= sum && fewest[sum - amount] + 1 < fewest[sum]) {
        fewest[sum] = fewest[sum - amount] + 1;
      }
    }
  }
  return readTable(fewest, need, budget);
};

const tableWithoutRepeats = (rows: readonly number[], need: number, budget: number): Answer => {
  const fewest = new Array<number>(need + Math.max(...rows) + 1).fill(NONE);
  fewest[0] = 0;
  for (const amount of rows) {
    for (let sum = fewest.length - 1; sum >= amount; sum -= 1) {
      if (fewest[sum - amount] + 1 < fewest[sum]) fewest[sum] = fewest[sum - amount] + 1;
    }
  }
  return readTable(fewest, need, budget);
};

const answerOf = (outcome: LeastOvershootOutcome): Answer => {
  if (outcome.status === "exceeded") throw new Error(JSON.stringify(outcome.bound));
  if (outcome.status !== "solved") return outcome.status;
  let total = 0;
  let plays = 0;
  for (const [value, count] of outcome.playsByYield) {
    expect(count).toBeGreaterThan(0);
    total += value * count;
    plays += count;
  }
  return { total, plays };
};

const makeRandom = (seed: number) => {
  let state = seed;
  return (min: number, max: number): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return min + Math.floor((state / 4294967296) * (max - min + 1));
  };
};

/** Spreads that exercise the exact shortcuts, the full tables, shared factors, and no solution. */
const drawYields = (int: (min: number, max: number) => number, count: number): number[] => {
  const shape = int(0, 3);
  const factor = shape === 2 ? int(2, 12) : 1;
  const low = shape === 0 ? int(1, 5) : int(50, 400);
  const width = shape === 1 ? int(1, 60) : int(20, 400);
  return Array.from({ length: count }, () => (low + int(0, width)) * factor);
};

describe("least-overshoot search against a full table", () => {
  it("matches with repeats", () => {
    const int = makeRandom(20261106);
    const seen = { exact: 0, inexact: 0, limit: 0 };
    for (let round = 0; round < 2_500; round += 1) {
      const yields = [...new Set(drawYields(int, int(1, 40)))];
      const need = int(1, 6_000);
      const budget = int(1, 60);
      const expected = tableWithRepeats(yields, need, budget);
      const actual = answerOf(searchLeastOvershootWithRepeats(yields, need, budget));
      expect(actual, JSON.stringify({ yields, need, budget })).toEqual(expected);
      if (typeof expected === "string") seen.limit += 1;
      else if (expected.total === need) seen.exact += 1;
      else seen.inexact += 1;
    }
    expect(seen.exact).toBeGreaterThan(300);
    expect(seen.inexact).toBeGreaterThan(300);
    expect(seen.limit).toBeGreaterThan(100);
  });

  it("matches without repeats, including rows that share a yield", () => {
    const int = makeRandom(20261107);
    const seen = { exact: 0, inexact: 0, limit: 0, unreachable: 0 };
    for (let round = 0; round < 2_500; round += 1) {
      const rows = drawYields(int, int(1, 16));
      const need = int(1, 3_000);
      const budget = int(1, 16);
      const expected = tableWithoutRepeats(rows, need, budget);
      const actual = answerOf(searchLeastOvershootWithoutRepeats(rows, need, budget));
      expect(actual, JSON.stringify({ rows, need, budget })).toEqual(expected);
      if (expected === "plays-limit") seen.limit += 1;
      else if (expected === "unreachable") seen.unreachable += 1;
      else if (expected.total === need) seen.exact += 1;
      else seen.inexact += 1;
    }
    expect(seen.exact).toBeGreaterThan(100);
    expect(seen.inexact).toBeGreaterThan(300);
    expect(seen.limit).toBeGreaterThan(50);
    expect(seen.unreachable).toBeGreaterThan(50);
  });

  it("keeps the plan with fewer plays when more plays only tie its total", () => {
    const outcome = searchLeastOvershootWithoutRepeats([101, 71, 30, 20], 99, 4);
    expect(answerOf(outcome)).toEqual({ total: 101, plays: 1 });
  });

  it("searches yields with a shared factor at that factor's scale", () => {
    const outcome = searchLeastOvershootWithRepeats(
      [10_000_000_000, 5_000_000_000],
      12_300_000_000,
      9
    );
    expect(answerOf(outcome)).toEqual({ total: 15_000_000_000, plays: 2 });
  });

  it("never plays a row more often than it exists", () => {
    const outcome = searchLeastOvershootWithoutRepeats([100, 100, 90], 280, 3);
    expect(outcome).toEqual({
      status: "solved",
      playsByYield: new Map([
        [100, 2],
        [90, 1]
      ])
    });
  });
});

describe("least-overshoot search on yields shaped like the real score data", () => {
  // Thousands of nearly all distinct yields of about two million: no sum table can hold this.
  const int = makeRandom(545);
  const rows = Array.from({ length: 3_800 }, () => int(1_450_000, 2_000_000));
  const distinct = [...new Set(rows)];

  it.each([12_345_678, 30_000_000, 55_555_555, 1_000_000_000])(
    "proves a plan for %i with repeats at the fewest possible plays",
    (need) => {
      const answer = answerOf(searchLeastOvershootWithRepeats(distinct, need, 10_000));
      expect(answer).toEqual({ total: need, plays: Math.ceil(need / Math.max(...distinct)) });
    }
  );

  it.each([12_345_678, 30_000_000, 55_555_555])(
    "finds an exact total for %i without repeats",
    (need) => {
      const answer = answerOf(searchLeastOvershootWithoutRepeats(rows, need, 10_000));
      expect(answer).toMatchObject({ total: need });
    }
  );
});

describe("least-overshoot search bounds", () => {
  it("refuses a deficit range too wide to table", () => {
    const outcome = searchLeastOvershootWithRepeats([10_000_000_000, 1], 5_000_000_000, 10_000);
    expect(outcome).toEqual({
      status: "exceeded",
      bound: {
        name: "deficitSpan",
        limit: LEAST_OVERSHOOT_MAX_DEFICIT_SPAN,
        actual: 5_000_000_000
      }
    });
  });

  // All yields are odd, so an even number of plays can never make an odd total: nothing closes
  // the search early, and it has to rule out every combination before it may answer.
  const oddYields = Array.from({ length: 3_000 }, (_, index) => 2_000_001 - index * 200);

  it("refuses a search with repeats that needs too much work", () => {
    const need = 2_000_001 * 16 - 1_500_001;
    const outcome = searchLeastOvershootWithRepeats(oddYields, need, 10_000);
    expect(outcome).toMatchObject({
      status: "exceeded",
      bound: { name: "searchWork", limit: LEAST_OVERSHOOT_MAX_SEARCH_WORK }
    });
  });

  it("refuses a search without repeats that needs too much work", () => {
    const need = 31_976_016 - 100_001;
    const outcome = searchLeastOvershootWithoutRepeats(oddYields, need, 10_000);
    expect(outcome).toMatchObject({
      status: "exceeded",
      bound: { name: "searchWork", limit: LEAST_OVERSHOOT_MAX_SEARCH_WORK }
    });
  });
});
