import { describe, expect, it } from "vitest";
import { getTrackerChapterCountdown, getTrackerCountdown } from "./tracker-countdown";

describe("getTrackerCountdown", () => {
  const startAt = "2026-01-02T00:00:00.000Z";
  const aggregateAt = "2026-01-03T01:02:03.000Z";

  it("counts down to aggregation during a live event", () => {
    expect(getTrackerCountdown({ startAt, aggregateAt, closedAt: "2026-01-04T00:00:00.000Z", now: startAt })).toEqual({
      mode: "ends",
      values: { days: 1, hours: 1, minutes: 2, seconds: 3 }
    });
  });

  it("counts down to the event start before a current event begins", () => {
    expect(getTrackerCountdown({ startAt, aggregateAt, closedAt: null, now: "2026-01-01T23:59:58.000Z" })).toEqual({
      mode: "starts",
      values: { days: 0, hours: 0, minutes: 0, seconds: 2 }
    });
  });

  it("falls back to closedAt only when aggregateAt is absent", () => {
    expect(getTrackerCountdown({ startAt, aggregateAt: null, closedAt: "2026-01-02T01:00:00.000Z", now: startAt })).toEqual({
      mode: "ends",
      values: { days: 0, hours: 1, minutes: 0, seconds: 0 }
    });
  });

  it("does not render expired or invalid countdowns", () => {
    expect(getTrackerCountdown({ startAt, aggregateAt, closedAt: null, now: aggregateAt })).toBeNull();
    expect(getTrackerCountdown({ startAt: "invalid", aggregateAt, closedAt: null, now: startAt })).toBeNull();
  });

  it("counts down to the next chapter start for the current chapter", () => {
    expect(getTrackerChapterCountdown({
      currentStartAt: startAt,
      nextStartAt: "2026-01-03T00:00:00.000Z",
      currentEndAt: aggregateAt,
      now: "2026-01-02T12:00:00.000Z"
    })).toEqual({
      mode: "ends",
      values: { days: 0, hours: 12, minutes: 0, seconds: 0 }
    });
  });

  it("falls back to the current chapter end when there is no next chapter", () => {
    expect(getTrackerChapterCountdown({
      currentStartAt: startAt,
      nextStartAt: null,
      currentEndAt: aggregateAt,
      now: "2026-01-02T12:00:00.000Z"
    })).toEqual({
      mode: "ends",
      values: { days: 0, hours: 13, minutes: 2, seconds: 3 }
    });
  });

  it("supports Unix seconds and missing starts", () => {
    expect(getTrackerChapterCountdown({ currentStartAt: 1_767_244_800, nextStartAt: null, currentEndAt: 1_767_291_723_000, now: 1_767_248_400_000 })).not.toBeNull();
    expect(getTrackerChapterCountdown({ currentStartAt: null, nextStartAt: null, currentEndAt: aggregateAt, now: "2026-01-02T12:00:00.000Z" })).toMatchObject({ mode: "ends" });
  });
});
