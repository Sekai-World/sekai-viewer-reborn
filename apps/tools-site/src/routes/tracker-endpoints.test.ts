import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingTimePoints: vi.fn(),
  getEventRankingsByEventId: vi.fn()
}));

const fetchMock = vi.fn();

vi.mock("@platform/sekai-api-sdk", () => mocks);
vi.mock("$env/dynamic/private", () => ({
  env: { SEKAI_API_BASE_URL: "https://api.example.test/" }
}));

import { GET as graph } from "./tracker/[region]/graph/+server";
import { GET as snapshot } from "./tracker/[region]/snapshot/+server";
import { GET as time } from "./tracker/[region]/time/+server";

const request = (path: string, region = "en") =>
  ({ params: { region }, url: new URL(`https://tools.example.test${path}`) }) as never;

describe("tracker time-travel endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns deduplicated time points from the SDK", async () => {
    mocks.getEventRankingTimePoints.mockResolvedValue({
      data: {
        status: "success",
        data: { status: "success", data: ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"] }
      }
    });

    const response = await time(request("/tracker/en/time?eventId=42"));

    await expect(response.json()).resolves.toEqual({
      status: "available",
      timePoints: ["2026-01-01T00:00:00Z"]
    });
    expect(mocks.getEventRankingTimePoints).toHaveBeenCalledWith({
      baseUrl: "https://api.example.test",
      path: { id: 42 },
      query: { region: "en" }
    });
  });

  it("returns typed empty responses for invalid route and query parameters", async () => {
    await expect((await time(request("/tracker/en/time?eventId=0"))).json()).resolves.toEqual({
      status: "invalid-request",
      timePoints: []
    });
    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42"))).json()
    ).resolves.toEqual({ status: "invalid-request", rankings: [] });
    await expect(
      (await graph(request("/tracker/cn/graph?eventId=42&rank=1", "cn"))).json()
    ).resolves.toEqual({ status: "invalid-request", points: [] });
    expect(mocks.getEventRankingTimePoints).not.toHaveBeenCalled();
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converts upstream errors and rejected requests to typed responses", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValueOnce({ error: true });
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42&timestamp=2026-01-01"))).json()
    ).resolves.toEqual({ status: "sdk-error", rankings: [] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1"))).json()
    ).resolves.toEqual({ status: "network-error", points: [] });
  });

  it("recognizes restore responses and rejects malformed payloads", async () => {
    mocks.getEventRankingTimePoints.mockResolvedValueOnce({
      response: { status: 202 },
      data: { restore: true }
    });
    fetchMock.mockResolvedValueOnce(Response.json({ eventRankings: [{ rank: "not-a-rank" }] }));

    await expect((await time(request("/tracker/en/time?eventId=42"))).json()).resolves.toEqual({
      status: "unavailable",
      timePoints: []
    });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1"))).json()
    ).resolves.toEqual({ status: "invalid-data", points: [] });
  });

  it("unwraps production envelopes for snapshots and graph points", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValueOnce({
      data: {
        status: "success",
        data: { totalCount: 1, limit: 1, page: 1, eventRankings: [{ rank: 1, score: 100 }] }
      }
    });
    fetchMock.mockResolvedValueOnce(Response.json({
      status: "success",
      data: { eventRankings: [{ rank: 1, score: 100, timestamp: "2026-01-01T00:00:00Z" }] }
    }));

    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42&timestamp=2026-01-01"))).json()
    ).resolves.toMatchObject({ status: "available", rankings: [{ rank: 1, score: 100 }] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1"))).json()
    ).resolves.toMatchObject({
      status: "available",
      points: [{ rank: 1, score: 100, timestamp: "2026-01-01T00:00:00Z" }]
    });
  });

  it("uses the legacy graph URL without a timestamp when no snapshot is selected", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ eventRankings: [] }));

    await expect((await graph(request("/tracker/tw/graph?eventId=176&rank=1", "tw"))).json()).resolves.toEqual({
      status: "available",
      points: []
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/event/176/rankings/graph?region=tw&rank=1");
  });
});
