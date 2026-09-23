import { describe, expect, it, vi } from "vitest";
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
      startAt: "2025-12-31T23:30:00.000Z",
      getReward: (rank) => (rank === 10 ? { type: "gem" } : null)
    });

    expect(rows).toEqual([
      {
        ladderRank: 1,
        status: "unavailable",
        ranking: null,
        score: null,
        speedPerHour: null,
        reward: null,
        graphPoint: null
      },
      {
        ladderRank: 10,
        status: "available",
        ranking: { rank: 10, score: 600, userName: "Ten", timestamp: "2026-01-01T00:00:00.000Z" },
        score: 600,
        speedPerHour: 1200,
        reward: { type: "gem" },
        graphPoint: { rank: 10, score: 600, timestamp: "2026-01-01T00:00:00.000Z" }
      },
      {
        ladderRank: 100,
        status: "unavailable",
        ranking: null,
        score: null,
        speedPerHour: null,
        reward: null,
        graphPoint: null
      }
    ]);
  });

  it("does not make a graph point or speed from an unavailable score", () => {
    const [row] = createTrackerRows({
      ladderRanks: [1],
      rankings: [{ rank: 1, score: Number.NaN }],
      startAt: "2026-01-01T00:00:00.000Z"
    });
    expect(row).toMatchObject({
      status: "available",
      score: null,
      speedPerHour: null,
      graphPoint: null
    });
  });

  it("uses each ranking timestamp and rejects missing or invalid timestamps", () => {
    const rows = createTrackerRows({
      ladderRanks: [1, 10, 100, 1000],
      startAt: "2026-01-01T00:00:00.000Z",
      rankings: [
        { rank: 1, score: 600, timestamp: "2026-01-01T01:00:00.000Z" },
        { rank: 10, score: 600, timestamp: "2026-01-01T02:00:00.000Z" },
        { rank: 100, score: 600, timestamp: null },
        { rank: 1000, score: 600, timestamp: "not-a-timestamp" }
      ]
    });

    expect(rows[0]?.speedPerHour).toBe(600);
    expect(rows[1]?.speedPerHour).toBe(300);
    expect(rows[2]?.speedPerHour).toBeNull();
    expect(rows[3]?.speedPerHour).toBeNull();
  });

  it("keeps average speed stable when the wall clock advances", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));
      const input = {
        ladderRanks: [1],
        rankings: [{ rank: 1, score: 600, timestamp: "2026-01-01T01:00:00.000Z" }],
        startAt: "2026-01-01T00:00:00.000Z"
      };

      const before = createTrackerRows(input)[0]?.speedPerHour;
      vi.advanceTimersByTime(60 * 60_000);
      const after = createTrackerRows(input)[0]?.speedPerHour;

      expect(before).toBe(600);
      expect(after).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
