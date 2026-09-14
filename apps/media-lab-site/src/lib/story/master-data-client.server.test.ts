import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: {} }));

import {
  clearStoryMasterDataCacheForTests,
  fetchStoryCharacterTables,
  fetchStoryCollection,
  fetchStoryCollections
} from "./master-data-client.server";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

const unitStoryPayload = [
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
            episodeNoLabel: "",
            title: "EP1",
            assetbundleName: "ep1",
            scenarioId: "idol_01_01",
            releaseConditionId: 5
          }
        ]
      }
    ]
  }
];

describe("story master-data client", () => {
  beforeEach(() => {
    clearStoryMasterDataCacheForTests();
  });
  afterEach(() => {
    clearStoryMasterDataCacheForTests();
  });

  it("fetches a collection from the regional mirror and keeps story fields", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(unitStoryPayload));
    const result = await fetchStoryCollection("jp", "unitStories", {
      fetch: fetchFn,
      baseUrl: "https://master.test"
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://master.test/sekai-master-db-diff/unitStories.json"
    );
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

  it("uses the regional repo suffix per region", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([], 404));
    await fetchStoryCollection("en", "actionSets", {
      fetch: fetchFn,
      baseUrl: "https://master.test"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://master.test/sekai-master-db-en-diff/actionSets.json"
    );
  });

  it("treats a 404 as an empty collection", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse("not found", 404));
    const result = await fetchStoryCollection("tw", "cardEpisodes", {
      fetch: fetchFn,
      baseUrl: "https://master.test"
    });
    expect(result).toEqual([]);
  });

  it("throws for other HTTP failures and malformed payloads", async () => {
    await expect(
      fetchStoryCollection("jp", "events", {
        fetch: vi.fn().mockResolvedValue(jsonResponse({}, 500)),
        baseUrl: "https://master.test"
      })
    ).rejects.toThrow(/events \(500\)/);

    await expect(
      fetchStoryCollection("jp", "events", {
        fetch: vi.fn().mockResolvedValue(jsonResponse({ broken: true })),
        baseUrl: "https://master.test"
      })
    ).rejects.toThrow(/malformed/);
  });

  it("caches collections until the TTL expires", async () => {
    let now = 1_000_000;
    const fetchFn = vi.fn((input: RequestInfo | URL) => {
      void input;
      return Promise.resolve(jsonResponse(unitStoryPayload));
    });
    const options = {
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: "https://master.test",
      now: () => now,
      ttlMs: 50
    };

    await fetchStoryCollection("kr", "unitStories", options);
    await fetchStoryCollection("kr", "unitStories", options);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    now += 51;
    await fetchStoryCollection("kr", "unitStories", options);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("fetches only the requested collections", async () => {
    const fetchFn = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        jsonResponse(String(input).includes("eventStories") ? [{ id: 1, eventId: 34, assetbundleName: "event_34", eventStoryEpisodes: [] }] : [])
      )
    );
    const result = await fetchStoryCollections("jp", ["eventStories", "events"], {
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: "https://master.test"
    });
    expect(result.eventStories).toHaveLength(1);
    expect(result.unitStories).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("builds character name tables and character2d identity rows", async () => {
    const fetchFn = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("character2ds")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 0,
              characterType: "game_character",
              characterId: 1,
              unit: "light_sound",
              assetName: "cls_01ichika"
            }
          ])
        );
      }
      if (url.includes("gameCharacters")) {
        return Promise.resolve(
          jsonResponse([{ id: 1, firstName: "星乃", givenName: "一歌" }])
        );
      }
      if (url.includes("mobCharacters")) {
        return Promise.resolve(jsonResponse([{ id: 50, name: "モブ子" }]));
      }
      return Promise.resolve(jsonResponse([{ id: 90, name: "_sub" }]));
    });

    const tables = await fetchStoryCharacterTables("jp", {
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: "https://master.test"
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
