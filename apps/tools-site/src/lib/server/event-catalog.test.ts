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

import {
  getCurrentEventMetadata,
  getEventMetadata,
  getEventPickerResults,
  searchEvents
} from "./event-catalog";
import { clearMetadataCache } from "./metadata-cache";

describe("tracker event metadata requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetadataCache();
  });

  afterEach(() => vi.useRealTimers());

  it("loads current metadata without requesting the event list", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({
      data: {
        id: 42,
        name: "Current event",
        startAt: "2026-08-01T00:00:00Z",
        aggregateAt: "2026-08-10T00:00:00Z",
        closedAt: "2026-08-12T00:00:00Z"
      }
    });

    await expect(getCurrentEventMetadata("https://master.example.test", "jp")).resolves.toEqual({
      status: "available",
      metadata: {
        id: 42,
        name: "Current event",
        startAt: "2026-08-01T00:00:00Z",
        aggregateAt: "2026-08-10T00:00:00Z",
        closedAt: "2026-08-12T00:00:00Z"
      }
    });
    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "jp" },
        signal: expect.any(AbortSignal)
      })
    );
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("searches event names with a bounded list request and explicit name query", async () => {
    mocks.getEventsByRegionList.mockResolvedValue({
      data: {
        items: [
          {
            id: 12,
            name: "Wonder event",
            startAt: "2026-08-01T00:00:00Z",
            aggregateAt: "2026-08-10T00:00:00Z"
          }
        ]
      }
    });

    await expect(
      searchEvents("https://master.example.test", "en", "  Wonder event  ")
    ).resolves.toMatchObject({
      status: "available",
      events: [{ id: 12, name: "Wonder event" }]
    });
    expect(mocks.getEventsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "en" },
        query: {
          page: 1,
          page_size: 10,
          name: "Wonder event",
          sort_by: "startAt",
          sort_order: "desc"
        },
        signal: expect.any(AbortSignal)
      })
    );
    expect(mocks.getEventsByRegionCurrent).not.toHaveBeenCalled();
  });

  it("resolves a numeric picker query through by-id without requesting the list", async () => {
    mocks.getEventsByRegionById.mockResolvedValue({
      data: { id: 123, name: "Historical event", startAt: "2026-07-01T00:00:00Z" }
    });

    await expect(
      getEventPickerResults("https://master.example.test", "tw", "123")
    ).resolves.toMatchObject({
      status: "available",
      events: [{ id: 123, name: "Historical event" }]
    });
    expect(mocks.getEventsByRegionById).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "tw", id: "123" },
        signal: expect.any(AbortSignal)
      })
    );
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("loads current and selected metadata for history without requesting the list", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({
      data: { id: 42, name: "Current event", startAt: "2026-08-01T00:00:00Z" }
    });
    mocks.getEventsByRegionById.mockResolvedValue({
      data: { id: 12, name: "Historical event", startAt: "2026-07-01T00:00:00Z" }
    });

    await expect(getEventMetadata("https://master.example.test", "kr", 12)).resolves.toMatchObject({
      status: "available",
      currentStatus: "available",
      selectedStatus: "available",
      currentEvent: { id: 42, name: "Current event" },
      selectedEvent: { id: 12, name: "Historical event" }
    });
    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledTimes(1);
    expect(mocks.getEventsByRegionById).toHaveBeenCalledTimes(1);
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("keeps current and selected metadata requests separate for an explicit current event", async () => {
    const currentEvent = {
      id: 179,
      name: "Link the Beats!",
      startAt: "2026-09-06T12:00:00Z",
      aggregateAt: "2026-09-18T12:00:00Z",
      closedAt: "2026-09-20T12:00:00Z"
    };
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: currentEvent });
    mocks.getEventsByRegionById.mockResolvedValue({
      error: { code: "REGION_DATA_NOT_READY", message: "region data is unavailable" },
      response: { status: 503 }
    });

    await expect(
      getEventMetadata("https://master.example.test", "tw", currentEvent.id)
    ).resolves.toEqual({
      status: "sdk-error",
      currentStatus: "available",
      selectedStatus: "sdk-error",
      currentEvent,
      selectedEvent: null
    });
    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledTimes(1);
    expect(mocks.getEventsByRegionById).toHaveBeenCalledTimes(1);
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("keeps search failures explicit instead of returning an empty successful result", async () => {
    mocks.getEventsByRegionList.mockRejectedValue(new Error("master API unavailable"));

    await expect(searchEvents("https://master.example.test", "jp", "event")).resolves.toEqual({
      status: "network-error",
      events: []
    });
  });
});
