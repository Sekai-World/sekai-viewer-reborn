import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: {} }));

const listEndpointMocks = vi.hoisted(() => ({
  getActionSetsByRegionList: vi.fn(),
  getCardEpisodesByRegionList: vi.fn(),
  getAreasByRegionList: vi.fn(),
  getCardsByRegionList: vi.fn(),
  getCharacter2DsByRegionList: vi.fn(),
  getCharacterProfilesByRegionList: vi.fn(),
  getEventStoriesByRegionList: vi.fn(),
  getEventsByRegionList: vi.fn(),
  getGameCharactersByRegionList: vi.fn(),
  getMobCharactersByRegionList: vi.fn(),
  getSpecialStoriesByRegionList: vi.fn(),
  getSubGameCharactersByRegionList: vi.fn(),
  getUnitProfilesByRegionList: vi.fn(),
  getUnitStoriesByRegionList: vi.fn(),
  getUnitStoryEpisodeGroupsByRegionList: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => listEndpointMocks);

import {
  clearStoryMasterDataCacheForTests,
  fetchCardEpisodesByCardIds,
  fetchCardListPage,
  fetchEventListPage,
  fetchEventStoriesByEvent,
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

  it("parses card rows into picker summaries with the inlined character", async () => {
    listEndpointMocks.getCardsByRegionList.mockResolvedValue(
      okPage([
        {
          id: 1,
          prefix: "クールだけど友達想い",
          assetbundleName: "res001_no001",
          character: { id: 1, firstName: "星乃", givenName: "一歌" },
          attr: "cool",
          cardRarity: { cardRarityType: "rarity_3", maxLevel: 40 },
          initialSpecialTrainingStatus: "not_doing"
        },
        { id: 2, prefix: null, character: null }
      ])
    );

    const result = await fetchStoryCollection("jp", "cards", {
      baseUrl: "https://master.test/api/v1"
    });
    expect(result).toEqual([
      {
        id: 1,
        name: "クールだけど友達想い",
        assetBundleName: "res001_no001",
        characterId: 1,
        characterName: "星乃 一歌",
        attr: "cool",
        rarityType: "rarity_3",
        initialSpecialTrainingStatus: "not_doing"
      },
      {
        id: 2,
        name: "#2",
        assetBundleName: undefined,
        characterId: undefined,
        characterName: undefined,
        attr: undefined,
        rarityType: undefined,
        initialSpecialTrainingStatus: undefined
      }
    ]);
  });

  it("parses area rows and keeps action set cast ids", async () => {
    listEndpointMocks.getAreasByRegionList.mockResolvedValue(
      okPage([
        {
          id: 5,
          assetbundleName: "area5",
          areaType: "spirit_world",
          name: "教室のセカイ",
          subName: "学校",
          releaseConditionId: 1
        }
      ])
    );
    listEndpointMocks.getActionSetsByRegionList.mockResolvedValue(
      okPage([{ id: 8, areaId: 5, scriptId: "as_x", characterIds: [101, 102] }])
    );

    const areas = await fetchStoryCollection("jp", "areas", {
      baseUrl: "https://master.test/api/v1"
    });
    expect(areas).toEqual([
      {
        id: 5,
        assetBundleName: "area5",
        areaType: "spirit_world",
        name: "教室のセカイ",
        subName: "学校",
        label: undefined
      }
    ]);

    const actionSets = await fetchStoryCollection("jp", "actionSets", {
      baseUrl: "https://master.test/api/v1"
    });
    expect(actionSets).toEqual([
      {
        id: 8,
        areaId: 5,
        scriptId: "as_x",
        scenarioId: undefined,
        characterIds: [101, 102]
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

  it("parses unit story episode groups and episode group ids", async () => {
    listEndpointMocks.getUnitStoriesByRegionList.mockResolvedValue(
      okPage([
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
                  title: "EP1",
                  assetbundleName: "ep1",
                  scenarioId: "idol_01_01",
                  unitStoryEpisodeGroupId: 7
                }
              ]
            }
          ]
        }
      ])
    );
    listEndpointMocks.getUnitStoryEpisodeGroupsByRegionList.mockResolvedValue(
      okPage([{ id: 7, unit: "idol", unitEpisodeCategory: "none", outline: "Main" }])
    );

    const result = await fetchStoryCollections(
      "jp",
      ["unitStories", "unitStoryEpisodeGroups"],
      { baseUrl: "https://master.test/api/v1" }
    );

    expect(listEndpointMocks.getUnitStoryEpisodeGroupsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { region: "jp" },
        query: { page: 1, page_size: 100, spoiler: true }
      })
    );
    expect(result.unitStoryEpisodeGroups).toEqual([
      {
        id: 7,
        unit: "idol",
        unitEpisodeCategory: "none",
        outline: "Main",
        assetbundleName: undefined
      }
    ]);
    expect(result.unitStories[0].chapters[0].episodes[0].unitStoryEpisodeGroupId).toBe(7);
  });
});

describe("fetchEventListPage", () => {
  beforeEach(() => {
    listEndpointMocks.getEventsByRegionList.mockReset();
  });

  it("sends the content-site filter set and parses one page", async () => {
    listEndpointMocks.getEventsByRegionList.mockResolvedValue(
      okPage(
        [
          {
            id: 217,
            name: "Drive to Dream！",
            eventType: "marathon",
            unit: "theme_park",
            assetbundleName: "event_drive_2026",
            startAt: 1789365600000,
            endAt: 1790056799000
          }
        ],
        true
      )
    );

    const result = await fetchEventListPage(
      "jp",
      {
        page: 2,
        pageSize: 12,
        sortBy: "startAt",
        sortOrder: "desc",
        name: "dream",
        eventTypes: ["marathon"],
        units: ["mixed", "idol"]
      },
      { baseUrl: "https://master.test/api/v1" }
    );

    expect(listEndpointMocks.getEventsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { region: "jp" },
        query: {
          page: 2,
          page_size: 12,
          spoiler: true,
          sort_by: "startAt",
          sort_order: "desc",
          name: "dream",
          event_type: "marathon",
          unit: "none,idol"
        }
      })
    );
    expect(result.pagination).toEqual({ page: 2, hasNext: true, total: null });
    const event = result.items[0] as Record<string, unknown>;
    expect(event.id).toBe(217);
    expect(event.unit).toBe("theme_park");
  });

  it("treats a 503 region as an empty page", async () => {
    listEndpointMocks.getEventsByRegionList.mockResolvedValue({
      error: { body: { code: "REGION_DATA_NOT_READY" } },
      response: new Response(null, { status: 503 })
    });
    const result = await fetchEventListPage(
      "tw",
      { page: 1, pageSize: 12, sortBy: "startAt", sortOrder: "desc" },
      { baseUrl: "https://master.test/api/v1" }
    );
    expect(result).toEqual({
      items: [],
      pagination: { page: 1, hasNext: false, total: null }
    });
  });
});

describe("fetchEventStoriesByEvent", () => {
  beforeEach(() => {
    listEndpointMocks.getEventStoriesByRegionList.mockReset();
  });

  it("requests one filtered page and returns the parsed stories", async () => {
    listEndpointMocks.getEventStoriesByRegionList.mockResolvedValue(
      okPage([
        {
          id: 1,
          eventId: 34,
          assetbundleName: "event_34",
          eventStoryEpisodes: [
            {
              id: 1,
              eventStoryId: 1,
              episodeNo: 1,
              title: "Event EP1",
              assetbundleName: "event_34_ep1",
              scenarioId: "event_34_1"
            }
          ]
        }
      ])
    );

    const stories = await fetchEventStoriesByEvent("jp", 34, {
      baseUrl: "https://master.test/api/v1"
    });

    expect(listEndpointMocks.getEventStoriesByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { region: "jp" },
        query: { page: 1, page_size: 100, spoiler: true, event_id: "34" }
      })
    );
    expect(stories).toHaveLength(1);
    expect(stories[0].eventId).toBe(34);
    expect(stories[0].eventStoryEpisodes[0].title).toBe("Event EP1");
  });

  it("treats a 503 region as no stories", async () => {
    listEndpointMocks.getEventStoriesByRegionList.mockResolvedValue({
      error: { body: { code: "REGION_DATA_NOT_READY" } },
      response: new Response(null, { status: 503 })
    });
    const stories = await fetchEventStoriesByEvent("tw", 34, {
      baseUrl: "https://master.test/api/v1"
    });
    expect(stories).toEqual([]);
  });

  it("throws with the endpoint status on other errors", async () => {
    listEndpointMocks.getEventStoriesByRegionList.mockResolvedValue({
      error: { body: { code: "EVENT_STORY_QUERY_ERROR" } },
      response: new Response(null, { status: 500 })
    });
    await expect(
      fetchEventStoriesByEvent("jp", 34, { baseUrl: "https://master.test/api/v1" })
    ).rejects.toThrow("Failed to fetch event stories (500)");
  });
});

describe("fetchCardListPage", () => {
  beforeEach(() => {
    listEndpointMocks.getCardsByRegionList.mockReset();
  });

  it("sends the content-site filter set and parses one page", async () => {
    listEndpointMocks.getCardsByRegionList.mockResolvedValue(
      okPage(
        [
          {
            id: 13,
            prefix: "クールだけど友達想い",
            assetbundleName: "res001_no001",
            character: { id: 1, firstName: "星乃", givenName: "一歌" }
          },
          { id: 14, prefix: null, character: null }
        ],
        true
      )
    );

    const result = await fetchCardListPage(
      "jp",
      {
        page: 2,
        pageSize: 12,
        sortBy: "releaseAt",
        sortOrder: "desc",
        name: "一歌",
        units: ["idol", "piapro"],
        characters: ["1", "10"],
        skills: ["score_up"],
        types: ["term_limited"],
        attrs: ["cute"],
        rarities: ["rarity_4"],
        supportUnits: ["none"],
        has3dmvCutIn: true,
        spoiler: false
      },
      { baseUrl: "https://master.test/api/v1" }
    );

    expect(listEndpointMocks.getCardsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { region: "jp" },
        query: {
          page: 2,
          page_size: 12,
          spoiler: false,
          sort_by: "releaseAt",
          sort_order: "desc",
          name: "一歌",
          unit: "idol,piapro",
          character: "1,10",
          skill: "score_up",
          type: "term_limited",
          attr: "cute",
          rarity: "rarity_4",
          supportUnit: "none",
          has3dmvCutIn: true
        }
      })
    );
    expect(result.items).toEqual([
      {
        id: 13,
        name: "クールだけど友達想い",
        assetBundleName: "res001_no001",
        characterId: 1,
        characterName: "星乃 一歌"
      },
      {
        id: 14,
        name: "#14",
        assetBundleName: undefined,
        characterId: undefined,
        characterName: undefined
      }
    ]);
    expect(result.pagination).toEqual({ page: 2, hasNext: true, total: null });
  });

  it("treats a 503 region as an empty page", async () => {
    listEndpointMocks.getCardsByRegionList.mockResolvedValue({
      error: { body: { code: "REGION_DATA_NOT_READY" } },
      response: new Response(null, { status: 503 })
    });
    const result = await fetchCardListPage(
      "tw",
      { page: 3, pageSize: 12, sortBy: "id", sortOrder: "asc" },
      { baseUrl: "https://master.test/api/v1" }
    );
    expect(result).toEqual({
      items: [],
      pagination: { page: 3, hasNext: false, total: null }
    });
  });

  it("throws with the endpoint status on other errors", async () => {
    listEndpointMocks.getCardsByRegionList.mockResolvedValue({
      error: { body: { code: "CARD_QUERY_ERROR" } },
      response: new Response(null, { status: 500 })
    });
    await expect(
      fetchCardListPage(
        "jp",
        { page: 1, pageSize: 12, sortBy: "releaseAt", sortOrder: "desc" },
        { baseUrl: "https://master.test/api/v1" }
      )
    ).rejects.toThrow("Failed to fetch card list (500)");
  });
});

describe("fetchCardEpisodesByCardIds", () => {
  beforeEach(() => {
    listEndpointMocks.getCardEpisodesByRegionList.mockReset();
  });

  it("requests one batched page keyed by card_id and parses the rows", async () => {
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
        { id: 11, cardId: 4, seq: 1, title: "", scenarioId: "card_4_ep1" }
      ])
    );

    const episodes = await fetchCardEpisodesByCardIds("jp", [3, 4], {
      baseUrl: "https://master.test/api/v1"
    });

    expect(listEndpointMocks.getCardEpisodesByRegionList).toHaveBeenCalledTimes(1);
    expect(listEndpointMocks.getCardEpisodesByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { region: "jp" },
        query: { page: 1, page_size: 100, spoiler: true, card_id: "3,4" }
      })
    );
    expect(episodes).toEqual([
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
        cardId: 4,
        title: "",
        scenarioId: "card_4_ep1",
        assetbundleName: undefined,
        releaseConditionId: undefined
      }
    ]);
  });

  it("short-circuits empty card id lists", async () => {
    const episodes = await fetchCardEpisodesByCardIds("jp", [], {
      baseUrl: "https://master.test/api/v1"
    });
    expect(episodes).toEqual([]);
    expect(listEndpointMocks.getCardEpisodesByRegionList).not.toHaveBeenCalled();
  });

  it("treats a 503 region as no episodes", async () => {
    listEndpointMocks.getCardEpisodesByRegionList.mockResolvedValue({
      error: { body: { code: "REGION_DATA_NOT_READY" } },
      response: new Response(null, { status: 503 })
    });
    const episodes = await fetchCardEpisodesByCardIds("kr", [3, 4], {
      baseUrl: "https://master.test/api/v1"
    });
    expect(episodes).toEqual([]);
  });
});
