import { describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ PUBLIC_REMOTE_ASSET_BASE_URL: "" }));
vi.mock("$app/env/public", () => envState);

const mdMocks = vi.hoisted(() => ({
  fetchStoryCollections: vi.fn(),
  fetchStoryCardAssetbundleName: vi.fn(),
  fetchStoryCharacterTables: vi.fn()
}));
vi.mock("./master-data-client.server", () => mdMocks);

import {
  fetchScenarioDocument,
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase,
  getStoryFetchBase,
  resolveStoryRoute
} from "./story-resolver.server";
import { createStoryDocumentReference } from "./story-document.server";
import type { StoryMasterCollections } from "./story-identity";
import type { StoryRouteIdentity } from "#lib/live2d/story-route.js";

const unitCollections: StoryMasterCollections = {
  eventStories: [],
  characterProfiles: [],
  cardEpisodes: [],
  actionSets: [],
  specialStories: [],
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
  ]
};

const identity = {
  region: "jp" as const,
  storyType: "unit" as const,
  storyId: "idol-1-1"
};

describe("getStoryAssetBase / getStoryFetchBase", () => {
  it("trims trailing slashes from the configured asset base", () => {
    envState.PUBLIC_REMOTE_ASSET_BASE_URL = "https://assets.test///";
    expect(getStoryAssetBase()).toBe("https://assets.test");
  });

  it("falls back to the public mirror when unset or blank", () => {
    envState.PUBLIC_REMOTE_ASSET_BASE_URL = "   ";
    expect(getStoryAssetBase()).toBe("https://storage.sekai.best");
  });

  it("returns an absolute base unchanged for fetching", () => {
    envState.PUBLIC_REMOTE_ASSET_BASE_URL = "https://assets.test";
    expect(getStoryFetchBase()).toBe("https://assets.test");
  });

  it("qualifies a relative base with the request origin", () => {
    envState.PUBLIC_REMOTE_ASSET_BASE_URL = "/storage";
    expect(getStoryFetchBase("http://localhost:4103")).toBe("http://localhost:4103/storage");
    expect(getStoryFetchBase()).toBe("/storage");
  });
});

describe("resolveStoryRoute", () => {
  it("resolves an existing unit story with asset URLs", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue(unitCollections);
    const result = await resolveStoryRoute(identity, vi.fn(), "http://x.test");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.value.resolution.scenarioId).toBe("idol_01_01");
    expect(result.value.urls.region("p")).toContain("http://x.test");
  });

  it("reports not-found for a story missing from master data", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue(unitCollections);
    const result = await resolveStoryRoute({ ...identity, storyId: "idol-9-9" }, vi.fn());
    expect(result).toEqual({ status: "not-found" });
  });

  it("reports region-unavailable when the region has not synced the story's collection", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue({
      ...unitCollections,
      unitStories: [],
      unsyncedCollections: ["unitStories"]
    });
    const result = await resolveStoryRoute({ ...identity, region: "cn" }, vi.fn());
    expect(result).toEqual({ status: "region-unavailable" });
    expect(mdMocks.fetchStoryCollections).toHaveBeenLastCalledWith(
      "cn",
      ["unitStories"],
      expect.anything()
    );
  });

  it("keeps not-found when only a supporting collection is unsynced", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue({
      ...unitCollections,
      unsyncedCollections: ["events"]
    });
    const result = await resolveStoryRoute(
      { region: "kr", storyType: "event", storyId: "99-1" },
      vi.fn()
    );
    expect(result).toEqual({ status: "not-found" });
  });

  it("keeps not-found for a synced region that lacks the story", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue({
      ...unitCollections,
      unsyncedCollections: []
    });
    const result = await resolveStoryRoute({ ...identity, storyId: "idol-9-9" }, vi.fn());
    expect(result).toEqual({ status: "not-found" });
  });

  it("distinguishes a data service error from an unsynced region", async () => {
    mdMocks.fetchStoryCollections.mockRejectedValue(new Error("Failed (500)"));
    const result = await resolveStoryRoute({ ...identity, region: "tw" }, vi.fn());
    expect(result.status).toBe("master-data-error");
  });

  it("wraps master-data fetch failures as master-data-error", async () => {
    mdMocks.fetchStoryCollections.mockRejectedValue(new Error("boom"));
    const result = await resolveStoryRoute(identity, vi.fn());
    expect(result.status).toBe("master-data-error");
  });
});

const emptyCollections: StoryMasterCollections = {
  unitStories: [],
  eventStories: [],
  characterProfiles: [],
  cardEpisodes: [],
  actionSets: [],
  specialStories: []
};

// One fixture per story type. Ids and scenario names follow rows verified
// against the dev master-data API on 2026-10-29 (area-talk 1838 is the real
// `areatalk_3rdaniv_041` action set); bundle names are representative.
const perTypeStories: {
  name: string;
  storyType: StoryRouteIdentity["storyType"];
  storyId: string;
  collections: StoryMasterCollections;
  scenarioPath: string;
  isCardStory: boolean;
  isActionSet: boolean;
}[] = [
  {
    name: "event",
    storyType: "event",
    storyId: "1-1",
    collections: {
      ...emptyCollections,
      eventStories: [
        {
          id: 1,
          eventId: 1,
          assetbundleName: "event_marathon_2020_01",
          eventStoryEpisodes: [
            {
              id: 1,
              eventStoryId: 1,
              episodeNo: 1,
              title: "EP1",
              assetbundleName: "event_marathon_2020_01_01",
              scenarioId: "event_01_01"
            }
          ]
        }
      ]
    },
    scenarioPath: "event_story/event_marathon_2020_01/scenario/event_01_01.asset",
    isCardStory: false,
    isActionSet: false
  },
  {
    name: "character",
    storyType: "character",
    storyId: "1",
    collections: {
      ...emptyCollections,
      characterProfiles: [{ characterId: 1, scenarioId: "profile_01" }]
    },
    scenarioPath: "scenario/profile/profile_01.asset",
    isCardStory: false,
    isActionSet: false
  },
  {
    name: "card",
    storyType: "card",
    storyId: "100",
    collections: {
      ...emptyCollections,
      cardEpisodes: [
        {
          id: 100,
          cardId: 50,
          title: "サイドストーリー（後編）",
          scenarioId: "card_50_02",
          assetbundleName: "res013_no050"
        }
      ]
    },
    scenarioPath: "character/member/res013_no050/card_50_02.asset",
    isCardStory: true,
    isActionSet: false
  },
  {
    name: "area-talk",
    storyType: "area-talk",
    storyId: "1838",
    collections: {
      ...emptyCollections,
      actionSets: [{ id: 1838, areaId: 7, scenarioId: "areatalk_3rdaniv_041" }]
    },
    scenarioPath: "scenario/actionset/group18/areatalk_3rdaniv_041.asset",
    isCardStory: false,
    isActionSet: true
  },
  {
    name: "special",
    storyType: "special",
    storyId: "12-1",
    collections: {
      ...emptyCollections,
      specialStories: [
        {
          id: 12,
          title: "ビビバスコネクトライブ前日ストーリー",
          assetbundleName: "special_12",
          episodes: [
            {
              id: 1,
              episodeNo: 1,
              title: "ビビバスコネクトライブ前日ストーリー",
              assetbundleName: "special_12_01",
              scenarioId: "special_12_01"
            }
          ]
        }
      ]
    },
    scenarioPath: "scenario/special/special_12_01/special_12_01.asset",
    isCardStory: false,
    isActionSet: false
  }
];

describe("resolveStoryRoute card stories in regions without episode bundles", () => {
  const cardIdentity: StoryRouteIdentity = { region: "tw", storyType: "card", storyId: "100" };
  const episode = { id: 100, cardId: 50, title: "後篇", scenarioId: "013002_tsukasa02" };
  const collectionsWith = (episodes: StoryMasterCollections["cardEpisodes"]) => ({
    ...emptyCollections,
    cardEpisodes: episodes
  });

  it("builds the scenario path from the same region's card bundle", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue(collectionsWith([episode]));
    mdMocks.fetchStoryCardAssetbundleName.mockResolvedValue({
      status: "ok",
      assetbundleName: "res013_no002"
    });
    const result = await resolveStoryRoute(cardIdentity, vi.fn(), "http://x.test");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.value.resolution.scenarioPath).toBe(
      "character/member/res013_no002/013002_tsukasa02.asset"
    );
    expect(mdMocks.fetchStoryCardAssetbundleName).toHaveBeenCalledWith("tw", 50, expect.anything());
  });

  it("does not look up the card when the episode already has a bundle", async () => {
    mdMocks.fetchStoryCardAssetbundleName.mockClear();
    mdMocks.fetchStoryCollections.mockResolvedValue(
      collectionsWith([{ ...episode, assetbundleName: "res013_no002" }])
    );
    const result = await resolveStoryRoute({ ...cardIdentity, region: "jp" }, vi.fn());
    expect(result.status).toBe("ok");
    expect(mdMocks.fetchStoryCardAssetbundleName).not.toHaveBeenCalled();
  });

  it("reports region-unavailable when the region has not synced cards", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue(collectionsWith([episode]));
    mdMocks.fetchStoryCardAssetbundleName.mockResolvedValue({ status: "unsynced" });
    const result = await resolveStoryRoute(cardIdentity, vi.fn());
    expect(result).toEqual({ status: "region-unavailable" });
  });

  it("stays unsupported when the region has no bundle for the card", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue(collectionsWith([episode]));
    mdMocks.fetchStoryCardAssetbundleName.mockResolvedValue({ status: "not-found" });
    const result = await resolveStoryRoute(cardIdentity, vi.fn());
    expect(result).toEqual({ status: "unsupported", reason: "card episode has no asset bundle" });
  });

  it("reports a data service error when the card lookup fails", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue(collectionsWith([episode]));
    mdMocks.fetchStoryCardAssetbundleName.mockRejectedValue(new Error("Failed (500)"));
    const result = await resolveStoryRoute(cardIdentity, vi.fn());
    expect(result.status).toBe("master-data-error");
  });
});

describe("resolveStoryRoute per story type", () => {
  it.each(perTypeStories)(
    "resolves a $name story to its scenario document reference",
    async ({ storyType, storyId, collections, scenarioPath, isCardStory, isActionSet }) => {
      envState.PUBLIC_REMOTE_ASSET_BASE_URL = "https://assets.test";
      mdMocks.fetchStoryCollections.mockResolvedValue(collections);
      const routeIdentity = { region: "jp" as const, storyType, storyId };

      const result = await resolveStoryRoute(routeIdentity, vi.fn());
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.value.resolution).toMatchObject({ scenarioPath, isCardStory, isActionSet });

      const reference = createStoryDocumentReference({
        identity: routeIdentity,
        resolution: result.value.resolution,
        assetBase: getStoryAssetBase(),
        voiceCharacters: []
      });
      expect(reference).toMatchObject({
        isCardStory,
        isActionSet,
        scenario: {
          path: scenarioPath,
          url: `https://assets.test/sekai-jp-assets/${scenarioPath}`
        }
      });
    }
  );

  it.each(perTypeStories)(
    "keeps a $name story region-local: other regions use their own bucket",
    async ({ storyType, storyId, collections, scenarioPath }) => {
      envState.PUBLIC_REMOTE_ASSET_BASE_URL = "https://assets.test";
      mdMocks.fetchStoryCollections.mockResolvedValue(collections);

      const result = await resolveStoryRoute({ region: "kr", storyType, storyId }, vi.fn());
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.value.urls.region(scenarioPath)).toBe(
        `https://assets.test/sekai-kr-assets/${scenarioPath}`
      );
    }
  );

  it("reports a deterministic unsupported status for an action set without a scenario", async () => {
    mdMocks.fetchStoryCollections.mockResolvedValue({
      ...emptyCollections,
      actionSets: [{ id: 1, areaId: 4 }]
    });
    const result = await resolveStoryRoute(
      { region: "jp", storyType: "area-talk", storyId: "1" },
      vi.fn()
    );
    expect(result).toEqual({ status: "unsupported", reason: "action set has no scenario" });
  });
});

describe("fetchScenarioDocument", () => {
  it("parses the scenario JSON on success", async () => {
    const urls = {
      region: (path: string) => `https://assets.test/${path}`,
      live2d: (path: string) => `https://live2d.test/${path}`
    };
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ScenarioId: "s1",
        AppearCharacters: [],
        FirstLayout: [],
        FirstBgm: "",
        FirstBackground: "",
        FirstCharacterLayoutMode: 0,
        Snippets: [],
        TalkData: [],
        LayoutData: [],
        SpecialEffectData: [],
        SoundData: [],
        NeedBundleNames: [],
        IncludeSoundDataBundleNames: [],
        ScenarioSnippetCharacterLayoutModes: []
      })
    });
    const scenario = await fetchScenarioDocument(urls, "scenario/s1.asset", fetchFn);
    expect(scenario.ScenarioId).toBe("s1");
    expect(fetchFn).toHaveBeenCalledWith("https://assets.test/scenario/s1.asset");
  });

  it("throws when the scenario document request fails", async () => {
    const urls = {
      region: (path: string) => `https://assets.test/${path}`,
      live2d: (path: string) => `https://live2d.test/${path}`
    };
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(fetchScenarioDocument(urls, "scenario/s1.asset", fetchFn)).rejects.toThrow(
      /Failed to fetch scenario document/
    );
  });
});

describe("fetchStoryCharactersOrEmpty", () => {
  it("returns the character tables when available", async () => {
    const tables = {
      character2ds: [],
      gameCharacterNames: new Map([[1, "Ichika"]]),
      mobCharacterNames: new Map(),
      subGameCharacterNames: new Map()
    };
    mdMocks.fetchStoryCharacterTables.mockResolvedValue(tables);
    await expect(fetchStoryCharactersOrEmpty("jp", vi.fn())).resolves.toBe(tables);
  });

  it("degrades to empty tables when the collections fail", async () => {
    mdMocks.fetchStoryCharacterTables.mockRejectedValue(new Error("boom"));
    const tables = await fetchStoryCharactersOrEmpty("jp", vi.fn());
    expect(tables.character2ds).toEqual([]);
    expect(tables.gameCharacterNames.size).toBe(0);
  });
});
