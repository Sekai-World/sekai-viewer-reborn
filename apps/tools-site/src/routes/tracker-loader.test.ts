import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingLive: vi.fn(),
  getEventRankingsByEventId: vi.fn(),
  getEventsByRegionCurrent: vi.fn(),
  getEventsByRegionList: vi.fn(),
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
    await expect(runLoad(region)).resolves.toMatchObject({ region, status: "available" });
    expect(mocks.getEventRankingLive).toHaveBeenCalledWith({
      baseUrl: "https://api.example.test",
      query: { region }
    });
  });

  it("uses the historical endpoint for a valid eventId", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ data: [] });
    await expect(runLoad("en", "123")).resolves.toMatchObject({
      selection: { mode: "history", eventId: 123 }, selectionStatus: "valid", status: "available"
    });
    expect(mocks.getEventRankingsByEventId).toHaveBeenCalledWith({
      baseUrl: "https://api.example.test", path: { id: 123 }, query: { limit: 1, sort: { timestamp: "desc" }, region: "en" }
    });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
  });

  it("preserves the explicit historical upstream-error status", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValue({ error: true, response: { status: 500 } });

    await expect(runLoad("en", "123")).resolves.toMatchObject({
      selection: { mode: "history", eventId: 123 }, selectionStatus: "valid", status: "upstream-error"
    });
  });

  it.each(["invalid", "0", "-1", "1.5", "9007199254740992"])("returns an invalid selection for eventId %s without SDK calls", async (eventId) => {
    await expect(runLoad("en", eventId)).resolves.toMatchObject({
      selection: { mode: "history", eventId: null }, selectionStatus: "invalid-event-id", rankings: []
    });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
  });

  it.each(["cn", "invalid"])("returns a SvelteKit 404 for unsupported region %s without calling the SDK", async (region) => {
    await expect(runLoad(region)).rejects.toMatchObject({ status: 404 });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
  });
});
