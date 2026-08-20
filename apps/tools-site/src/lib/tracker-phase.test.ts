import { describe, expect, it } from "vitest";
import { getNextTrackerRefreshCountdownMs, getNextTrackerRefreshDeadline, getTrackerPhase, parseTrackerTimestamp } from "./tracker-phase";

describe("tracker phase", () => {
  const startAt = "2026-01-01T00:00:00.000Z";
  const aggregateAt = "2026-01-01T01:00:00.000Z";

  it("classifies upcoming, live, and finished boundaries", () => {
    expect(getTrackerPhase({ startAt, aggregateAt, now: "2025-12-31T23:59:59.999Z" })).toBe("upcoming");
    expect(getTrackerPhase({ startAt, aggregateAt, now: startAt })).toBe("live");
    expect(getTrackerPhase({ startAt, aggregateAt, now: aggregateAt })).toBe("finished");
  });

  it("uses unavailable for invalid or inverted dates", () => {
    expect(parseTrackerTimestamp("not-a-date")).toBeNull();
    expect(parseTrackerTimestamp(Number.NaN)).toBeNull();
    expect(getTrackerPhase({ startAt: "bad", aggregateAt, now: startAt })).toBe("unavailable");
    expect(getTrackerPhase({ startAt: aggregateAt, aggregateAt: startAt, now: startAt })).toBe("unavailable");
  });

  it("aligns live automatic refreshes to the three-minute, ten-second cadence", () => {
    const now = "2026-01-01T00:00:11.000Z";
    const deadline = getNextTrackerRefreshDeadline({ now, aggregateAt });
    expect(deadline).toBe(Date.parse("2026-01-01T00:03:10.000Z"));
    expect(getNextTrackerRefreshCountdownMs({ now, aggregateAt })).toBe(179_000);
  });

  it("schedules exactly two terminal refreshes after aggregation", () => {
    const terminalAggregateAt = "2026-01-01T12:59:59.000Z";
    const firstTerminal = Date.parse("2026-01-01T13:10:10.000Z");
    const secondTerminal = Date.parse("2026-01-01T13:15:10.000Z");

    expect(getNextTrackerRefreshDeadline({ now: terminalAggregateAt, aggregateAt: terminalAggregateAt })).toBe(
      firstTerminal
    );
    expect(
      getNextTrackerRefreshDeadline({ now: "2026-01-01T13:10:10.000Z", aggregateAt: terminalAggregateAt })
    ).toBe(secondTerminal);
    expect(
      getNextTrackerRefreshDeadline({ now: "2026-01-01T13:12:00.000Z", aggregateAt: terminalAggregateAt })
    ).toBe(secondTerminal);
    expect(
      getNextTrackerRefreshDeadline({ now: "2026-01-01T13:15:10.000Z", aggregateAt: terminalAggregateAt })
    ).toBeNull();
  });

  it("does not schedule invalid refresh schedules", () => {
    expect(getNextTrackerRefreshDeadline({ now: "bad", aggregateAt })).toBeNull();
    expect(getNextTrackerRefreshDeadline({ now: startAt, aggregateAt, intervalMs: 0 })).toBeNull();
    expect(getNextTrackerRefreshDeadline({ now: startAt, aggregateAt, offsetMs: Number.NaN })).toBeNull();
  });
});
