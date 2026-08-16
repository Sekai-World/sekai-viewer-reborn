import { describe, expect, it } from "vitest";
import { calculateRecentRate, calculateRecentRates, sortTrackerRatePoints } from "./tracker-rates";

const point = (timestamp: string, score: number) => ({ timestamp, score });
const target = point("2026-01-01T04:00:00Z", 400);

describe("tracker recent rates", () => {
  it("uses exact and prior-only baselines with actual elapsed time", () => {
    expect(calculateRecentRate([point("2026-01-01T03:00:00Z", 300)], target, 1)).toBe(100);
    expect(calculateRecentRate([point("2026-01-01T01:30:00Z", 100)], target, 1)).toBe(120);
  });
  it("returns null without a baseline", () => {
    expect(calculateRecentRate([point("2026-01-01T03:30:00Z", 300)], target, 1)).toBeNull();
  });
  it("sorts unsorted inputs", () => {
    const points = [point("2026-01-01T03:00:00Z", 300), point("2026-01-01T01:00:00Z", 100)];
    expect(sortTrackerRatePoints(points).map(({ score }) => score)).toEqual([100, 300]);
    expect(calculateRecentRate(points, target, 3)).toBe(100);
  });
  it("calculates both horizons for the selected target", () => {
    expect(calculateRecentRates([point("2026-01-01T00:00:00Z", 0), point("2026-01-01T01:00:00Z", 100)], target)).toEqual({ oneHour: 100, threeHours: 100 });
  });
});
