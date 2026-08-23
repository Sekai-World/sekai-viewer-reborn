import { describe, expect, it } from "vitest";
import { findSnappedNameChange, findTrackerNameChanges } from "./tracker-name-changes";

const point = (timestamp: string, userName: string | null, rank = 10) => ({ rank, userName, timestamp });

describe("findTrackerNameChanges", () => {
  it("returns no changes for an unchanged series", () => {
    expect(findTrackerNameChanges([point("2026-01-01T00:00:00Z", "A"), point("2026-01-01T01:00:00Z", "A")], 10)).toEqual([]);
  });
  it("emits a single normalized change", () => {
    expect(findTrackerNameChanges([point("2026-01-01T01:00:00Z", "B"), point("2026-01-01T00:00:00Z", "A")], 10)).toEqual([
      { timestamp: "2026-01-01T01:00:00.000Z", rank: 10, previousName: "A", nextName: "B" }
    ]);
  });
  it("keeps A to B to A as two changes", () => {
    expect(findTrackerNameChanges([point("2026-01-01T00:00:00Z", "A"), point("2026-01-01T01:00:00Z", "B"), point("2026-01-01T02:00:00Z", "A")], 10)).toMatchObject([
      { previousName: "A", nextName: "B" },
      { previousName: "B", nextName: "A" }
    ]);
  });
  it("skips empty names without manufacturing a change", () => {
    expect(findTrackerNameChanges([point("2026-01-01T00:00:00Z", "A"), point("2026-01-01T01:00:00Z", ""), point("2026-01-01T02:00:00Z", "A"), point("2026-01-01T03:00:00Z", null)], 10)).toEqual([]);
  });
  it("ignores other ranks and preserves equal-time input order", () => {
    expect(findTrackerNameChanges([point("2026-01-01T01:00:00Z", "B", 11), point("2026-01-01T00:00:00Z", "A"), point("2026-01-01T01:00:00Z", "B")], 10)).toHaveLength(1);
  });
  it("returns no markers beyond the top ten even for a genuine name change", () => {
    expect(findTrackerNameChanges([point("2026-01-01T00:00:00Z", "A", 11), point("2026-01-01T01:00:00Z", "B", 11)], 11)).toEqual([]);
  });
});

describe("findSnappedNameChange", () => {
  const marker = (timestamp: string) => ({ point: { date: new Date(timestamp) } });
  const hoveredDate = new Date("2026-01-01T01:00:00Z");

  it("snaps by time distance within the scale-derived threshold", () => {
    expect(findSnappedNameChange({ hoveredDate, markers: [marker("2026-01-01T00:59:50Z")], thresholdMs: 15_000 })).toEqual(marker("2026-01-01T00:59:50Z"));
  });
  it("keeps the first marker when distances tie", () => {
    const first = marker("2026-01-01T00:59:50Z");
    const second = marker("2026-01-01T01:00:10Z");
    expect(findSnappedNameChange({ hoveredDate, markers: [first, second], thresholdMs: 11_000 })).toBe(first);
  });
  it("returns null outside the threshold", () => {
    expect(findSnappedNameChange({ hoveredDate, markers: [marker("2026-01-01T01:01:00Z")], thresholdMs: 15_000 })).toBeNull();
  });
});
