import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchStoryCollections: vi.fn(),
  fetchEventListPage: vi.fn(),
  fetchCardListPage: vi.fn(),
  fetchCardEpisodesByCardIds: vi.fn(),
  fetchStoryCollection: vi.fn()
}));

vi.mock("$lib/story/master-data-client.server", () => mocks);
vi.mock("$lib/story/story-resolver.server", () => ({
  getStoryAssetBase: () => "https://assets.test"
}));

import { GET } from "./story-reader/api/stories/[region]/[storyType]/+server";

const buildEvent = (over: Record<string, unknown> = {}) => ({
  id: 34,
  name: "Bout for Blessing",
  assetbundleName: "event_34",
  eventType: "marathon",
  unit: "light_sound",
  startAt: 1,
  endAt: 2,
  ...over
});

const callGet = (
  params: Record<string, string>,
  query = ""
) =>
  GET({
    params,
    fetch: vi.fn(),
    url: new URL(`http://localhost:4103/story-reader/api/stories${query}`)
  } as unknown as Parameters<typeof GET>[0]) as unknown as Promise<Response>;
const unitProfiles = [{ unit: "light_sound", unitName: "Leo/need", seq: 1 }];

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as { status?: number; body?: { message?: string } };
  }
  throw new Error("expected the handler to reject");
};

describe("story picker catalog API", () => {
  it("rejects unsupported regions and story types", async () => {
    const regionError = await errorOf(callGet({ region: "us", storyType: "unit" }));
    expect(regionError.status).toBe(404);
    expect(regionError.body?.message).toBe("Unsupported region");
    const typeError = await errorOf(callGet({ region: "jp", storyType: "bogus" }));
    expect(typeError.status).toBe(404);
    expect(typeError.body?.message).toBe("Unsupported story type");
  });

  it("returns the paginated event picker payload", async () => {
    mocks.fetchStoryCollections.mockResolvedValue({ unitProfiles });
    mocks.fetchEventListPage.mockResolvedValue({
      items: [buildEvent()],
      pagination: { page: 1, has_next: true }
    });
    const response = await callGet(
      { region: "jp", storyType: "event" },
      "?page=2&event_type=marathon"
    );
    const body = await response.json();
    expect(mocks.fetchEventListPage).toHaveBeenCalledWith(
      "jp",
      expect.objectContaining({ page: 2, eventTypes: ["marathon"] }),
      expect.anything()
    );
    expect(body.storyType).toBe("event");
    expect(body.events[0]).toMatchObject({
      eventId: 34,
      name: "Bout for Blessing",
      eventType: "marathon",
      unit: "light_sound"
    });
    expect(body.events[0].bannerUrl).toContain("event_34");
    expect(body.unitOptions).toEqual([
      { value: "light_sound", label: "Leo/need" }
    ]);
  });

  it("returns the paginated card picker payload with episode links", async () => {
    mocks.fetchStoryCollections.mockResolvedValue({
      unitProfiles,
      gameCharacters: [{ id: 1, firstName: "Hoshino", givenName: "Ichika" }]
    });
    mocks.fetchCardListPage.mockResolvedValue({
      items: [
        {
          id: 3001,
          name: "Card Title",
          assetBundleName: "0300101",
          characterId: 1
        }
      ],
      pagination: { page: 1, has_next: false }
    });
    mocks.fetchCardEpisodesByCardIds.mockResolvedValue([
      {
        id: 2121,
        cardId: 3001,
        title: "Card Story",
        scenarioId: "card_3001",
        assetbundleName: "0300101"
      }
    ]);
    const response = await callGet({ region: "jp", storyType: "card" });
    const body = await response.json();
    expect(mocks.fetchCardEpisodesByCardIds).toHaveBeenCalledWith(
      "jp",
      [3001],
      expect.anything()
    );
    expect(body.storyType).toBe("card");
    expect(body.cards[0].thumbnailUrl).toContain("0300101");
    expect(body.unitOptions).toEqual([
      { value: "light_sound", label: "Leo/need" }
    ]);
    expect(body.characterOptions).toEqual([
      { value: "1", label: "Hoshino Ichika" }
    ]);
  });

  it("returns the unit catalog with banner URLs", async () => {
    mocks.fetchStoryCollections.mockResolvedValue({
      unitStories: [
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
                  scenarioId: "idol_01_01"
                }
              ]
            }
          ]
        }
      ],
      unitProfiles: [{ unit: "idol", unitName: "MORE MORE JUMP！", seq: 1 }],
      unitStoryEpisodeGroups: []
    });
    const response = await callGet({ region: "jp", storyType: "unit" });
    const body = await response.json();
    expect(body.storyType).toBe("unit");
    expect(body.units[0].unitName).toBe("MORE MORE JUMP！");
    expect(body.units[0].groups[0].episodes[0].bannerUrl).toContain(
      "story/episode_image/"
    );
  });

  it("returns the character picker payload next to the grouped list", async () => {
    mocks.fetchStoryCollections.mockResolvedValue({
      characterProfiles: [{ characterId: 1, scenarioId: "chr1_profile" }],
      gameCharacters: [{ id: 1, firstName: "Hoshino", givenName: "Ichika" }]
    });
    const response = await callGet({ region: "jp", storyType: "character" });
    const body = await response.json();
    expect(body.storyType).toBe("character");
    expect(body.characters).toHaveLength(1);
    expect(body.groups).toBeTypeOf("object");
  });

  it("returns the area-talk picker with game-character id mapping", async () => {
    mocks.fetchStoryCollections.mockResolvedValue({
      actionSets: [
        {
          id: 1838,
          areaId: 3,
          scriptId: "areatalk03_266",
          scenarioId: "areatalk03_266",
          characterIds: [0]
        }
      ],
      areas: [{ id: 3, areaType: "reality_world", name: "Area Three" }]
    });
    mocks.fetchStoryCollection.mockResolvedValue([
      { id: 0, characterType: "game_character", characterId: 1 }
    ]);
    const response = await callGet({ region: "jp", storyType: "area-talk" });
    const body = await response.json();
    expect(mocks.fetchStoryCollection).toHaveBeenCalledWith(
      "jp",
      "character2ds",
      expect.anything()
    );
    expect(body.storyType).toBe("area-talk");
    expect(body.areas[0].talks[0].characterIds).toEqual([1]);
    expect(body.areas[0].thumbnailUrl).toContain("worldmap");
  });

  it("returns grouped lists for special stories", async () => {
    mocks.fetchStoryCollections.mockResolvedValue({
      specialStories: [
        {
          id: 2,
          title: "Connect Live",
          assetbundleName: "special_2",
          episodes: [
            {
              id: 1,
              episodeNo: 1,
              title: "EP1",
              assetbundleName: "special_2_ep1",
              scenarioId: "special_2_1"
            }
          ]
        }
      ]
    });
    const response = await callGet({ region: "jp", storyType: "special" });
    const body = await response.json();
    expect(body.storyType).toBe("special");
    expect(body.groups[0].items[0].storyId).toBe("2-1");
  });
});
