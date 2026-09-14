import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: {} }));

const listEndpointMocks = vi.hoisted(() => ({
  getActionSetsByRegionList: vi.fn(),
  getCardEpisodesByRegionList: vi.fn(),
  getCharacter2DsByRegionList: vi.fn(),
  getCharacterProfilesByRegionList: vi.fn(),
  getEventStoriesByRegionList: vi.fn(),
  getEventsByRegionList: vi.fn(),
  getGameCharactersByRegionList: vi.fn(),
  getMobCharactersByRegionList: vi.fn(),
  getSpecialStoriesByRegionList: vi.fn(),
  getSubGameCharactersByRegionList: vi.fn(),
  getUnitProfilesByRegionList: vi.fn(),
  getUnitStoriesByRegionList: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => listEndpointMocks);

import {
  clearStoryMasterDataCacheForTests,
  fetchStoryCharacterTables,
  fetchStoryCollection,
  fetchStoryCollections
} from "./master-data-client.server";

const okPage = (items: unknown[], hasNext = false) => ({
  data: { items, pagination: { has_next: hasNext } }
});

const unitStoryRow = {
  unit: "idol",
  seq: 1,
  chapters: [
    {
      id: 1,
      unit: "idol",
      chapterNo: 1,
      title: "Chapter 1",
      assetbundleName: "idol-story-chapter",
      episodes: [
        {
          id: 1,
          chapterNo: 1,
          episodeNo: 1,
          episodeNoLabel: "",
          title: "EP1",
          assetbundleName: "ep1",
          scenarioId: "idol_01_01",
          releaseConditionId: 5
        }
      ]
    }
  ]
};

describe("story master-data client", () => {
  beforeEach(() => {
    clearStoryMasterDataCacheForTests();
    for (const mock of Object.values(listEndpointMocks)) {
      mock.mockReset();
    }
  });
  afterEach(() => {
    clearStoryMasterDataCacheForTests();
  });

  it("reads a collection through the paginated list endpoint and keeps story fields", async () => {
    listEndpointMocks.getUnitStoriesByRegionList
      .mockResolvedValueOnce(okPage([unitStoryRow], true))
      .mockResolvedValueOnce(okPage([]));

    const result = await fetchStoryCollection("jp", "unitStories", {
      baseUrl: "https://master.test/api/v1"
    });

    expect(listEndpointMocks.getUnitStoriesByRegionList).toHaveBeenCalledTimes(2);
    expect(listEndpointMocks.getUnitStoriesByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master.test/api/v1",
      fetch: expect.any(Function),
      path: { region: "jp" },
      query: { page: 1, page_size: 100, spoiler: true }
    });
    expect(result).toEqual([
      {
        unit: "idol",
        seq: 1,
        chapters: [
          {
            id: 1,
            unit: "idol",
            chapterNo: 1,
            title: "Chapter 1",
            assetbundleName: "idol-story-chapter",
            episodes: [
              {
                id: 1,
                chapterNo: 1,
                episodeNo: 1,
                episodeNoLabel: undefined,
                title: "EP1",
                assetbundleName: "ep1",
                scenarioId: "idol_01_01",
                releaseConditionId: 5
              }
            ]
          }
        ]
      }
    ]);
  });

  it("requests each region through the same endpoint with its region path", async () => {
    listEndpointMocks.getActionSetsByRegionList.mockResolvedValue(okPage([]));
    await fetchStoryCollection("en", "actionSets", {
      baseUrl: "https://master.test/api/v1"
    });
    expect(listEndpointMocks.getActionSetsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({ path: { region: "en" } })
    );
  });

  it("recovers the card episode release condition id from the expanded record", async () => {
    listEndpointMocks.getCardEpisodesByRegionList.mockResolvedValue(
      okPage([
        {
          id: 10,
          cardId: 3,
          seq: 1,
          title: "EP1",
          scenarioId: "card_3_ep1",
          releaseCondition: { id: 5, releaseConditionType: "none" }
        },
        { id: 11, cardId: 3, seq: 2, title: "EP2", scenarioId: "card_3_ep2", releaseCondition: null }
      ])
    );

    const result = await fetchStoryCollection("jp", "cardEpisodes", {
      baseUrl: "https://master.test/api/v1"
    });
    expect(result).toEqual([
      {
        id: 10,
        cardId: 3,
        title: "EP1",
        scenarioId: "card_3_ep1",
        assetbundleName: undefined,
        releaseConditionId: 5
      },
      {
        id: 11,
        cardId: 3,
        title: "EP2",
        scenarioId: "card_3_ep2",
        assetbundleName: undefined,
        releaseConditionId: undefined
      }
    ]);
  });

  it("treats a region without the synced entity as an empty collection", async () => {
    listEndpointMocks.getCardEpisodesByRegionList.mockResolvedValue({
      error: { body: { code: "REGION_DATA_NOT_READY" } },
      response: new Response(null, { status: 503 })
    });
    const result = await fetchStoryCollection("tw", "cardEpisodes", {
      baseUrl: "https://master.test/api/v1"
    });
    expect(result).toEqual([]);
  });

  it("throws for other endpoint failures", async () => {
    listEndpointMocks.getEventsByRegionList.mockResolvedValue({
      error: { body: { code: "EVENT_QUERY_ERROR" } },
      response: new Response(null, { status: 500 })
    });
    await expect(
      fetchStoryCollection("jp", "events", { baseUrl: "https://master.test/api/v1" })
    ).rejects.toThrow(/events \(500\)/);

    listEndpointMocks.getEventsByRegionList.mockResolvedValue({ error: {} });
    await expect(
      fetchStoryCollection("jp", "events", { baseUrl: "https://master.test/api/v1" })
    ).rejects.toThrow(/unknown error/);
  });

  it("requires a configured sekai-master-api base url", async () => {
    await expect(fetchStoryCollection("jp", "events", { baseUrl: "" })).rejects.toThrow(
      /SEKAI_MASTER_API_BASE_URL/
    );
    expect(listEndpointMocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("caches collections until the TTL expires", async () => {
    let now = 1_000_000;
    listEndpointMocks.getUnitStoriesByRegionList.mockResolvedValue(
      okPage([unitStoryRow])
    );
    const options = {
      baseUrl: "https://master.test/api/v1",
      now: () => now,
      ttlMs: 50
    };

    await fetchStoryCollection("kr", "unitStories", options);
    await fetchStoryCollection("kr", "unitStories", options);
    expect(listEndpointMocks.getUnitStoriesByRegionList).toHaveBeenCalledTimes(1);

    now += 51;
    await fetchStoryCollection("kr", "unitStories", options);
    expect(listEndpointMocks.getUnitStoriesByRegionList).toHaveBeenCalledTimes(2);
  });

  it("fetches only the requested collections", async () => {
    listEndpointMocks.getEventStoriesByRegionList.mockResolvedValue(
      okPage([{ id: 1, eventId: 34, assetbundleName: "event_34", eventStoryEpisodes: [] }])
    );
    listEndpointMocks.getEventsByRegionList.mockResolvedValue(
      okPage([{ id: 34, name: "Bout for Blessing" }])
    );

    const result = await fetchStoryCollections("jp", ["eventStories", "events"], {
      baseUrl: "https://master.test/api/v1"
    });
    expect(result.eventStories).toHaveLength(1);
    expect(result.events).toEqual([{ id: 34, name: "Bout for Blessing" }]);
    expect(result.unitStories).toEqual([]);
    expect(listEndpointMocks.getEventStoriesByRegionList).toHaveBeenCalledTimes(1);
    expect(listEndpointMocks.getEventsByRegionList).toHaveBeenCalledTimes(1);
    expect(listEndpointMocks.getUnitStoriesByRegionList).not.toHaveBeenCalled();
  });

  it("builds character name tables and character2d identity rows", async () => {
    listEndpointMocks.getCharacter2DsByRegionList.mockResolvedValue(
      okPage([
        {
          id: 0,
          characterType: "game_character",
          characterId: 1,
          unit: "light_sound",
          assetName: "cls_01ichika"
        }
      ])
    );
    listEndpointMocks.getGameCharactersByRegionList.mockResolvedValue(
      okPage([{ id: 1, firstName: "星乃", givenName: "一歌" }])
    );
    listEndpointMocks.getMobCharactersByRegionList.mockResolvedValue(
      okPage([{ id: 50, name: "モブ子" }])
    );
    listEndpointMocks.getSubGameCharactersByRegionList.mockResolvedValue(
      okPage([{ id: 90, name: "_sub" }])
    );

    const tables = await fetchStoryCharacterTables("jp", {
      baseUrl: "https://master.test/api/v1"
    });

    expect(tables.character2ds).toEqual([
      {
        id: 0,
        characterType: "game_character",
        characterId: 1,
        unit: "light_sound",
        assetName: "cls_01ichika"
      }
    ]);
    expect(tables.gameCharacterNames.get(1)).toBe("星乃 一歌");
    expect(tables.mobCharacterNames.get(50)).toBe("モブ子");
    expect(tables.subGameCharacterNames.get(90)).toBe("_sub");
  });
});
