import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getMusicsByRegionList: vi.fn() }));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getMusicsByRegionList: mocks.getMusicsByRegionList
}));

import { makeRegionChartKey } from "#lib/music-recommender.js";
import { clearMetadataCache } from "./metadata-cache";
import { loadRegionCharts } from "./region-charts";

const song = (id: unknown, difficulties: unknown[]) => ({
  id,
  difficulties: difficulties.map((musicDifficulty) => ({ musicDifficulty, playLevel: 10 }))
});

const page = (items: unknown[], hasNext = false) => ({
  data: { items, pagination: { has_next: hasNext } }
});

describe("region chart list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetadataCache();
  });

  afterEach(() => vi.useRealTimers());

  it("collects every chart of every page for the requested region", async () => {
    mocks.getMusicsByRegionList
      .mockResolvedValueOnce(page([song(1, ["easy", "expert"]), song("2", ["append"])], true))
      .mockResolvedValueOnce(page([song(3, ["Master"])]));

    const result = await loadRegionCharts("http://api", "tw");

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect([...result.charts].sort()).toEqual(
      [
        makeRegionChartKey(1, "easy"),
        makeRegionChartKey(1, "expert"),
        makeRegionChartKey(2, "append"),
        makeRegionChartKey(3, "master")
      ].sort()
    );
    expect(mocks.getMusicsByRegionList).toHaveBeenCalledTimes(2);
    expect(mocks.getMusicsByRegionList.mock.calls[0][0]).toMatchObject({
      baseUrl: "http://api",
      path: { region: "tw" },
      query: { page: 1, page_size: 1000 }
    });
    expect(mocks.getMusicsByRegionList.mock.calls[1][0]).toMatchObject({ query: { page: 2 } });
  });

  it.each([
    ["an SDK error", { error: { message: "boom" } }],
    ["a body without items", { data: {} }],
    ["an empty list", page([])],
    ["a song without an id", page([song(null, ["expert"])])],
    ["an unknown difficulty", page([song(1, ["expert", "legendary"])])],
    ["a song without difficulties", page([{ id: 1 }])]
  ])("is unavailable for %s", async (_label, response) => {
    mocks.getMusicsByRegionList.mockResolvedValueOnce(response);

    expect(await loadRegionCharts("http://api", "en")).toEqual({ status: "unavailable" });
  });

  it("is unavailable when a later page fails, instead of returning a partial list", async () => {
    mocks.getMusicsByRegionList
      .mockResolvedValueOnce(page([song(1, ["expert"])], true))
      .mockResolvedValueOnce({ error: { message: "boom" } });

    expect(await loadRegionCharts("http://api", "kr")).toEqual({ status: "unavailable" });
  });

  it("is unavailable when the request rejects", async () => {
    mocks.getMusicsByRegionList.mockRejectedValueOnce(new Error("network"));

    expect(await loadRegionCharts("http://api", "kr")).toEqual({ status: "unavailable" });
  });

  it("caches a successful list per region and does not cache a failure", async () => {
    mocks.getMusicsByRegionList.mockResolvedValue(page([song(1, ["expert"])]));

    await loadRegionCharts("http://api", "tw");
    await loadRegionCharts("http://api", "tw");
    expect(mocks.getMusicsByRegionList).toHaveBeenCalledTimes(1);
    await loadRegionCharts("http://api", "en");
    expect(mocks.getMusicsByRegionList).toHaveBeenCalledTimes(2);

    mocks.getMusicsByRegionList.mockReset().mockRejectedValue(new Error("network"));
    await loadRegionCharts("http://api", "kr");
    await loadRegionCharts("http://api", "kr");
    expect(mocks.getMusicsByRegionList).toHaveBeenCalledTimes(2);
  });
});
