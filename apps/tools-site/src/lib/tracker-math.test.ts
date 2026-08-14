import { describe, expect, it } from "vitest";
import { calculateScorePerElapsedHour } from "./tracker-math";

describe("score per elapsed hour", () => {
  it("calculates a rate from valid score and elapsed time", () => {
    expect(calculateScorePerElapsedHour({ score: 900, elapsedMs: 30 * 60_000 })).toBe(1800);
  });

  it.each([null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects unavailable score %s", (score) => {
    expect(calculateScorePerElapsedHour({ score, elapsedMs: 1 })).toBeNull();
  });

  it.each([null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects unusable elapsed time %s", (elapsedMs) => {
    expect(calculateScorePerElapsedHour({ score: 1, elapsedMs })).toBeNull();
  });
});
