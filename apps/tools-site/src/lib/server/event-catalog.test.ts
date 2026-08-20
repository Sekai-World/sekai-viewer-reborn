import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventsByRegionCurrent: vi.fn(),
  getEventsByRegionList: vi.fn(),
  getEventsByRegionById: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionCurrent: mocks.getEventsByRegionCurrent,
  getEventsByRegionList: mocks.getEventsByRegionList,
  getEventsByRegionById: mocks.getEventsByRegionById
}));

import { getEventCatalog } from "./event-catalog";
import { getTrackerPhase } from "../tracker-phase";

describe("getEventCatalog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it.each(["current", "list"])("returns a terminal network error when the %s request stalls", async (stalledRequest) => {
    const pending = new Promise<never>(() => undefined);
    mocks.getEventsByRegionCurrent.mockImplementation(() =>
      stalledRequest === "current" ? pending : Promise.resolve({ data: { id: 1, name: "Current" } })
    );
    mocks.getEventsByRegionList.mockImplementation(() =>
      stalledRequest === "list" ? pending : Promise.resolve({ data: { items: [] } })
    );

    const result = getEventCatalog("https://master.example.test", "en");
    await vi.advanceTimersByTimeAsync(5_000);

    if (stalledRequest === "current") {
      await expect(result).resolves.toMatchObject({ status: "network-error", currentStatus: "network-error", currentEvent: null });
    } else {
      await expect(result).resolves.toMatchObject({ status: "available", currentStatus: "available", listStatus: "network-error", currentEvent: { id: 1 } });
    }
    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mocks.getEventsByRegionList).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each([
    ["jp", "2026-08-10T00:00:00Z"],
    ["en", "2026-08-12T00:00:00Z"]
  ])("preserves the region-specific aggregation deadline for %s", async (region, aggregateAt) => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: { id: "42", name: `Event ${region}`, startAt: "2026-08-01T00:00:00Z", aggregateAt } });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [{ id: "42", name: `Event ${region}`, startAt: "2026-08-01T00:00:00Z", aggregateAt }] } });

    await expect(getEventCatalog("https://master.example.test", region as "jp" | "en")).resolves.toMatchObject({
      status: "available",
      currentEvent: { id: 42, aggregateAt }
    });
  });

  it("fills missing current-event times from the matching region list item", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({
      data: { id: "42", name: "Event jp", startAt: "2026-08-01T00:00:00Z" }
    });
    mocks.getEventsByRegionList.mockResolvedValue({
      data: {
        items: [{ id: "42", name: "Event jp", startAt: "2026-08-01T00:00:00Z", aggregateAt: "2026-08-10T00:00:00Z" }]
      }
    });

    const result = await getEventCatalog("https://master.example.test", "jp");
    expect(result.currentEvent).toMatchObject({ id: 42, aggregateAt: "2026-08-10T00:00:00Z" });
    expect(getTrackerPhase({
      startAt: result.currentEvent?.startAt,
      aggregateAt: result.currentEvent?.aggregateAt,
      now: "2026-08-09T00:00:00Z"
    })).toBe("live");
    expect(getTrackerPhase({
      startAt: result.currentEvent?.startAt,
      aggregateAt: result.currentEvent?.aggregateAt,
      now: "2026-08-11T00:00:00Z"
    })).toBe("finished");
  });

  it("keeps current metadata available when the optional list fails", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({
      data: { id: 42, name: "Event jp", startAt: "2026-08-01T00:00:00Z", aggregateAt: "2026-08-10T00:00:00Z" }
    });
    mocks.getEventsByRegionList.mockResolvedValue({ error: true, response: { status: 503 } });

    await expect(getEventCatalog("https://master.example.test", "jp")).resolves.toMatchObject({
      status: "available",
      currentStatus: "available",
      listStatus: "sdk-error",
      currentEvent: { id: 42, aggregateAt: "2026-08-10T00:00:00Z" },
      eligibleEvents: []
    });
  });

  it("excludes list events with invalid startAt values", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: { id: 42, name: "Current" } });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [
      { id: 1, name: "Invalid", startAt: "not-a-date" },
      { id: 2, name: "Future", startAt: "2999-01-01T00:00:00Z" },
      { id: 3, name: "Past", startAt: "2020-01-01T00:00:00Z" }
    ] } });

    await expect(getEventCatalog("https://master.example.test", "en")).resolves.toMatchObject({
      eligibleEvents: [{ id: 3 }]
    });
  });

  it("loads current metadata alongside an explicit selected event", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: { id: 42, name: "Current" } });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [{ id: 42, name: "Current", startAt: "2026-08-01T00:00:00Z" }] } });

    await expect(getEventCatalog("https://master.example.test", "en", 42)).resolves.toMatchObject({
      status: "available",
      currentStatus: "available",
      currentEvent: { id: 42 },
      selectedEvent: { id: 42 }
    });
    expect(mocks.getEventsByRegionById).not.toHaveBeenCalled();
  });

  it("falls back to by-id selected metadata without losing a successful current event", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: { id: 42, name: "Current" } });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [] } });
    mocks.getEventsByRegionById.mockResolvedValue({ data: { id: 12, name: "Archived" } });

    await expect(getEventCatalog("https://master.example.test", "en", 12)).resolves.toMatchObject({
      status: "available",
      currentEvent: { id: 42 },
      selectedEvent: { id: 12 }
    });
  });
});
