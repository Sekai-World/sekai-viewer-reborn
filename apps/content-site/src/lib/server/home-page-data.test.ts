import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { fetchUnitProfiles, toUnitProfileMap } = vi.hoisted(() => ({
  fetchUnitProfiles: vi.fn(),
  toUnitProfileMap: vi.fn()
}));

vi.mock("$lib/server/unit-profiles", () => ({ fetchUnitProfiles, toUnitProfileMap }));

const { loadGameNews } = vi.hoisted(() => ({ loadGameNews: vi.fn() }));
vi.mock("$lib/server/game-news", () => ({ loadGameNews }));

import {
  fetchLatestGachas,
  fetchRegionLatestData,
  loadHomeLatestData,
  loadHomeNews,
  loadHomeRegionData,
  loadHomeRegionEventCard,
  parseRegionVersions,
  parseVersionsByRegion
} from "./home-page-data";

const BASE_URL = "https://master-api.test";
const REGION = "jp" as const;
const NOW = Date.parse("2026-09-05T12:00:00.000Z");

const homeRegionOptions = {
  baseUrl: BASE_URL,
  region: REGION,
  unavailableErrorText: "unavailable",
  requestFailedErrorText: "request failed"
};

describe("home page data", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    getCardsByRegionList.mockReset();
    getEventsByRegionCurrent.mockReset();
    getGachasByRegionList.mockReset();
    getMusicsByRegionList.mockReset();
    fetchUnitProfiles.mockReset();
    toUnitProfileMap.mockReset();
    loadGameNews.mockReset();

    getCardsByRegionList.mockResolvedValue({ data: { items: [] } });
    getEventsByRegionCurrent.mockResolvedValue({ data: null });
    getGachasByRegionList.mockResolvedValue({ data: { items: [] } });
    getMusicsByRegionList.mockResolvedValue({ data: { items: [] } });
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReturnValue({});
    loadGameNews.mockResolvedValue({ status: "empty" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("version parsing", () => {
    it("supports aliases, numeric CDN versions, and invalid payloads", () => {
      expect(parseRegionVersions(null)).toBeNull();
      expect(
        parseRegionVersions({
          app_version: " 1.0.0 ",
          dataVersion: "2.0.0",
          asset_version: "3.0.0",
          cdnVersion: 4
        })
      ).toEqual({
        appVersion: " 1.0.0 ",
        dataVersion: "2.0.0",
        assetVersion: "3.0.0",
        cdnVersion: "4"
      });

      expect(parseVersionsByRegion(null)).toEqual({});
      expect(
        parseVersionsByRegion({
          jp: { data_version: "jp-data" },
          cn: "invalid"
        })
      ).toMatchObject({
        jp: {
          appVersion: null,
          dataVersion: "jp-data",
          assetVersion: null,
          cdnVersion: null
        },
        en: null,
        tw: null,
        kr: null,
        cn: null
      });
    });
  });

  describe("gacha loading", () => {
    it("returns the display limit of valid ongoing gachas without a fallback request", async () => {
      getGachasByRegionList.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 100,
              name: "New ongoing",
              assetbundleName: "gacha_new",
              startAt: NOW,
              endAt: NOW + 10_000
            },
            {
              id: "older",
              name: "Older ongoing",
              startAt: NOW - 10_000,
              endAt: NOW + 20_000
            },
            null,
            { id: "future", name: "Future", startAt: NOW + 1, endAt: NOW + 2 }
          ]
        }
      });

      const gachas = await fetchLatestGachas(BASE_URL, REGION);

      expect(getGachasByRegionList).toHaveBeenCalledTimes(1);
      expect(gachas.map((gacha) => gacha.id)).toEqual(["100", "older"]);
      expect(gachas[0]).toMatchObject({
        name: "New ongoing",
        assetBundleName: "gacha_new"
      });
    });

    it("fills the remaining slots from the latest query and filters invalid items", async () => {
      getGachasByRegionList.mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "ended",
              name: "Ended",
              startAt: NOW - 2_000,
              endAt: NOW - 1_000
            },
            { name: "Missing id" },
            { id: "future", name: "Future", startAt: NOW + 1, endAt: NOW + 2 }
          ]
        }
      });

      const gachas = await fetchLatestGachas(BASE_URL, REGION);
      const requests = getGachasByRegionList.mock.calls.map(([request]) => request);

      expect(requests).toHaveLength(2);
      expect(requests[1].query).toMatchObject({ page: 1, page_size: 2 });
      expect(gachas.map((gacha) => gacha.id)).toEqual(["ended"]);
    });

    it("returns no items when both gacha requests report errors", async () => {
      getGachasByRegionList
        .mockResolvedValueOnce({ error: { status: 503 } })
        .mockResolvedValueOnce({ data: null });

      await expect(fetchLatestGachas(BASE_URL, REGION)).resolves.toEqual([]);
      expect(getGachasByRegionList).toHaveBeenCalledTimes(2);
    });
  });

  describe("latest data loading", () => {
    it("parses card rarity metadata and music aliases while filtering malformed items", async () => {
      getGachasByRegionList.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "ongoing",
              name: "Ongoing",
              startAt: NOW - 1_000,
              endAt: NOW + 1_000
            },
            {
              id: "ongoing-2",
              name: "Ongoing 2",
              startAt: NOW - 2_000,
              endAt: NOW + 2_000
            }
          ]
        }
      });
      getCardsByRegionList.mockResolvedValue({
        data: {
          items: [
            {
              id: 1,
              prefix: "Card one",
              assetBundleName: "card_one",
              attr: "cute",
              cardRarity: { cardRarityType: "rarity_4" },
              initial_special_training_status: "done",
              archivePublishedAt: 10
            },
            {
              id: "card-two",
              cardRarity: { cardRarityType: "unknown" },
              releaseAt: "2026-09-01T00:00:00.000Z"
            },
            { id: "card-no-rarity" },
            {},
            null
          ]
        }
      });
      getMusicsByRegionList.mockResolvedValue({
        data: {
          items: [
            {
              id: 2,
              title: "Song",
              assetbundleName: "song",
              composer: "Composer",
              publishedAt: 20
            },
            {},
            null
          ]
        }
      });

      const result = await fetchRegionLatestData(BASE_URL, REGION);

      expect(result).toEqual({
        region: REGION,
        cards: [
          {
            id: "1",
            prefix: "Card one",
            assetBundleName: "card_one",
            attr: "cute",
            rarityType: "rarity_4",
            initialSpecialTrainingStatus: "done",
            rarityCount: 4,
            releaseAt: 10
          },
          {
            id: "card-two",
            prefix: null,
            assetBundleName: null,
            attr: null,
            rarityType: "unknown",
            initialSpecialTrainingStatus: null,
            rarityCount: 0,
            releaseAt: "2026-09-01T00:00:00.000Z"
          },
          {
            id: "card-no-rarity",
            prefix: null,
            assetBundleName: null,
            attr: null,
            rarityType: null,
            initialSpecialTrainingStatus: null,
            rarityCount: 0,
            releaseAt: null
          }
        ],
        musics: [
          {
            id: "2",
            title: "Song",
            assetBundleName: "song",
            composer: "Composer",
            publishedAt: 20
          }
        ],
        gachas: [
          expect.objectContaining({ id: "ongoing" }),
          expect.objectContaining({ id: "ongoing-2" })
        ]
      });
    });

    it("uses empty lists for malformed list payloads and isolates request failures", async () => {
      getCardsByRegionList.mockResolvedValueOnce({ data: null });
      getMusicsByRegionList.mockResolvedValueOnce({ data: { items: "invalid" } });
      getGachasByRegionList.mockResolvedValueOnce({ data: { items: [] } });

      await expect(fetchRegionLatestData(BASE_URL, REGION)).resolves.toEqual({
        region: REGION,
        cards: [],
        musics: [],
        gachas: []
      });

      getCardsByRegionList.mockRejectedValueOnce(new Error("cards unavailable"));

      await expect(loadHomeLatestData(BASE_URL, REGION)).resolves.toEqual({
        region: REGION,
        cards: [],
        musics: [],
        gachas: []
      });
    });
  });

  describe("event card loading", () => {
    it("parses nested event and unit data and keeps the profile map", async () => {
      const unitProfiles = { "leo/need": "Leo/need" };
      fetchUnitProfiles.mockResolvedValueOnce([{ unit: "leo/need", unitName: "Leo/need" }]);
      toUnitProfileMap.mockReturnValueOnce(unitProfiles);
      getEventsByRegionCurrent.mockResolvedValueOnce({
        data: {
          event: {
            eventId: 42,
            title: "Event title",
            event_type: "marathon",
            unit: { unit: "leo/need" },
            startDate: NOW - 10_000,
            aggregate_at: NOW + 10_000,
            assetbundleName: "event_asset"
          }
        }
      });

      await expect(loadHomeRegionEventCard(homeRegionOptions)).resolves.toEqual({
        region: REGION,
        label: "JP",
        event: {
          id: "42",
          title: "Event title",
          eventType: "marathon",
          unit: "leo/need",
          startAt: NOW - 10_000,
          endAt: NOW + 10_000,
          assetBundleName: "event_asset"
        },
        unitProfiles,
        error: null
      });
    });

    it("falls back to direct event fields and returns a null summary when required fields are absent", async () => {
      getEventsByRegionCurrent.mockResolvedValueOnce({
        data: {
          id: "direct-event",
          name: "Direct event",
          unit: "mixed",
          start_at: NOW - 1_000,
          endAt: NOW + 1_000
        }
      });

      const directResult = await loadHomeRegionEventCard(homeRegionOptions);

      expect(directResult.event).toEqual({
        id: "direct-event",
        title: "Direct event",
        eventType: null,
        unit: "mixed",
        startAt: NOW - 1_000,
        endAt: NOW + 1_000,
        assetBundleName: null
      });

      getEventsByRegionCurrent.mockResolvedValueOnce({ data: { id: "missing-title" } });

      await expect(loadHomeRegionEventCard(homeRegionOptions)).resolves.toMatchObject({
        event: null,
        error: null
      });
    });

    it("uses the unavailable message for an API error and the failed message for a rejected request", async () => {
      const unitProfiles = { unit: "Unit" };
      toUnitProfileMap.mockReturnValue(unitProfiles);
      getEventsByRegionCurrent.mockResolvedValueOnce({ error: { status: 503 } });

      await expect(loadHomeRegionEventCard(homeRegionOptions)).resolves.toMatchObject({
        event: null,
        unitProfiles,
        error: "unavailable"
      });

      getEventsByRegionCurrent.mockRejectedValueOnce(new Error("event unavailable"));

      await expect(loadHomeRegionEventCard(homeRegionOptions)).resolves.toEqual({
        region: REGION,
        label: "JP",
        event: null,
        unitProfiles: {},
        error: "request failed"
      });
    });
  });

  describe("combined loading", () => {
    it("returns the region card, latest data, and news result together", async () => {
      loadGameNews.mockResolvedValueOnce({ status: "ready", items: [{ id: 1 }] });
      getEventsByRegionCurrent.mockResolvedValueOnce({
        data: { id: "event", name: "Event" }
      });

      const result = await loadHomeRegionData(homeRegionOptions);

      expect(result).toMatchObject({
        region: REGION,
        card: { event: { id: "event", title: "Event" } },
        latestData: { region: REGION, cards: [], musics: [], gachas: [] },
        news: { status: "ready" }
      });
    });

    it("converts a rejected news load to an error result", async () => {
      loadGameNews.mockRejectedValueOnce(new Error("news unavailable"));

      await expect(loadHomeNews(REGION)).resolves.toEqual({ status: "error" });
    });
  });
});
