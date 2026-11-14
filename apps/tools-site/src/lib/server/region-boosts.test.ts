import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getBoostsByRegionList: vi.fn() }));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getBoostsByRegionList: mocks.getBoostsByRegionList
}));

import { clearMetadataCache } from "./metadata-cache";
import { loadRegionBoosts } from "./region-boosts";

const page = (items: unknown[], hasNext = false) => ({
  data: { items, pagination: { has_next: hasNext } }
});

describe("region boost table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetadataCache();
  });

  it("reads the cost and event-point rate of every row and nothing else", async () => {
    mocks.getBoostsByRegionList.mockResolvedValueOnce(
      page([
        // JP and EN rows carry more columns; TW, KR and CN rows carry no id.
        { id: 1, costBoost: 0, eventPointRate: 1, expRate: 1, isEventOnly: false },
        { costBoost: 6, eventPointRate: 27, expRate: 26, rewardRate: 26 }
      ])
    );

    expect(await loadRegionBoosts("http://api", "tw")).toEqual({
      status: "available",
      boosts: [
        { costBoost: 0, eventPointRate: 1 },
        { costBoost: 6, eventPointRate: 27 }
      ]
    });
    expect(mocks.getBoostsByRegionList).toHaveBeenCalledTimes(1);
    expect(mocks.getBoostsByRegionList.mock.calls[0][0]).toMatchObject({
      baseUrl: "http://api",
      path: { region: "tw" },
      query: { page: 1, page_size: 100 }
    });
  });

  it.each([
    ["an SDK error", { error: { message: "boom" } }],
    ["a body without items", { data: {} }],
    ["an empty table", page([])],
    ["a table that continues on another page", page([{ costBoost: 0, eventPointRate: 1 }], true)],
    ["a row without a cost", page([{ eventPointRate: 1 }])],
    ["a row without a rate", page([{ costBoost: 0 }])],
    ["a negative cost", page([{ costBoost: -1, eventPointRate: 1 }])],
    ["a rate of zero", page([{ costBoost: 0, eventPointRate: 0 }])],
    ["a fractional cost", page([{ costBoost: 1.5, eventPointRate: 5 }])],
    ["a cost written as text", page([{ costBoost: "1", eventPointRate: 5 }])],
    [
      "two rows with one rate",
      page([
        { costBoost: 1, eventPointRate: 5 },
        { costBoost: 2, eventPointRate: 5 }
      ])
    ]
  ])("is unavailable for %s", async (_label, response) => {
    mocks.getBoostsByRegionList.mockResolvedValueOnce(response);

    expect(await loadRegionBoosts("http://api", "en")).toEqual({ status: "unavailable" });
  });

  it("accepts two rates at one cost, because a rate still names one cost", async () => {
    const rows = [
      { costBoost: 1, eventPointRate: 5 },
      { costBoost: 1, eventPointRate: 10 }
    ];
    mocks.getBoostsByRegionList.mockResolvedValueOnce(page(rows));

    expect(await loadRegionBoosts("http://api", "en")).toEqual({
      status: "available",
      boosts: rows
    });
  });

  it("is unavailable when the request rejects", async () => {
    mocks.getBoostsByRegionList.mockRejectedValueOnce(new Error("network"));

    expect(await loadRegionBoosts("http://api", "kr")).toEqual({ status: "unavailable" });
  });

  it("caches a successful table per region and does not cache a failure", async () => {
    mocks.getBoostsByRegionList.mockResolvedValue(page([{ costBoost: 0, eventPointRate: 1 }]));

    await loadRegionBoosts("http://api", "tw");
    await loadRegionBoosts("http://api", "tw");
    expect(mocks.getBoostsByRegionList).toHaveBeenCalledTimes(1);
    await loadRegionBoosts("http://api", "en");
    expect(mocks.getBoostsByRegionList).toHaveBeenCalledTimes(2);

    mocks.getBoostsByRegionList.mockReset().mockRejectedValue(new Error("network"));
    await loadRegionBoosts("http://api", "kr");
    await loadRegionBoosts("http://api", "kr");
    expect(mocks.getBoostsByRegionList).toHaveBeenCalledTimes(2);
  });
});
