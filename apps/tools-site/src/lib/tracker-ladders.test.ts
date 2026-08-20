import { describe, expect, it } from "vitest";
import { CRITICAL_RANK_LADDER, FULL_RANK_LADDER, getTrackerRankLadder } from "./tracker-ladders";

describe("tracker rank ladders", () => {
  it("preserves the legacy full and misspelled-critical rank values", () => {
    expect(FULL_RANK_LADDER).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10_000, 20_000, 30_000, 40_000, 50_000, 100_000]);
    expect(CRITICAL_RANK_LADDER).toEqual([1, 2, 3, 10, 100, 1000, 5000, 10_000, 50_000, 100_000]);
    expect(getTrackerRankLadder("critical")).toBe(CRITICAL_RANK_LADDER);
    expect(getTrackerRankLadder("full")).toBe(FULL_RANK_LADDER);
  });
});
