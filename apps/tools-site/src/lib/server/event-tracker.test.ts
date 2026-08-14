import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getEventRankingLive: vi.fn(), getEventRankingsByEventId: vi.fn() }));

vi.mock("@platform/sekai-api-sdk", () => mocks);

import { getEventTrackerRankings, parseEventTrackerRankings } from "./event-tracker";

describe("event tracker data layer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses the live API's numeric-string ranking fields safely", () => {
    expect(
      parseEventTrackerRankings({
        data: {
          eventRankings: [
            {
              id: "155635838042374144",
              rank: "1",
              score: "44861441",
              userId: "155635838042374144",
              userName: "Player",
              eventId: "42",
              timestamp: "2026-08-08T00:00:00Z"
            }
          ]
        }
      })
    ).toEqual([
      { rank: 1, score: 44861441, userId: "155635838042374144", userName: "Player", eventId: 42, timestamp: "2026-08-08T00:00:00Z" }
    ]);
  });

  it("accepts an omitted eventRankings array as empty data", () => {
    expect(parseEventTrackerRankings({ data: {} })).toEqual([]);
  });

  it("calls the SDK with the base URL and region", async () => {
    mocks.getEventRankingLive.mockResolvedValue({ data: { eventRankings: [] } });

    await expect(getEventTrackerRankings("https://api.example.test", "en")).resolves.toMatchObject({
      status: "available", selection: { mode: "live", eventId: null }, rankings: []
    });
    expect(mocks.getEventRankingLive).toHaveBeenCalledWith({
      baseUrl: "https://api.example.test",
      query: { region: "en" }
    });
  });

  it("loads and merges historical first100 and border rankings deterministically", async () => {
    mocks.getEventRankingsByEventId
      .mockResolvedValueOnce({ data: [{ timestamp: "2026-08-08T00:00:00Z" }] })
      .mockResolvedValueOnce({
      data: {
        first100: [{ rank: 1, userId: "one", score: 100 }],
        border: [{ rank: 1, userId: "one", score: 100 }, { rank: 100, userId: "last", score: 1 }]
      }
      });

    await expect(getEventTrackerRankings("https://api.example.test", "jp", 42)).resolves.toMatchObject({
      selection: { mode: "history", eventId: 42 },
      status: "available",
      rankings: [{ rank: 1, userId: "one" }, { rank: 100, userId: "last" }]
    });
    expect(mocks.getEventRankingsByEventId).toHaveBeenNthCalledWith(1, {
      baseUrl: "https://api.example.test",
      path: { id: 42 }, query: { limit: 1, sort: { timestamp: "desc" }, region: "jp" }
    });
    expect(mocks.getEventRankingsByEventId).toHaveBeenNthCalledWith(2, {
      baseUrl: "https://api.example.test", path: { id: 42 }, query: { timestamp: "2026-08-08T00:00:00Z", region: "jp" }
    });
  });

  it("unwraps the production SDK envelope before selecting a historical snapshot", async () => {
    mocks.getEventRankingsByEventId
      .mockResolvedValueOnce({ data: { status: "success", data: { totalCount: 1, limit: 1, page: 1, eventRankings: [{ timestamp: "2026-08-08T00:00:00Z" }] } } })
      .mockResolvedValueOnce({ data: { status: "success", data: { eventRankings: [{ rank: 1, score: 100 }] } } });

    await expect(getEventTrackerRankings("https://api.example.test", "en", 42)).resolves.toMatchObject({
      status: "available", rankings: [{ rank: 1, score: 100 }]
    });
  });

  it.each([
    ["latest lookup", [{ error: true, response: { status: 500 } }], "upstream-error"],
    ["snapshot lookup", [
      { data: [{ timestamp: "2026-08-08T00:00:00Z" }] },
      { error: true, response: { status: 500 } }
    ], "upstream-error"],
    ["non-500 failure", [{ error: true, response: { status: 503 } }], "sdk-error"]
  ] as const)("maps historical %s SDK failure to %s", async (_stage, responses, status) => {
    for (const response of responses) mocks.getEventRankingsByEventId.mockResolvedValueOnce(response);

    await expect(getEventTrackerRankings("https://api.example.test", "jp", 42)).resolves.toMatchObject({ status });
  });

  it("converts SDK errors, network failures, and malformed data to safe states", async () => {
    mocks.getEventRankingLive.mockResolvedValueOnce({ error: true });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "sdk-error"
    });

    mocks.getEventRankingLive.mockRejectedValueOnce(new Error("offline"));
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "network-error"
    });

    mocks.getEventRankingLive.mockResolvedValueOnce({ data: { eventRankings: [{ score: "9007199254740992" }] } });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "invalid-data"
    });

    mocks.getEventRankingLive.mockResolvedValueOnce({ data: { eventRankings: [{ score: "44.5" }] } });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "invalid-data"
    });
  });
});
