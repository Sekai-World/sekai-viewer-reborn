import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingLive: vi.fn(),
  getEventRankingsByEventId: vi.fn(),
  getEventsByRegionCurrent: vi.fn(),
  getEventsByRegionList: vi.fn(),
  getEventsByRegionById: vi.fn(),
  getEventsByRegionByIdRewards: vi.fn(),
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
  getEventsByRegionByIdRewards: mocks.getEventsByRegionByIdRewards
}));
vi.mock("$env/dynamic/private", () => ({ env: { SEKAI_API_BASE_URL: "https://api.example.test/", SEKAI_MASTER_API_BASE_URL: "https://master.example.test/" } }));

import { load } from "./tracker/[region]/+page.server";

const runLoad = (region: string, eventId?: string) =>
  (load as unknown as (event: { params: { region: string }; url: URL }) => Promise<Record<string, unknown>>)(
    { params: { region }, url: new URL(`https://tools.example.test/tracker/${region}${eventId === undefined ? "" : `?eventId=${eventId}`}`) }
  );

describe("tracker route loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEventsByRegionCurrent.mockResolvedValue({ data: {} });
    mocks.getEventsByRegionList.mockResolvedValue({ data: { items: [] } });
  });

  it.each(["jp", "en", "tw", "kr"])("loads tracker region %s", async (region) => {
    mocks.getEventRankingLive.mockResolvedValue({ data: { eventRankings: [{ rank: 1 }] } });
    const loaded = await runLoad(region);
    expect(loaded).toMatchObject({ region, selectionStatus: "valid" });
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "available" });
    expect(mocks.getEventRankingLive).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: "https://api.example.test",
      query: { region }
    }));
  });

  it("uses the live ranking event id for rewards while catalog metadata is unavailable", async () => {
    mocks.getEventRankingLive.mockResolvedValue({ data: { eventRankings: [{ rank: 1, eventId: 42 }] } });
    mocks.getEventsByRegionCurrent.mockRejectedValue(new Error("catalog unavailable"));
    mocks.getEventsByRegionList.mockRejectedValue(new Error("catalog unavailable"));
    mocks.getEventsByRegionByIdRewards.mockResolvedValue({ data: { items: [] } });

    const loaded = await runLoad("en");
    expect(loaded).toMatchObject({ selectionStatus: "valid" });
    await expect(loaded.trackerResult).resolves.toMatchObject({ resolvedCurrentEventId: 42 });
    await expect(loaded.rewards).resolves.toMatchObject({ status: "available", items: [] });
    expect(mocks.getEventsByRegionByIdRewards).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: "https://master.example.test",
      path: { region: "en", id: "42" }
    }));
  });

  it("uses the historical endpoint for a valid eventId", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ data: [] });
    mocks.getEventsByRegionById.mockResolvedValue({ data: { id: 123, name: "Historical event" } });
    const loaded = await runLoad("en", "123");
    expect(loaded).toMatchObject({ selection: { mode: "history", eventId: 123 }, selectionStatus: "valid" });
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "available" });
    expect(mocks.getEventRankingsByEventId).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: "https://api.example.test",
      path: { id: 123 },
      query: { limit: 1, sort: { timestamp: "desc" }, region: "en" },
      querySerializer: expect.any(Function)
    }));
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
    await expect(loaded.catalog).resolves.toMatchObject({
      selectedEvent: { id: 123, name: "Historical event" }
    });
  });

  it("loads explicit historical metadata by ID when the event list is unavailable", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ data: [] });
    mocks.getEventsByRegionList.mockRejectedValue(new Error("list unavailable"));
    mocks.getEventsByRegionById.mockResolvedValue({ data: { id: 123, name: "Historical event" } });

    const loaded = await runLoad("tw", "123");
    await expect(loaded.catalog).resolves.toMatchObject({
      status: "available",
      listStatus: "network-error",
      selectedEvent: { id: 123, name: "Historical event" },
      currentEvent: null
    });
    expect(mocks.getEventsByRegionCurrent).toHaveBeenCalledWith({
      baseUrl: "https://master.example.test", path: { region: "tw" }, signal: expect.any(AbortSignal)
    });
    expect(mocks.getEventsByRegionById).toHaveBeenCalledWith({
      baseUrl: "https://master.example.test", path: { region: "tw", id: "123" }, signal: expect.any(AbortSignal)
    });
  });

  it("preserves the explicit historical upstream-error status", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ error: true, response: { status: 500 } });

    const loaded = await runLoad("en", "123");
    expect(loaded).toMatchObject({ selection: { mode: "history", eventId: 123 }, selectionStatus: "valid" });
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "upstream-error" });
  });

  it.each(["invalid", "0", "-1", "1.5", "9007199254740992"])("returns an invalid selection for eventId %s without SDK calls", async (eventId) => {
    const loaded = await runLoad("en", eventId);
    expect(loaded).toMatchObject({ selection: { mode: "history", eventId: null }, selectionStatus: "invalid-event-id" });
    await expect(loaded.trackerResult).resolves.toMatchObject({ rankings: [] });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
  });

  it("returns a settled invalid-data result for an invalid event ID", async () => {
    const loaded = await runLoad("en", "invalid");
    await expect(loaded.trackerResult).resolves.toMatchObject({ status: "invalid-data", rankings: [] });
  });

  it.each(["cn", "invalid"])("returns a SvelteKit 404 for unsupported region %s without calling the SDK", async (region) => {
    await expect(runLoad(region)).rejects.toMatchObject({ status: 404 });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
  });
});
