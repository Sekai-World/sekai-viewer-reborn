import { describe, expect, it } from "vitest";
import {
  SHORTEST_TIME_MAX_CELLS,
  SHORTEST_TIME_MAX_SPAN,
  SHORTEST_TIME_MAX_WORK,
  searchShortestTime,
  type ShortestTimeOutcome,
  type TimedRow
} from "#lib/shortest-time-search.js";

const row = (time: number, amount: number): TimedRow => ({ time, amount });

type Totals = { lives: number; time: number; amount: number };

const totalsOf = (rows: readonly TimedRow[], outcome: ShortestTimeOutcome): Totals => {
  if (outcome.status !== "solved") throw new Error(`expected a plan, got ${outcome.status}`);
  const totals = { lives: 0, time: 0, amount: 0 };
  for (const [index, plays] of outcome.playsByRow) {
    expect(plays).toBeGreaterThanOrEqual(1);
    totals.lives += plays;
    totals.time += plays * rows[index].time;
    totals.amount += plays * rows[index].amount;
  }
  return totals;
};

/** Every play count vector within the budget, independent of the search. */
const bruteForce = (rows: readonly TimedRow[], need: number, budget: number): Totals | null => {
  let best: Totals | null = null;
  const visit = (index: number, lives: number, time: number, amount: number): void => {
    if (index === rows.length) {
      if (amount < need) return;
      if (
        best === null ||
        time < best.time ||
        (time === best.time && amount > best.amount) ||
        (time === best.time && amount === best.amount && lives < best.lives)
      ) {
        best = { lives, time, amount };
      }
      return;
    }
    for (let count = 0; count <= budget - lives; count += 1) {
      visit(
        index + 1,
        lives + count,
        time + count * rows[index].time,
        amount + count * rows[index].amount
      );
    }
  };
  visit(0, 0, 0, 0);
  return best;
};

const makeRandom = (seed: number) => {
  let state = seed;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return {
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1))
  };
};

describe("searchShortestTime", () => {
  it("prefers many short lives when they are quicker than few long ones", () => {
    const rows = [row(10, 10), row(3, 4)];

    expect(totalsOf(rows, searchShortestTime(rows, 20, 10))).toEqual({
      lives: 5,
      time: 15,
      amount: 20
    });
  });

  it("falls back to longer lives when the lives budget rules the quickest plan out", () => {
    const rows = [row(10, 10), row(3, 4)];

    // Five short lives take 15; with four lives allowed the best is one long and three short.
    expect(totalsOf(rows, searchShortestTime(rows, 20, 4))).toEqual({
      lives: 4,
      time: 19,
      amount: 22
    });
    expect(totalsOf(rows, searchShortestTime(rows, 20, 2))).toEqual({
      lives: 2,
      time: 20,
      amount: 20
    });
  });

  it("reports the lives limit when even the largest row needs more lives", () => {
    expect(searchShortestTime([row(10, 10), row(3, 4)], 21, 2)).toEqual({ status: "plays-limit" });
    expect(searchShortestTime([row(5, 7)], 1, 0)).toEqual({ status: "plays-limit" });
  });

  it("returns the largest total among plans of the shortest time", () => {
    // Nothing reaches 7 in under 5; in 5, the two short rows make 7 and the long one makes 8.
    const rows = [row(2, 3), row(3, 4), row(5, 8)];

    expect(totalsOf(rows, searchShortestTime(rows, 7, 5))).toEqual({
      lives: 1,
      time: 5,
      amount: 8
    });
  });

  it("keeps the largest total when more lives reach the same time under a lives limit", () => {
    // Unlimited, 15 lives of the first row take 15. With five lives the best time is 16, reached
    // by four lives for 32 and by five lives for 30.
    const rows = [row(1, 2), row(4, 8), row(3, 4)];

    expect(totalsOf(rows, searchShortestTime(rows, 29, 5))).toEqual({
      lives: 4,
      time: 16,
      amount: 32
    });
    expect(totalsOf(rows, searchShortestTime(rows, 29, 100)).time).toBe(15);
  });

  it("never plays a row that another beats on time and amount", () => {
    const rows = [row(5, 3), row(5, 9), row(4, 9), row(9, 9)];
    const outcome = searchShortestTime(rows, 50, 20);

    expect(outcome.status === "solved" ? [...outcome.playsByRow.keys()] : []).toEqual([2]);
    expect(totalsOf(rows, outcome)).toEqual({ lives: 6, time: 24, amount: 54 });
  });

  it("uses the first of equal rows and ignores the input order of the rest", () => {
    const rows = [row(7, 5), row(3, 2), row(3, 2), row(7, 5)];
    const outcome = searchShortestTime(rows, 12, 10);
    const reversed = searchShortestTime([...rows].reverse(), 12, 10);

    expect(outcome.status === "solved" ? [...outcome.playsByRow.keys()].sort() : []).toEqual([
      0, 1
    ]);
    expect(totalsOf(rows, outcome)).toEqual(totalsOf([...rows].reverse(), reversed));
  });

  it("matches exhaustive search on random small problems", () => {
    const random = makeRandom(20261114);
    let solvedCases = 0;
    let budgetBound = 0;
    let limitCases = 0;

    for (let round = 0; round < 6_000; round += 1) {
      const rows = Array.from({ length: random.int(1, 5) }, () =>
        row(random.int(1, 14), random.int(1, 14))
      );
      const need = random.int(1, 60);
      const budget = random.int(0, 7);
      const label = JSON.stringify({ rows, need, budget });

      const oracle = bruteForce(rows, need, budget);
      const outcome = searchShortestTime(rows, need, budget);
      if (oracle === null) {
        expect(outcome, label).toEqual({ status: "plays-limit" });
        limitCases += 1;
        continue;
      }
      const totals = totalsOf(rows, outcome);
      expect(totals.lives, label).toBeLessThanOrEqual(budget);
      expect(totals.amount, label).toBeGreaterThanOrEqual(need);
      expect({ time: totals.time, amount: totals.amount }, label).toEqual({
        time: oracle.time,
        amount: oracle.amount
      });
      solvedCases += 1;

      // With no lives limit the plan may be quicker; then the limit decided this answer.
      const free = totalsOf(rows, searchShortestTime(rows, need, 1_000));
      if (free.time < totals.time) budgetBound += 1;
    }

    expect(solvedCases).toBeGreaterThan(3_000);
    expect(budgetBound).toBeGreaterThan(200);
    expect(limitCases).toBeGreaterThan(300);
  });

  it("matches exhaustive search when the lives table needs two bytes per cell", () => {
    // 300 undominated rows with amount = time / 2 + 50, so more lives are quicker: a plan of k
    // lives reaching 1,000 takes at least 2 x (1,000 - 50k).
    const rows = Array.from({ length: 300 }, (_, index) => row(100 + 2 * index, 100 + index));
    const need = 1_000;

    expect(totalsOf(rows, searchShortestTime(rows, need, 4))).toEqual({
      lives: 4,
      time: 1_600,
      amount: 1_000
    });
    expect(totalsOf(rows, searchShortestTime(rows, need, 1_000))).toEqual({
      lives: 10,
      time: 1_000,
      amount: 1_000
    });
  });
});

describe("searchShortestTime bounds", () => {
  it("refuses a time span beyond the table", () => {
    const outcome = searchShortestTime([row(1_000, 1)], SHORTEST_TIME_MAX_SPAN / 1_000 + 1, 10_000);

    expect(outcome).toEqual({
      status: "exceeded",
      bound: {
        name: "timeSpan",
        limit: SHORTEST_TIME_MAX_SPAN,
        actual: SHORTEST_TIME_MAX_SPAN + 1_001
      }
    });
  });

  it("refuses more work than the limit", () => {
    // 400 undominated rows and a span of about 1,560,000 make over 600,000,000 row visits.
    const rows = Array.from({ length: 400 }, (_, index) => row(1_000 + index, 1_000 + 2 * index));
    const outcome = searchShortestTime(rows, 2_000_000, 10_000);

    expect(outcome).toMatchObject({
      status: "exceeded",
      bound: { name: "timeWork", limit: SHORTEST_TIME_MAX_WORK }
    });
  });

  it("refuses a lives table with too many cells", () => {
    // The quick row wins without a limit (2,000 lives); 1,999 lives force the lives table, whose
    // layers each span up to 1,999 x 9,000 time units.
    const rows = [row(1_000, 1_000), row(10_000, 1_001)];
    const need = 2_000_000;

    expect(totalsOf(rows, searchShortestTime(rows, need, 2_000))).toEqual({
      lives: 2_000,
      time: 2_000_000,
      amount: 2_000_000
    });
    expect(searchShortestTime(rows, need, 1_999)).toMatchObject({
      status: "exceeded",
      bound: { name: "timeCells", limit: SHORTEST_TIME_MAX_CELLS }
    });
  });
});
