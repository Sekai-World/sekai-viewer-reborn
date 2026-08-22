import { describe, expect, it } from "vitest";
import { findNearestHoverMarker, findTrackerNameChanges } from "./tracker-name-changes";

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
});

describe("findNearestHoverMarker", () => {
  const svgRect = { left: 100, width: 400 };

  it("snaps in unscaled SVG coordinates", () => {
    expect(findNearestHoverMarker({ clientX: 210, svgRect, viewBoxWidth: null, markerXs: [100, 110, 200] })).toBe(1);
  });

  it("converts a scaled viewBox to user-space coordinates", () => {
    expect(findNearestHoverMarker({ clientX: 150, svgRect, viewBoxWidth: 800, markerXs: [90, 100] })).toBe(1);
  });

  it("uses the SVG origin rather than an outer wrapper origin", () => {
    expect(findNearestHoverMarker({ clientX: 302, svgRect: { left: 300, width: 400 }, viewBoxWidth: null, markerXs: [0, 2] })).toBe(1);
  });

  it("keeps the first marker when distances tie", () => {
    expect(findNearestHoverMarker({ clientX: 110, svgRect, viewBoxWidth: null, markerXs: [0, 20] })).toBe(0);
  });

  it("returns null outside the screen-pixel threshold", () => {
    expect(findNearestHoverMarker({ clientX: 300, svgRect, viewBoxWidth: null, markerXs: [0] })).toBeNull();
  });
});
