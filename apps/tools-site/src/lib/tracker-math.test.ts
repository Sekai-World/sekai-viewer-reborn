import { describe, expect, it } from "vitest";
import { calculateChapterElapsedMs, calculateScorePerElapsedHour } from "./tracker-math";

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

describe("chapter elapsed time", () => {
  const startAt = "2026-01-01T00:00:00.000Z";
  const endAt = "2026-01-02T00:00:00.000Z";

  it("uses now for the current chapter", () => {
    expect(
      calculateChapterElapsedMs({
        startAt,
        endAt,
        now: Date.parse("2026-01-01T06:00:00.000Z"),
        isCurrent: true
      })
    ).toBe(6 * 60 * 60_000);
  });

  it("uses one historical snapshot or chapter end for every rank", () => {
    expect(
      calculateChapterElapsedMs({
        startAt,
        endAt,
        now: Date.parse("2026-01-03T00:00:00.000Z"),
        isCurrent: false,
        snapshotAt: "2026-01-01T12:00:00.000Z"
      })
    ).toBe(12 * 60 * 60_000);
    expect(
      calculateChapterElapsedMs({ startAt, endAt, now: Date.now(), isCurrent: false })
    ).toBe(24 * 60 * 60_000);
  });

  it("accepts numeric Unix-second chapter timestamps", () => {
    expect(
      calculateChapterElapsedMs({
        startAt: 1_767_225_600,
        endAt: 1_767_312_000,
        now: Date.now(),
        isCurrent: false
      })
    ).toBe(24 * 60 * 60_000);
  });

  it("rejects invalid chapter metadata", () => {
    expect(
      calculateChapterElapsedMs({ startAt: "invalid", endAt, now: Date.now(), isCurrent: false })
    ).toBeNull();
  });
});
