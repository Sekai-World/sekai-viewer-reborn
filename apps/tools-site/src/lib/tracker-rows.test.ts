import { describe, expect, it } from "vitest";
import { createTrackerRows } from "./tracker-rows";

describe("tracker row models", () => {
  it("maps ladder ranks exactly and keeps unavailable ranks as typed placeholders", () => {
    const rows = createTrackerRows({
      ladderRanks: [1, 10, 100],
      rankings: [
        { rank: 10, score: 600, userName: "Ten", timestamp: "2026-01-01T00:00:00.000Z" },
        { rank: 10, score: 700, userName: "Duplicate" },
        { rank: 0, score: 50 }
      ],
      elapsedMs: 30 * 60_000,
      getReward: (rank) => (rank === 10 ? { type: "gem" } : null)
    });

    expect(rows).toEqual([
      { ladderRank: 1, status: "unavailable", ranking: null, score: null, speedPerHour: null, reward: null, graphPoint: null },
      { ladderRank: 10, status: "available", ranking: { rank: 10, score: 600, userName: "Ten", timestamp: "2026-01-01T00:00:00.000Z" }, score: 600, speedPerHour: 1200, reward: { type: "gem" }, graphPoint: { rank: 10, score: 600, timestamp: "2026-01-01T00:00:00.000Z" } },
      { ladderRank: 100, status: "unavailable", ranking: null, score: null, speedPerHour: null, reward: null, graphPoint: null }
    ]);
  });

  it("does not make a graph point or speed from an unavailable score", () => {
    const [row] = createTrackerRows({ ladderRanks: [1], rankings: [{ rank: 1, score: Number.NaN }], elapsedMs: 1 });
    expect(row).toMatchObject({ status: "available", score: null, speedPerHour: null, graphPoint: null });
  });
});
