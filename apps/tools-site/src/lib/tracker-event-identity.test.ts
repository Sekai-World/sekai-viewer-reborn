import { describe, expect, it } from "vitest";
import { resolveTrackerEventId } from "./tracker-event-identity";

describe("resolveTrackerEventId", () => {
  it("returns no identity when current metadata is unavailable", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        catalogCurrentEventId: null
      })
    ).toBeNull();
  });

  it("keeps an explicit historical selection ahead of live and catalog identities", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: 101,
        catalogCurrentEventId: 203
      })
    ).toBe(101);
  });

  it("uses the tracker result historical selection when page data is still live", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        resultSelectionEventId: 214,
        catalogCurrentEventId: null
      })
    ).toBe(214);
  });

  it("uses the catalog only when neither selection resolves an event", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        catalogCurrentEventId: 203
      })
    ).toBe(203);
  });

  it("uses current metadata as the live event identity", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        catalogCurrentEventId: 203
      })
    ).toBe(203);
  });
});
