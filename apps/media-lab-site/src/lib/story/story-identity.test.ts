import { describe, expect, it } from "vitest";
import {
  buildStoryCatalog,
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
  events: [{ id: 34, name: "Bout for Blessing" }],
  characterProfiles: [{ characterId: 1, scenarioId: "chr1_profile" }],
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
  actionSets: [
    { id: 1838, areaId: 3, scriptId: "areatalk03_266", scenarioId: "areatalk03_266" },
    { id: 1900, areaId: 4, scriptId: "broken", scenarioId: undefined }
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

  it("groups event stories by event id with event names", () => {
    const groups = buildStoryCatalog("event", collections);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "34", label: "Bout for Blessing" });
    expect(groups[0].items[0].storyId).toBe("34-1");
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
