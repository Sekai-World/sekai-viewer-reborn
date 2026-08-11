import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingLive: vi.fn(),
  getEventRankingsByEventId: vi.fn(),
  getSekaiApiBaseUrl: vi.fn(() => "https://api.example.test")
}));

vi.mock("@platform/sekai-api-sdk", () => ({
  getEventRankingLive: mocks.getEventRankingLive,
  getEventRankingsByEventId: mocks.getEventRankingsByEventId
}));
vi.mock("$env/dynamic/private", () => ({ env: { SEKAI_API_BASE_URL: "https://api.example.test/" } }));

import { load } from "./tracker/[region]/+page.server";

const runLoad = (region: string, eventId?: string) =>
  (load as unknown as (event: { params: { region: string }; url: URL }) => Promise<Record<string, unknown>>)(
    { params: { region }, url: new URL(`https://tools.example.test/tracker/${region}${eventId === undefined ? "" : `?eventId=${eventId}`}`) }
  );

describe("tracker route loader", () => {
  beforeEach(() => vi.clearAllMocks());

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
      baseUrl: "https://api.example.test", path: { id: 123 }, query: { limit: 1000, full: true, region: "en" }
    });
    expect(mocks.getEventRankingLive).not.toHaveBeenCalled();
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
