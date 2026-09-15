import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REGION, PREFERRED_REGION_COOKIE_NAME } from "$lib/i18n/region";

const {
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList,
  getVersions,
  loadGameNews
} = vi.hoisted(() => ({
  getCardsByRegionList: vi.fn(),
  getEventsByRegionCurrent: vi.fn(),
  getGachasByRegionList: vi.fn(),
  getMusicsByRegionList: vi.fn(),
  getVersions: vi.fn(),
  loadGameNews: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList,
  getVersions
}));

vi.mock("$lib/server/game-news", () => ({ loadGameNews }));

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

import { load } from "./+page.server";

type HomepageLatestData = {
  region: string;
  cards: { id: string; initialSpecialTrainingStatus: string | null }[];
  gachas: { id: string }[];
};

type HomepageRegionData = {
  region: string;
  card: { region: string };
  latestData: HomepageLatestData;
  news: HomepageNewsResult;
};

type HomepageNewsResult =
  { status: "ready"; items: unknown[] } | { status: "empty" | "error" | "unavailable" };

const emptyListResponse = {
  data: {
    items: [],
    pagination: { page: 1, page_size: 10, has_next: false, total: 0, total_pages: 1 }
  }
};

const loadHomepageRegionData = async (preferredRegion?: string): Promise<HomepageRegionData> => {
  const result = (await load({
    cookies: {
      get: (name: string) => (name === PREFERRED_REGION_COOKIE_NAME ? preferredRegion : undefined)
    },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0])) as {
    initialRegion: string;
    initialCard: Promise<HomepageRegionData["card"]>;
    initialLatestData: Promise<HomepageLatestData>;
    initialNews: Promise<HomepageNewsResult>;
  };
  const [card, latestData, news] = await Promise.all([
    result.initialCard,
    result.initialLatestData,
    result.initialNews
  ]);

  return { region: result.initialRegion, card, latestData, news };
};

const loadHomepagePage = async () => {
  const result = (await load({
    cookies: { get: () => undefined },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0])) as {
    versionsByRegion: unknown;
    initialCard: Promise<unknown>;
    initialLatestData: Promise<unknown>;
    initialNews: Promise<unknown>;
  };

  await Promise.all([result.initialCard, result.initialLatestData, result.initialNews]);
  return result;
};

describe("homepage latest gacha loading", () => {
  beforeEach(() => {
    getCardsByRegionList.mockReset();
    getEventsByRegionCurrent.mockReset();
    getMusicsByRegionList.mockReset();
    getVersions.mockReset();
    getServerI18nText.mockReset();
    getMasterApiBaseUrl.mockReset();
    fetchUnitProfiles.mockReset();
    toUnitProfileMap.mockReset();
    getCardsByRegionList.mockResolvedValue({ data: { items: [] } });
    getEventsByRegionCurrent.mockResolvedValue({ data: null });
    getMusicsByRegionList.mockResolvedValue({ data: { items: [] } });
    getVersions.mockResolvedValue({ data: {} });
    getServerI18nText.mockResolvedValue("translated");
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReturnValue({});
    getGachasByRegionList.mockReset();
    loadGameNews.mockReset();
    loadGameNews.mockResolvedValue({ status: "empty" });
  });

  it("preserves special-training metadata for homepage card thumbnails", async () => {
    getCardsByRegionList.mockResolvedValue({
      data: {
        items: [
          {
            id: "trained-card",
            prefix: "Trained card",
            assetbundleName: "trained_card",
            attr: "cute",
            cardRarity: { cardRarityType: "rarity_4" },
            initialSpecialTrainingStatus: "done"
          }
        ]
      }
    });
    getGachasByRegionList.mockResolvedValue(emptyListResponse);

    const regionData = await loadHomepageRegionData();

    expect(regionData.latestData.cards).toEqual([
      expect.objectContaining({ id: "trained-card", initialSpecialTrainingStatus: "done" })
    ]);
  });

  it("requests ongoing gachas first with only the display-sized page", async () => {
    const now = Date.now();
    getGachasByRegionList.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "ongoing-new",
            name: "Ongoing new",
            startAt: now - 1_000,
            endAt: now + 10_000
          },
          {
            id: "ongoing-old",
            name: "Ongoing old",
            startAt: now - 2_000,
            endAt: now + 20_000
          }
        ],
        pagination: { page: 1, page_size: 2, has_next: false }
      }
    });

    const regionData = await loadHomepageRegionData();

    expect(getGachasByRegionList).toHaveBeenCalledTimes(1);
    expect(getGachasByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "jp" },
      query: {
        page: 1,
        page_size: 2,
        spoiler: false,
        ongoing: true,
        sort_by: "startAt",
        sort_order: "desc"
      }
    });
    expect(regionData.latestData.gachas.map((gacha) => gacha.id)).toEqual([
      "ongoing-new",
      "ongoing-old"
    ]);
  });

  it("fills the remaining slot with an exact-sized ordinary latest query", async () => {
    const now = Date.now();
    getGachasByRegionList
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "ongoing",
              name: "Ongoing",
              startAt: now - 10_000,
              endAt: now + 10_000
            }
          ],
          pagination: { page: 1, page_size: 2, has_next: false }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "ongoing",
              name: "Duplicate ongoing",
              startAt: now - 10_000,
              endAt: now + 10_000
            },
            {
              id: "ended-new",
              name: "Ended new",
              startAt: now - 1_000,
              endAt: now - 500
            },
            {
              id: "future",
              name: "Future",
              startAt: now + 10_000,
              endAt: now + 20_000
            }
          ],
          pagination: { page: 1, page_size: 1, has_next: false }
        }
      });

    const regionData = await loadHomepageRegionData();
    const requests = getGachasByRegionList.mock.calls.map(([request]) => request);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      path: { region: "jp" },
      query: { page: 1, page_size: 2, ongoing: true }
    });
    expect(requests[1]).toMatchObject({
      path: { region: "jp" },
      query: {
        page: 1,
        page_size: 1,
        spoiler: false,
        sort_by: "startAt",
        sort_order: "desc"
      }
    });
    expect(requests[1].query).not.toHaveProperty("ongoing");
    expect(regionData.latestData.gachas.map((gacha) => gacha.id)).toEqual(["ongoing", "ended-new"]);
  });

  it("uses the full gap and excludes future, invalid, and duplicate entries", async () => {
    const now = Date.now();
    getGachasByRegionList
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "future-ongoing",
              name: "Future",
              startAt: now + 10_000,
              endAt: now + 20_000
            },
            {
              id: "invalid-ongoing",
              name: "Invalid",
              startAt: "not-a-date",
              endAt: now + 20_000
            }
          ],
          pagination: { page: 1, page_size: 2, has_next: false }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "ended-new",
              name: "Ended new",
              startAt: now - 1_000,
              endAt: now - 500
            },
            {
              id: "ended-new",
              name: "Duplicate ended new",
              startAt: now - 1_000,
              endAt: now - 500
            },
            {
              id: "ended-old",
              name: "Ended old",
              startAt: now - 2_000,
              endAt: now - 1_500
            },
            {
              id: "future",
              name: "Future",
              startAt: now + 10_000,
              endAt: now + 20_000
            },
            { id: "invalid", name: "Invalid", startAt: "not-a-date", endAt: now }
          ],
          pagination: { page: 1, page_size: 2, has_next: false }
        }
      });

    const regionData = await loadHomepageRegionData();
    const requests = getGachasByRegionList.mock.calls.map(([request]) => request);

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.query.page_size)).toEqual([2, 2]);
    expect(regionData.latestData.gachas.map((gacha) => gacha.id)).toEqual([
      "ended-new",
      "ended-old"
    ]);
  });

  it("does not issue a fallback query after two valid ongoing gachas", async () => {
    const now = Date.now();
    getGachasByRegionList.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "ongoing-new",
            name: "Ongoing new",
            startAt: now - 1_000,
            endAt: now + 10_000
          },
          {
            id: "ongoing-old",
            name: "Ongoing old",
            startAt: now - 2_000,
            endAt: now + 20_000
          },
          {
            id: "ongoing-new",
            name: "Duplicate ongoing",
            startAt: now - 1_000,
            endAt: now + 10_000
          },
          {
            id: "future",
            name: "Future",
            startAt: now + 10_000,
            endAt: now + 20_000
          }
        ],
        pagination: { page: 1, page_size: 2, has_next: true }
      }
    });

    const regionData = await loadHomepageRegionData();

    expect(getGachasByRegionList).toHaveBeenCalledTimes(1);
    expect(regionData.latestData.gachas.map((gacha) => gacha.id)).toEqual([
      "ongoing-new",
      "ongoing-old"
    ]);
  });

  it("prefetches only the default region for homepage data", async () => {
    const regionData = await loadHomepageRegionData();

    expect(regionData.region).toBe(DEFAULT_REGION);
    expect(getCardsByRegionList.mock.calls.map(([request]) => request.path.region)).toEqual([
      DEFAULT_REGION
    ]);
    expect(getEventsByRegionCurrent.mock.calls.map(([request]) => request.path.region)).toEqual([
      DEFAULT_REGION
    ]);
    expect(getMusicsByRegionList.mock.calls.map(([request]) => request.path.region)).toEqual([
      DEFAULT_REGION
    ]);
    expect(getGachasByRegionList.mock.calls.map(([request]) => request.path.region)).toEqual([
      DEFAULT_REGION
    ]);
    expect(loadGameNews.mock.calls.map(([region]) => region)).toEqual([DEFAULT_REGION]);
  });

  it("uses the persisted cookie region for the initial SSR data load", async () => {
    const regionData = await loadHomepageRegionData("kr");

    expect(regionData.region).toBe("kr");
    expect(getCardsByRegionList.mock.calls.map(([request]) => request.path.region)).toEqual(["kr"]);
    expect(getEventsByRegionCurrent.mock.calls.map(([request]) => request.path.region)).toEqual([
      "kr"
    ]);
    expect(getMusicsByRegionList.mock.calls.map(([request]) => request.path.region)).toEqual([
      "kr"
    ]);
    expect(getGachasByRegionList.mock.calls.map(([request]) => request.path.region)).toEqual([
      "kr"
    ]);
    expect(loadGameNews.mock.calls.map(([region]) => region)).toEqual(["kr"]);
  });

  it("isolates a rejected initial-region game news load", async () => {
    loadGameNews.mockRejectedValueOnce(new Error("news unavailable"));

    const regionData = await loadHomepageRegionData();

    expect(regionData.news).toEqual({ status: "error" });
    expect(loadGameNews.mock.calls.map(([region]) => region)).toEqual([DEFAULT_REGION]);
  });

  it("keeps versions empty when the versions request fails", async () => {
    getVersions.mockResolvedValueOnce({ error: { status: 503 } });
    expect((await loadHomepagePage()).versionsByRegion).toEqual({});

    getVersions.mockRejectedValueOnce(new Error("versions unavailable"));
    expect((await loadHomepagePage()).versionsByRegion).toEqual({});
  });
});
