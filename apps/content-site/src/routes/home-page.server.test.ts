import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList,
  getVersions
} = vi.hoisted(() => ({
  getCardsByRegionList: vi.fn(),
  getEventsByRegionCurrent: vi.fn(),
  getGachasByRegionList: vi.fn(),
  getMusicsByRegionList: vi.fn(),
  getVersions: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList,
  getVersions
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

import { load } from "./+page.server";

type LatestData = {
  region: string;
  cards: { id: string; initialSpecialTrainingStatus: string | null }[];
  gachas: { id: string }[];
};

const emptyListResponse = {
  data: {
    items: [],
    pagination: { page: 1, page_size: 10, has_next: false, total: 0, total_pages: 1 }
  }
};

const loadHomepageLatestData = async (): Promise<LatestData[]> => {
  const result = (await load({
    cookies: { get: () => undefined },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0])) as {
    latestData: Promise<LatestData>[];
  };

  return Promise.all(result.latestData);
};

describe("homepage latest gacha loading", () => {
  beforeEach(() => {
    getCardsByRegionList.mockResolvedValue({ data: { items: [] } });
    getEventsByRegionCurrent.mockResolvedValue({ data: null });
    getMusicsByRegionList.mockResolvedValue({ data: { items: [] } });
    getVersions.mockResolvedValue({ data: {} });
    getServerI18nText.mockResolvedValue("translated");
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReturnValue({});
    getGachasByRegionList.mockReset();
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

    const latestData = await loadHomepageLatestData();
    const jpData = latestData.find((regionData) => regionData.region === "jp");

    expect(jpData?.cards).toEqual([
      expect.objectContaining({ id: "trained-card", initialSpecialTrainingStatus: "done" })
    ]);
  });

  it("requests the next gacha page when the first page only contains future entries", async () => {
    const futureItems = Array.from({ length: 10 }, (_, index) => ({
      id: `future-${index}`,
      name: `Future ${index}`,
      assetbundleName: `future_${index}`,
      startAt: "2999-01-01T00:00:00.000Z",
      endAt: "3000-01-01T00:00:00.000Z"
    }));

    getGachasByRegionList.mockImplementation(async ({ path, query }) => {
      if (path.region === "jp" && query.page === 1) {
        return {
          data: {
            items: futureItems,
            pagination: { page: 1, page_size: 10, has_next: true, total: 12, total_pages: 2 }
          }
        };
      }

      if (path.region === "jp" && query.page === 2) {
        return {
          data: {
            items: [
              {
                id: "started-new",
                name: "Started new",
                assetbundleName: "started_new",
                startAt: "2026-01-01T00:00:00.000Z",
                endAt: "2026-01-02T00:00:00.000Z"
              },
              {
                id: "started-old",
                name: "Started old",
                assetbundleName: "started_old",
                startAt: "2025-01-01T00:00:00.000Z",
                endAt: "2025-01-02T00:00:00.000Z"
              }
            ],
            pagination: { page: 2, page_size: 10, has_next: false, total: 12, total_pages: 2 }
          }
        };
      }

      return emptyListResponse;
    });

    const latestData = await loadHomepageLatestData();
    const jpData = latestData.find((regionData) => regionData.region === "jp");
    const jpGachaRequests = getGachasByRegionList.mock.calls.filter(
      ([request]) => request.path.region === "jp"
    );

    expect(jpGachaRequests.map(([request]) => request.query.page)).toEqual([1, 2]);
    expect(jpData?.gachas.map((gacha) => gacha.id)).toEqual(["started-new", "started-old"]);
  });

  it("keeps an older ongoing gacha ahead of ended gachas from the first page", async () => {
    const now = Date.now();
    getGachasByRegionList.mockImplementation(async ({ path, query }) => {
      if (path.region === "jp" && query.page === 1) {
        return {
          data: {
            items: [
              {
                id: "ended-new",
                name: "Ended new",
                startAt: now - 2_000,
                endAt: now - 1_000
              },
              {
                id: "ended-old",
                name: "Ended old",
                startAt: now - 4_000,
                endAt: now - 3_000
              }
            ],
            pagination: { page: 1, page_size: 10, has_next: true, total: 3, total_pages: 2 }
          }
        };
      }

      if (path.region === "jp" && query.page === 2) {
        return {
          data: {
            items: [
              {
                id: "ongoing-old",
                name: "Ongoing old",
                startAt: now - 10_000,
                endAt: now + 10_000
              }
            ],
            pagination: { page: 2, page_size: 10, has_next: false, total: 3, total_pages: 2 }
          }
        };
      }

      return emptyListResponse;
    });

    const latestData = await loadHomepageLatestData();
    const jpData = latestData.find((regionData) => regionData.region === "jp");
    const jpGachaRequests = getGachasByRegionList.mock.calls.filter(
      ([request]) => request.path.region === "jp"
    );

    expect(jpGachaRequests.map(([request]) => request.query.page)).toEqual([1, 2]);
    expect(jpData?.gachas.map((gacha) => gacha.id)).toEqual(["ongoing-old", "ended-new"]);
  });

  it("follows authoritative pagination beyond ten future-only pages", async () => {
    const totalPages = 12;
    getGachasByRegionList.mockImplementation(async ({ path, query }) => {
      if (path.region === "jp" && query.page <= totalPages) {
        const page = query.page;
        const pagination = {
          page,
          page_size: 10,
          has_next: page < totalPages,
          total: totalPages * 10,
          total_pages: totalPages
        };

        if (page === totalPages) {
          return {
            data: {
              items: [
                {
                  id: "started-after-pagination",
                  name: "Started after pagination",
                  startAt: "2026-01-01T00:00:00.000Z",
                  endAt: "2026-01-02T00:00:00.000Z"
                },
                {
                  id: "started-second-after-pagination",
                  name: "Started second after pagination",
                  startAt: "2025-01-01T00:00:00.000Z",
                  endAt: "2025-01-02T00:00:00.000Z"
                }
              ],
              pagination
            }
          };
        }

        return {
          data: {
            items: Array.from({ length: 10 }, (_, index) => ({
              id: `future-${page}-${index}`,
              name: `Future ${page}-${index}`,
              startAt: "2999-01-01T00:00:00.000Z",
              endAt: "3000-01-01T00:00:00.000Z"
            })),
            pagination
          }
        };
      }

      return emptyListResponse;
    });

    const latestData = await loadHomepageLatestData();
    const jpData = latestData.find((regionData) => regionData.region === "jp");
    const jpGachaRequests = getGachasByRegionList.mock.calls.filter(
      ([request]) => request.path.region === "jp"
    );

    expect(jpGachaRequests.map(([request]) => request.query.page)).toEqual(
      Array.from({ length: totalPages }, (_, index) => index + 1)
    );
    expect(jpData?.gachas.map((gacha) => gacha.id)).toEqual([
      "started-after-pagination",
      "started-second-after-pagination"
    ]);
  });

  it("stops non-terminating pagination at the emergency request ceiling", async () => {
    const emergencyRequestCeiling = 100;
    getGachasByRegionList.mockImplementation(async ({ path, query }) => {
      if (path.region === "jp") {
        return {
          data: {
            items: [
              {
                id: `future-${query.page}`,
                name: `Future ${query.page}`,
                startAt: "2999-01-01T00:00:00.000Z",
                endAt: "3000-01-01T00:00:00.000Z"
              }
            ],
            pagination: { has_next: true }
          }
        };
      }

      return emptyListResponse;
    });

    await loadHomepageLatestData();
    const jpGachaRequests = getGachasByRegionList.mock.calls.filter(
      ([request]) => request.path.region === "jp"
    );

    expect(jpGachaRequests).toHaveLength(emergencyRequestCeiling);
    expect(jpGachaRequests[emergencyRequestCeiling - 1]?.[0].query.page).toBe(
      emergencyRequestCeiling
    );
  });
});
