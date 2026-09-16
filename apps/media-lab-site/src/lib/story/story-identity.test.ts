import { describe, expect, it } from "vitest";
import {
  buildStoryAreaTalkPicker,
  buildStoryCardPicker,
  buildStoryCatalog,
  buildStoryCharacterPicker,
  buildUnitStoryCatalog,
  parseStoryId,
  resolveStoryIdentity,
  type StoryMasterCollections
} from "./story-identity";

const collections: StoryMasterCollections = {
  unitStories: [
    {
      unit: "idol",
      seq: 2,
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
              episodeNo: 2,
              episodeNoLabel: "Episode 2",
              title: "EP2",
              assetbundleName: "ep2",
              scenarioId: "idol_01_02"
            },
            {
              id: 2,
              chapterNo: 1,
              episodeNo: 1,
              episodeNoLabel: "Episode 1",
              title: "EP1",
              assetbundleName: "ep1",
              scenarioId: "idol_01_01"
            }
          ]
        }
      ]
    },
    {
      unit: "mmj",
      seq: 1,
      chapters: []
    }
  ],
  unitProfiles: [
    { unit: "idol", unitName: "MORE MORE JUMP！", seq: 3 },
    { unit: "mmj", unitName: "More More Friends", seq: 2 }
  ],
  eventStories: [
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
  ],
  events: [{ id: 34, name: "Bout for Blessing", eventType: "marathon" }],
  characterProfiles: [
    { characterId: 1, scenarioId: "chr1_profile" },
    { characterId: 27, scenarioId: "chr27_profile" }
  ],
  cardEpisodes: [
    {
      id: 2121,
      cardId: 3001,
      title: "Card Story",
      scenarioId: "card_3001",
      assetbundleName: "0300101"
    },
    {
      id: 2050,
      cardId: 900,
      title: "No bundle",
      scenarioId: "card_900"
    }
  ],
  cards: [
    {
      id: 3001,
      name: "Card Title",
      assetBundleName: "0300101",
      characterId: 1,
      characterName: "Hoshino Ichika"
    }
  ],
  gameCharacters: [{ id: 1, firstName: "Hoshino", givenName: "Ichika" }],
  actionSets: [
    { id: 1838, areaId: 3, scriptId: "areatalk03_266", scenarioId: "areatalk03_266" },
    { id: 1900, areaId: 4, scriptId: "broken", scenarioId: undefined }
  ],
  areas: [
    { id: 1, assetBundleName: "area1", areaType: "reality_world", name: "Area One" },
    { id: 2, assetBundleName: "area2", areaType: "reality_world", name: "Area Two" },
    { id: 5, assetBundleName: "area5", areaType: "spirit_world", name: "Area Five", subName: "School" },
    { id: 14, assetBundleName: "area14", areaType: "spirit_world", name: "Collab", label: "コラボ中！" }
  ],
  specialStories: [
    {
      id: 2,
      title: "Connect Live",
      assetbundleName: "op_01",
      episodes: [
        {
          id: 1,
          episodeNo: 1,
          title: "OP",
          assetbundleName: "op_01",
          scenarioId: "op_01_01"
        }
      ]
    }
  ]
};

describe("parseStoryId", () => {
  it("parses unit ids into unit/chapter/episode", () => {
    expect(parseStoryId("unit", "idol-1-2")).toEqual({
      kind: "unit",
      unit: "idol",
      chapterNo: 1,
      episodeNo: 2
    });
  });

  it("rejects malformed unit ids", () => {
    expect(parseStoryId("unit", "idol-1")).toBeNull();
    expect(parseStoryId("unit", "idol-a-1")).toBeNull();
    expect(parseStoryId("unit", "")).toBeNull();
  });

  it("parses event, card, area-talk, and special ids", () => {
    expect(parseStoryId("event", "34-1")).toEqual({
      kind: "event",
      eventId: 34,
      episodeNo: 1
    });
    expect(parseStoryId("card", "2121")).toEqual({
      kind: "card",
      cardEpisodeId: 2121
    });
    expect(parseStoryId("area-talk", "1838")).toEqual({
      kind: "area-talk",
      actionSetId: 1838
    });
    expect(parseStoryId("special", "2-1")).toEqual({
      kind: "special",
      specialStoryId: 2,
      episodeNo: 1
    });
  });

  it("rejects malformed event and special ids", () => {
    expect(parseStoryId("event", "34")).toBeNull();
    expect(parseStoryId("special", "2")).toBeNull();
    expect(parseStoryId("area-talk", "abc")).toBeNull();
  });
});

describe("resolveStoryIdentity", () => {
  it("resolves a unit episode with banner and titles", () => {
    const result = resolveStoryIdentity("unit", "idol-1-1", collections, "jp");
    expect(result).toEqual({
      status: "ok",
      resolution: {
        scenarioPath: "scenario/unitstory/idol-story-chapter/idol_01_01.asset",
        isCardStory: false,
        isActionSet: false,
        bannerPath: "story/episode_image/idol-story-chapter/ep1.webp",
        chapterTitle: "Chapter 1",
        episodeTitle: "EP1",
        scenarioId: "idol_01_01"
      }
    });
  });

  it("resolves an event episode with the event name as chapter title", () => {
    const result = resolveStoryIdentity("event", "34-1", collections, "jp");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.resolution).toMatchObject({
      scenarioPath: "event_story/event_34/scenario/event_34_1.asset",
      chapterTitle: "Bout for Blessing",
      episodeTitle: "Event EP1",
      scenarioId: "event_34_1"
    });
  });

  it("resolves a character profile story", () => {
    const result = resolveStoryIdentity("character", "1", collections, "jp");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.resolution.scenarioPath).toBe("scenario/profile/chr1_profile.asset");
  });

  it("resolves a card episode as a card story", () => {
    const result = resolveStoryIdentity("card", "2121", collections, "jp");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.resolution).toMatchObject({
      scenarioPath: "character/member/0300101/card_3001.asset",
      isCardStory: true
    });
  });

  it("flags a card episode without an asset bundle as unsupported", () => {
    expect(resolveStoryIdentity("card", "2050", collections, "jp")).toEqual({
      status: "unsupported",
      reason: "card episode has no asset bundle"
    });
  });

  it("resolves an area talk as an action set", () => {
    const result = resolveStoryIdentity("area-talk", "1838", collections, "jp");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.resolution).toMatchObject({
      scenarioPath: "scenario/actionset/group18/areatalk03_266.asset",
      isActionSet: true
    });
  });

  it("flags an action set without a scenario as unsupported", () => {
    expect(resolveStoryIdentity("area-talk", "1900", collections, "jp")).toEqual({
      status: "unsupported",
      reason: "action set has no scenario"
    });
  });

  it("resolves a special story episode", () => {
    const result = resolveStoryIdentity("special", "2-1", collections, "jp");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.resolution.scenarioPath).toBe("scenario/special/op_01/op_01_01.asset");
  });

  it("reports unknown stories as not-found", () => {
    expect(resolveStoryIdentity("unit", "idol-9-9", collections, "jp").status).toBe(
      "not-found"
    );
    expect(resolveStoryIdentity("event", "99-1", collections, "jp").status).toBe(
      "not-found"
    );
  });

  it("reports malformed ids as unsupported", () => {
    expect(resolveStoryIdentity("unit", "idol", collections, "jp")).toEqual({
      status: "unsupported",
      reason: "malformed story id"
    });
  });
});

describe("buildStoryCatalog", () => {
  it("groups unit stories by unit name with in-game episode labels", () => {
    const groups = buildStoryCatalog("unit", collections);
    expect(groups.map((g) => g.key)).toEqual(["mmj", "idol"]);
    expect(groups.map((g) => g.label)).toEqual(["More More Friends", "MORE MORE JUMP！"]);
    const idol = groups.find((g) => g.key === "idol");
    expect(idol?.items.map((item) => item.storyId)).toEqual(["idol-1-1", "idol-1-2"]);
    expect(idol?.items[0]).toMatchObject({ label: "EP1", sublabel: "Episode 1" });
  });

  it("falls back to the unit slug and raw episodeNo without profiles or labels", () => {
    const groups = buildStoryCatalog("unit", {
      ...collections,
      unitProfiles: undefined,
      unitStories: collections.unitStories.map((unit) => ({
        ...unit,
        chapters: unit.chapters.map((chapter) => ({
          ...chapter,
          episodes: chapter.episodes.map((episode) => ({
            ...episode,
            episodeNoLabel: undefined
          }))
        }))
      }))
    });
    expect(groups.map((g) => g.label)).toEqual(["mmj", "idol"]);
    const idol = groups.find((g) => g.key === "idol");
    expect(idol?.items[0].sublabel).toBe("1");
  });

  it("groups event stories by event id with event names and event types", () => {
    const groups = buildStoryCatalog("event", collections);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "34",
      label: "Bout for Blessing",
      eventType: "marathon"
    });
    expect(groups[0].items[0].storyId).toBe("34-1");
  });

  it("keeps event groups filterable with a null event type when the event is unknown", () => {
    const groups = buildStoryCatalog("event", {
      ...collections,
      events: [{ id: 35, name: "Unrelated", eventType: "world_bloom" }]
    });
    expect(groups[0]).toMatchObject({ key: "34", eventType: null });
  });

  it("buckets card episodes by cardId / 100 and skips nothing", () => {
    const groups = buildStoryCatalog("card", collections);
    expect(groups.map((g) => g.key)).toEqual(["900", "3000"]);
    expect(groups[0].items[0]).toMatchObject({ storyId: "2050" });
  });

  it("groups action sets by area and omits scenario-less rows", () => {
    const groups = buildStoryCatalog("area-talk", collections);
    expect(groups.map((g) => g.key)).toEqual(["3"]);
    expect(groups[0].items[0]).toMatchObject({ storyId: "1838" });
  });

  it("groups special stories by story id", () => {
    const groups = buildStoryCatalog("special", collections);
    expect(groups[0]).toMatchObject({ key: "2", label: "Connect Live" });
    expect(groups[0].items[0].storyId).toBe("2-1");
  });
});

describe("buildStoryCardPicker", () => {
  it("builds one tile per card with names, art path, and ordered episodes", () => {
    const cards = buildStoryCardPicker({
      ...collections,
      cardEpisodes: [
        {
          id: 2122,
          cardId: 3001,
          title: "Card Story 2",
          scenarioId: "card_3001_2",
          assetbundleName: "0300101"
        },
        {
          id: 2121,
          cardId: 3001,
          title: "Card Story",
          scenarioId: "card_3001",
          assetbundleName: "0300101"
        },
        {
          id: 2050,
          cardId: 900,
          title: "",
          scenarioId: "card_900"
        }
      ]
    });
    expect(cards.map((card) => card.cardId)).toEqual([900, 3001]);
    const titled = cards.find((card) => card.cardId === 3001);
    expect(titled).toMatchObject({
      cardName: "Card Title",
      characterId: 1,
      characterName: "Hoshino Ichika",
      thumbnailPath: "thumbnail/chara/0300101_normal.webp"
    });
    expect(titled?.episodes.map((episode) => episode.storyId)).toEqual([
      "2121",
      "2122"
    ]);
    const untitled = cards.find((card) => card.cardId === 900);
    expect(untitled).toMatchObject({ cardName: "#900" });
    expect(untitled?.thumbnailPath).toBeUndefined();
    expect(untitled?.episodes[0].label).toBe("#2050");
  });

  it("derives names from the cards collection and falls back to #cardId", () => {
    const cards = buildStoryCardPicker({ ...collections, cards: undefined });
    expect(cards.find((card) => card.cardId === 3001)).toMatchObject({
      cardName: "#3001",
      thumbnailPath: "thumbnail/chara/0300101_normal.webp"
    });
  });
});

describe("buildStoryCharacterPicker", () => {
  it("resolves names, avatars, and generic fallbacks per character", () => {
    const characters = buildStoryCharacterPicker(collections);
    expect(characters.map((character) => character.characterId)).toEqual([1, 27]);
    expect(characters[0]).toMatchObject({
      storyId: "1",
      name: "Hoshino Ichika",
      avatarUrl: "/chr_ts/chr_ts_1_g1.png"
    });
    expect(characters[1]).toMatchObject({
      storyId: "27",
      name: null,
      avatarUrl: null
    });
  });

  it("falls back to a null name without the gameCharacters collection", () => {
    const characters = buildStoryCharacterPicker({
      ...collections,
      gameCharacters: undefined
    });
    expect(characters[0]).toMatchObject({ characterId: 1, name: null });
  });
});

describe("buildStoryAreaTalkPicker", () => {
  const twoDToGameCharacter = new Map([
    [101, 1],
    [102, 2],
    [103, 30]
  ]);

  it("groups playable talks by area with names and world-map thumbnails", () => {
    const areas = buildStoryAreaTalkPicker(
      {
        ...collections,
        actionSets: [
          {
            id: 10,
            areaId: 1,
            scriptId: "as_school",
            scenarioId: "as_school_1",
            characterIds: [101, 102, 103]
          },
          {
            id: 11,
            areaId: 1,
            scenarioId: "as_school_2",
            characterIds: []
          },
          { id: 12, areaId: 5, scenarioId: "as_spirit", characterIds: [] },
          { id: 13, areaId: 14, scenarioId: "as_collab", characterIds: [] }
        ]
      },
      twoDToGameCharacter
    );
    expect(areas.map((area) => area.areaId)).toEqual([1, 5, 14]);

    const reality = areas[0];
    expect(reality).toMatchObject({
      name: "Area One",
      thumbnailPath: "worldmap/contents/normal/worldmap_area03.webp"
    });
    expect(reality.talks).toHaveLength(2);
    expect(reality.talks[0].characterIds).toEqual([1, 2]);

    const spirit = areas[1];
    expect(spirit).toMatchObject({
      name: "Area Five",
      subName: "School",
      thumbnailPath: "worldmap/contents/normal/img_worldmap_areas05.webp"
    });

    const collab = areas[2];
    expect(collab.thumbnailPath).toBe(
      "worldmap/contents/collaboration/area14/img_worldmap_areas14.webp"
    );
  });

  it("derives reality sheet numbers from areas.json order, not area ids", () => {
    const areas = buildStoryAreaTalkPicker({
      ...collections,
      actionSets: [{ id: 20, areaId: 2, scenarioId: "as_two", characterIds: [] }]
    });
    expect(areas[0].thumbnailPath).toBe(
      "worldmap/contents/normal/worldmap_area01.webp"
    );
  });

  it("falls back to null thumbnails and names for unknown areas", () => {
    const areas = buildStoryAreaTalkPicker({
      ...collections,
      areas: undefined,
      actionSets: [{ id: 30, areaId: 99, scenarioId: "as_x", characterIds: [] }]
    });
    expect(areas[0]).toMatchObject({ areaId: 99, name: null, thumbnailPath: null });
  });

  it("omits action sets without a scenario", () => {
    const areas = buildStoryAreaTalkPicker({
      ...collections,
      actionSets: [{ id: 40, areaId: 1, scriptId: "no_scenario" }]
    });
    expect(areas).toEqual([]);
  });
});

describe("buildUnitStoryCatalog", () => {
  const unitCollections: StoryMasterCollections = {
    unitStories: [
      {
        unit: "piapro",
        seq: 6,
        chapters: [
          {
            id: 90,
            unit: "piapro",
            chapterNo: 1,
            title: "piaproストーリー 第1章",
            assetbundleName: "piapro-story-chapter",
            episodes: [
              {
                id: 1,
                chapterNo: 1,
                episodeNo: 4,
                episodeNoLabel: "第1話",
                title: "秘密の練習",
                assetbundleName: "vs_ep4",
                scenarioId: "vsleo_01_01",
                unitStoryEpisodeGroupId: 1
              },
              {
                id: 2,
                chapterNo: 1,
                episodeNo: 5,
                title: "先輩だからできること",
                assetbundleName: "vs_ep5",
                scenarioId: "vsleo_01_02",
                unitStoryEpisodeGroupId: 1
              },
              {
                id: 3,
                chapterNo: 1,
                episodeNo: 8,
                title: "全力ライブ！",
                assetbundleName: "vs_ep8",
                scenarioId: "vsmmj_01_01",
                unitStoryEpisodeGroupId: 2
              }
            ]
          }
        ]
      },
      {
        unit: "idol",
        seq: 2,
        chapters: [
          {
            id: 10,
            unit: "idol",
            chapterNo: 1,
            title: "MORE MORE JUMP！ストーリー 第1章",
            assetbundleName: "idol-story-chapter",
            episodes: [
              {
                id: 20,
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
    ],
    unitProfiles: [
      { unit: "piapro", unitName: "バーチャル・シンガー" },
      { unit: "idol", unitName: "MORE MORE JUMP！" }
    ],
    unitStoryEpisodeGroups: [
      { id: 1, unit: "piapro", unitEpisodeCategory: "light_sound", outline: "Leo/need sekai arc" },
      { id: 2, unit: "piapro", unitEpisodeCategory: "idol", outline: "MMJ sekai arc" },
      { id: 7, unit: "idol", unitEpisodeCategory: "none", outline: "Main idol story" }
    ],
    eventStories: [],
    characterProfiles: [],
    cardEpisodes: [],
    actionSets: [],
    specialStories: []
  };

  it("orders units by seq with unit profile display names", () => {
    const units = buildUnitStoryCatalog(unitCollections);
    expect(units.map((unit) => unit.unit)).toEqual(["idol", "piapro"]);
    expect(units[0].unitName).toBe("MORE MORE JUMP！");
    expect(units[1].unitName).toBe("バーチャル・シンガー");
  });

  it("splits virtual singer stories into per-sekai story lines", () => {
    const piapro = buildUnitStoryCatalog(unitCollections).find(
      (unit) => unit.unit === "piapro"
    );
    expect(piapro?.groups.map((group) => group.categoryUnit)).toEqual([
      "light_sound",
      "idol"
    ]);
    expect(piapro?.groups[0].outline).toBe("Leo/need sekai arc");
    expect(piapro?.groups[0].episodes).toHaveLength(2);
    expect(piapro?.groups[0].episodes[0]).toEqual({
      storyId: "piapro-1-4",
      title: "秘密の練習",
      sublabel: "第1話",
      bannerPath: "story/episode_image/piapro-story-chapter/vs_ep4.webp"
    });
    expect(piapro?.groups[1].episodes[0].sublabel).toBe("8");
  });

  it("keeps regular units on a single main story line", () => {
    const idol = buildUnitStoryCatalog(unitCollections).find(
      (unit) => unit.unit === "idol"
    );
    expect(idol?.groups).toHaveLength(1);
    expect(idol?.groups[0]).toMatchObject({
      groupId: 7,
      categoryUnit: "none",
      outline: "Main idol story"
    });
  });

  it("falls back to one synthetic line without the groups collection", () => {
    const rest = { ...unitCollections };
    delete rest.unitStoryEpisodeGroups;
    const units = buildUnitStoryCatalog(rest);
    const idol = units.find((unit) => unit.unit === "idol");
    expect(idol?.groups).toHaveLength(1);
    expect(idol?.groups[0]).toMatchObject({ groupId: 0, categoryUnit: "none" });
    expect(idol?.groups[0].episodes[0].storyId).toBe("idol-1-1");
  });
});
