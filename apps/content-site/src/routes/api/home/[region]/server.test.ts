import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList
} = vi.hoisted(() => ({
  getCardsByRegionList: vi.fn(),
  getEventsByRegionCurrent: vi.fn(),
  getGachasByRegionList: vi.fn(),
  getMusicsByRegionList: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList
}));

const { getServerI18nText } = vi.hoisted(() => ({ getServerI18nText: vi.fn() }));
vi.mock("$lib/i18n/runtime", () => ({ getServerI18nText }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchUnitProfiles, toUnitProfileMap } = vi.hoisted(() => ({
  fetchUnitProfiles: vi.fn(),
  toUnitProfileMap: vi.fn()
}));
vi.mock("$lib/server/unit-profiles", () => ({ fetchUnitProfiles, toUnitProfileMap }));

const { loadGameNews } = vi.hoisted(() => ({ loadGameNews: vi.fn() }));
vi.mock("$lib/server/game-news", () => ({ loadGameNews }));

import { GET } from "./+server";

describe("homepage region data endpoint", () => {
  beforeEach(() => {
    getCardsByRegionList.mockReset();
    getEventsByRegionCurrent.mockReset();
    getGachasByRegionList.mockReset();
    getMusicsByRegionList.mockReset();
    getServerI18nText.mockReset();
    getMasterApiBaseUrl.mockReset();
    fetchUnitProfiles.mockReset();
    toUnitProfileMap.mockReset();
    loadGameNews.mockReset();

    getCardsByRegionList.mockResolvedValue({ data: { items: [] } });
    getEventsByRegionCurrent.mockResolvedValue({ data: null });
    getGachasByRegionList.mockResolvedValue({
      data: {
        items: [
          {
            id: "ongoing-1",
            name: "Ongoing 1",
            startAt: "2026-01-01T00:00:00.000Z",
            endAt: "2999-01-01T00:00:00.000Z"
          },
          {
            id: "ongoing-2",
            name: "Ongoing 2",
            startAt: "2026-01-02T00:00:00.000Z",
            endAt: "2999-01-02T00:00:00.000Z"
          }
        ],
        pagination: { page: 1, page_size: 10, has_next: true }
      }
    });
    getMusicsByRegionList.mockResolvedValue({ data: { items: [] } });
    getServerI18nText.mockResolvedValue("translated");
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReturnValue({});
    loadGameNews.mockResolvedValue({ status: "empty" });
  });

  it("loads only the requested region when a region is selected", async () => {
    const response = await GET({
      params: { region: "en" },
      cookies: { get: () => undefined },
      fetch: vi.fn()
    } as unknown as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      region: "en",
      card: { region: "en" },
      latestData: { region: "en" },
      news: { status: "empty" }
    });
    expect(getCardsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "en" },
      query: {
        page: 1,
        page_size: 9,
        spoiler: false,
        sort_by: "releaseAt",
        sort_order: "desc"
      }
    });
    expect(getEventsByRegionCurrent).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "en" }
    });
    expect(getMusicsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "en" },
      query: {
        page: 1,
        page_size: 3,
        spoiler: false,
        sort_by: "publishedAt",
        sort_order: "desc"
      }
    });
    expect(loadGameNews).toHaveBeenCalledWith("en");
  });

  it("uses the ongoing homepage gacha request and display limits", async () => {
    await GET({
      params: { region: "tw" },
      cookies: { get: () => undefined },
      fetch: vi.fn()
    } as unknown as Parameters<typeof GET>[0]);

    expect(getGachasByRegionList).toHaveBeenCalledTimes(1);
    expect(getGachasByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "tw" },
      query: {
        page: 1,
        page_size: 2,
        spoiler: false,
        ongoing: true,
        sort_by: "startAt",
        sort_order: "desc"
      }
    });
  });
});
