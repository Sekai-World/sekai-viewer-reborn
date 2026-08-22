import { describe, expect, it } from "vitest";
import { findTrackerNameChanges } from "./tracker-name-changes";

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
