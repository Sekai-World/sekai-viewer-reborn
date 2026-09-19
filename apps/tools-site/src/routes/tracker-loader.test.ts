import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingLive: vi.fn(),
  getEventRankingsByEventId: vi.fn(),
  getEventsByRegionCurrent: vi.fn(),
  getEventsByRegionList: vi.fn(),
  getEventsByRegionById: vi.fn(),
  getEventsByRegionByIdRewards: vi.fn(),
  getWorldBloomsByRegionList: vi.fn(),
  getSekaiApiBaseUrl: vi.fn(() => "https://api.example.test")
}));

vi.mock("@platform/sekai-api-sdk", () => ({
  getEventRankingLive: mocks.getEventRankingLive,
  getEventRankingsByEventId: mocks.getEventRankingsByEventId
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionCurrent: mocks.getEventsByRegionCurrent,
  getEventsByRegionList: mocks.getEventsByRegionList,
  getEventsByRegionById: mocks.getEventsByRegionById,
  getEventsByRegionByIdRewards: mocks.getEventsByRegionByIdRewards,
  getWorldBloomsByRegionList: mocks.getWorldBloomsByRegionList
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    SEKAI_API_BASE_URL: "https://api.example.test/",
    SEKAI_MASTER_API_BASE_URL: "https://master.example.test/"
  }
}));

import { load } from "./tracker/[region]/+page.server";
import { clearMetadataCache } from "$lib/server/metadata-cache";

const runLoad = (region: string, eventId?: string) =>
  (
    load as unknown as (event: {
      params: { region: string };
      url: URL;
    }) => Promise<Record<string, unknown>>
  )({
    params: { region },
    url: new URL(
      `https://tools.example.test/tracker/${region}${eventId === undefined ? "" : `?eventId=${eventId}`}`
    )
  });

describe("tracker route loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetadataCache();
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: {} });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [] } });
    mocks.getWorldBloomsByRegionList.mockResolvedValue({ data: { items: [] } });
  });

  it.each(["jp", "en", "tw", "kr"])("loads tracker region %s", async (region) => {
    mocks.getEventRankingLive.mockResolvedValue({ data: { eventRankings: [{ rank: 1 }] } });
    const loaded = await runLoad(region);
    expect(loaded).toMatchObject({ region, selectionStatus: "valid" });
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "available" });
    await expect(loaded.isWorldBloom).resolves.toBe(false);
    expect(mocks.getEventRankingLive).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        query: { region }
      })
    );
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("passes live current metadata through trackerReady without loading the event list", async () => {
    const currentEvent = {
      id: 42,
      name: "Current event",
      startAt: "2026-08-01T00:00:00Z",
      aggregateAt: "2026-08-10T00:00:00Z",
      closedAt: "2026-08-12T00:00:00Z"
    };
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: currentEvent });
    mocks.getEventRankingLive.mockResolvedValue({
      data: { eventRankings: [{ rank: 1, score: 100, eventId: 42 }] }
    });

    const loaded = await runLoad("jp");

    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "jp" },
        signal: expect.any(AbortSignal)
      })
    );
    await expect(loaded.trackerReady).resolves.toMatchObject({
      resolvedEventId: 42,
      catalog: {
        currentEvent,
        selectedEvent: currentEvent
      }
    });
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("keeps rewards unavailable while current catalog metadata is unavailable", async () => {
    mocks.getEventRankingLive.mockResolvedValue({
      data: { eventRankings: [{ rank: 1, eventId: 42 }] }
    });
    mocks.getEventsByRegionCurrent.mockRejectedValue(new Error("catalog unavailable"));
    mocks.getEventsByRegionByIdRewards.mockResolvedValue({ data: { items: [] } });

    const loaded = await runLoad("en");
    expect(loaded).toMatchObject({ selectionStatus: "valid" });
    await expect(loaded.trackerReady).resolves.toMatchObject({
      resolvedEventId: null,
      catalog: { currentStatus: "network-error", currentEvent: null }
    });
    await expect(loaded.rewards).resolves.toBeNull();
    expect(mocks.getEventsByRegionByIdRewards).not.toHaveBeenCalled();
  });

  it("does not load catalog metadata by a ranking event ID", async () => {
    mocks.getEventRankingLive.mockResolvedValue({
      data: {
        eventRankings: [
          { rank: 1, eventId: 42 },
          { rank: 2, eventId: 42 }
        ]
      }
    });
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: {} });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [] } });
    mocks.getEventsByRegionById.mockResolvedValue({
      data: {
        id: 42,
        name: "Current event",
        startAt: "2026-08-01T00:00:00Z",
        aggregateAt: "2026-08-10T00:00:00Z",
        closedAt: "2026-08-12T00:00:00Z"
      }
    });

    const loaded = await runLoad("jp");
    await expect(loaded.catalog).resolves.toMatchObject({
      currentEvent: null,
      selectedEvent: null
    });
    await expect(loaded.trackerReady).resolves.toMatchObject({ resolvedEventId: null });
    expect(mocks.getEventsByRegionById).not.toHaveBeenCalled();
  });

  it("uses the historical endpoint for a valid eventId", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({
      data: {
        id: 42,
        name: "Current event",
        startAt: "2026-08-01T00:00:00Z",
        aggregateAt: "2026-08-10T00:00:00Z",
        closedAt: "2026-08-12T00:00:00Z"
      }
    });
    mocks.getEventRankingsByEventId.mockResolvedValue({ data: [] });
    mocks.getEventsByRegionById.mockResolvedValue({
      data: {
        id: 123,
        name: "Historical event",
        startAt: "2026-07-01T00:00:00Z",
        aggregateAt: "2026-07-10T00:00:00Z",
        closedAt: "2026-07-12T00:00:00Z"
      }
    });
    const loaded = await runLoad("en", "123");
    expect(loaded).toMatchObject({
      selection: { mode: "history", eventId: 123 },
      selectionStatus: "valid"
    });
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "available" });
    await expect(loaded.isWorldBloom).resolves.toBe(false);
    expect(mocks.getEventRankingsByEventId).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        path: { id: 123 },
        query: { limit: 1, sort: { timestamp: "desc" }, region: "en" },
        querySerializer: expect.any(Function)
      })
    );
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
    await expect(loaded.catalog).resolves.toMatchObject({
      selectedEvent: { id: 123, name: "Historical event" }
    });
  });

  it("uses the live ranking endpoint and current metadata when eventId matches the current catalog event", async () => {
    const currentEvent = {
      id: 42,
      name: "Current event",
      startAt: "2026-08-01T00:00:00Z",
      aggregateAt: "2026-08-10T00:00:00Z",
      closedAt: "2026-08-12T00:00:00Z"
    };
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: currentEvent });
    mocks.getEventsByRegionById.mockResolvedValue({
      error: { code: "REGION_DATA_NOT_READY", message: "region data is unavailable" },
      response: { status: 503 }
    });
    mocks.getEventRankingLive.mockResolvedValue({
      data: { eventRankings: [{ rank: 1, eventId: 42 }] }
    });

    const loaded = await runLoad("en", "42");
    await expect(loaded.trackerResult).resolves.toMatchObject({
      selection: { mode: "live", eventId: null }
    });
    await expect(loaded.trackerReady).resolves.toMatchObject({
      resolvedEventId: 42,
      catalog: {
        currentEvent: { id: 42 },
        selectedEvent: { id: 42, name: "Current event" }
      }
    });
    expect(mocks.getEventRankingLive).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        query: { region: "en" }
      })
    );
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
    expect(mocks.getEventsByRegionById).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "en", id: "42" },
        signal: expect.any(AbortSignal)
      })
    );
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("derives World Link from catalog and bloom metadata without waiting for rankings", async () => {
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: { id: 123, name: "Current event" } });
    mocks.getWorldBloomsByRegionList.mockResolvedValue({
      data: { items: [{ id: 1, eventId: 123, chapterNo: 1, gameCharacterId: 2 }] }
    });
    mocks.getEventRankingLive.mockReturnValue(new Promise(() => {}));

    const loaded = await runLoad("en");
    expect(loaded.isWorldBloom).toEqual(expect.any(Promise));
    await expect(loaded.isWorldBloom).resolves.toBe(true);
  });

  it("returns the streamed tracker payload while World Link metadata is pending", async () => {
    mocks.getEventRankingLive.mockResolvedValue({ data: { eventRankings: [{ rank: 1 }] } });
    mocks.getWorldBloomsByRegionList.mockReturnValue(new Promise(() => {}));

    const loaded = await runLoad("en");
    expect(loaded).toMatchObject({ region: "en", selectionStatus: "valid" });
    expect(loaded.isWorldBloom).toEqual(expect.any(Promise));
  });

  it("keeps World Link false when catalog data is unavailable", async () => {
    mocks.getEventsByRegionCurrent.mockRejectedValue(new Error("catalog unavailable"));
    mocks.getWorldBloomsByRegionList.mockResolvedValue({
      data: { items: [{ id: 1, eventId: 123, chapterNo: 1, gameCharacterId: 2 }] }
    });

    const loaded = await runLoad("en");
    expect(loaded.isWorldBloom).toEqual(expect.any(Promise));
    await expect(loaded.isWorldBloom).resolves.toBe(false);
  });

  it("loads historical World Bloom chapters through historical chapter snapshots", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ data: [] });
    mocks.getEventsByRegionById.mockResolvedValue({ data: { id: 123, name: "Historical event" } });
    mocks.getWorldBloomsByRegionList.mockResolvedValue({
      data: { items: [{ id: 1, eventId: 123, chapterNo: 1, gameCharacterId: 2 }] }
    });

    const loaded = await runLoad("en", "123");
    await expect(loaded.chapters).resolves.toMatchObject({ metadata: { eventId: 123 } });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
  });

  it("loads explicit historical metadata by ID when the event list is unavailable", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ data: [] });
    mocks.getEventsByRegionById.mockResolvedValue({ data: { id: 123, name: "Historical event" } });

    const loaded = await runLoad("tw", "123");
    await expect(loaded.catalog).resolves.toMatchObject({
      status: "available",
      selectedEvent: { id: 123, name: "Historical event" },
      currentEvent: null
    });
    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledWith({
      baseUrl: "https://master.example.test",
      path: { region: "tw" },
      signal: expect.any(AbortSignal)
    });
    expect(mocks.getEventsByRegionById).toHaveBeenCalledWith({
      baseUrl: "https://master.example.test",
      path: { region: "tw", id: "123" },
      signal: expect.any(AbortSignal)
    });
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("preserves the explicit historical upstream-error status", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ error: true, response: { status: 500 } });

    const loaded = await runLoad("en", "123");
    expect(loaded).toMatchObject({
      selection: { mode: "history", eventId: 123 },
      selectionStatus: "valid"
    });
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "upstream-error" });
  });

  it.each(["invalid", "0", "-1", "1.5", "9007199254740992"])(
    "returns an invalid selection for eventId %s without SDK calls",
    async (eventId) => {
      const loaded = await runLoad("en", eventId);
      expect(loaded).toMatchObject({
        selection: { mode: "history", eventId: null },
        selectionStatus: "invalid-event-id"
      });
      await expect(loaded.trackerResult).resolves.toMatchObject({ rankings: [] });
      expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
      expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
    }
  );

  it("returns a settled invalid-data result for an invalid event ID", async () => {
    const loaded = await runLoad("en", "invalid");
    await expect(loaded.trackerResult).resolves.toMatchObject({
      status: "invalid-data",
      rankings: []
    });
  });

  it.each(["cn", "invalid"])(
    "returns a SvelteKit 404 for unsupported region %s without calling the SDK",
    async (region) => {
      await expect(runLoad(region)).rejects.toMatchObject({ status: 404 });
      expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
      expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
    }
  );
});
