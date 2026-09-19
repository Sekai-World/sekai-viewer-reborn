import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/public", () => ({ env: {} }));

const mdMocks = vi.hoisted(() => ({
  fetchStoryCollections: vi.fn(),
  fetchStoryCharacterTables: vi.fn()
}));
vi.mock("./master-data-client.server", () => mdMocks);

import { env as publicEnv } from "$env/dynamic/public";
import {
  fetchScenarioDocument,
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase,
  getStoryFetchBase,
  resolveStoryRoute
} from "./story-resolver.server";
import type { StoryMasterCollections } from "./story-identity";

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
    publicEnv.PUBLIC_REMOTE_ASSET_BASE_URL = "https://assets.test///";
    expect(getStoryAssetBase()).toBe("https://assets.test");
  });

  it("falls back to the public mirror when unset or blank", () => {
    publicEnv.PUBLIC_REMOTE_ASSET_BASE_URL = "   ";
    expect(getStoryAssetBase()).toBe("https://storage.sekai.best");
  });

  it("returns an absolute base unchanged for fetching", () => {
    publicEnv.PUBLIC_REMOTE_ASSET_BASE_URL = "https://assets.test";
    expect(getStoryFetchBase()).toBe("https://assets.test");
  });

  it("qualifies a relative base with the request origin", () => {
    publicEnv.PUBLIC_REMOTE_ASSET_BASE_URL = "/storage";
    expect(getStoryFetchBase("http://localhost:4103")).toBe(
      "http://localhost:4103/storage"
    );
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
    const result = await resolveStoryRoute(
      { ...identity, storyId: "idol-9-9" },
      vi.fn()
    );
    expect(result).toEqual({ status: "not-found" });
  });

  it("wraps master-data fetch failures as master-data-error", async () => {
    mdMocks.fetchStoryCollections.mockRejectedValue(new Error("boom"));
    const result = await resolveStoryRoute(identity, vi.fn());
    expect(result.status).toBe("master-data-error");
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
    await expect(
      fetchScenarioDocument(urls, "scenario/s1.asset", fetchFn)
    ).rejects.toThrow(/Failed to fetch scenario document/);
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
