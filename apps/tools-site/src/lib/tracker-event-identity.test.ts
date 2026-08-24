import { describe, expect, it } from "vitest";
import { resolveTrackerEventId } from "./tracker-event-identity";

describe("resolveTrackerEventId", () => {
  it("uses the resolved live ranking event when the catalog is unavailable", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        resolvedCurrentEventId: 203,
        catalogCurrentEventId: null
      })
    ).toBe(203);
  });

  it("keeps an explicit historical selection ahead of live and catalog identities", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: 101,
        resolvedCurrentEventId: 203,
        catalogCurrentEventId: 203
      })
    ).toBe(101);
  });

  it("uses the tracker result historical selection when page data is still live", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        resultSelectionEventId: 214,
        resolvedCurrentEventId: null,
        catalogCurrentEventId: null
      })
    ).toBe(214);
  });

  it("uses the catalog only when neither selection nor rankings resolve an event", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        resolvedCurrentEventId: null,
        catalogCurrentEventId: 203
      })
    ).toBe(203);
  });

  it("derives one reliable live event id from tracker ranking rows", () => {
    expect(
      resolveTrackerEventId({
        selectedEventId: null,
        resolvedCurrentEventId: null,
        rankingEventIds: [203, 203],
        catalogCurrentEventId: null
      })
    ).toBe(203);
  });
});
