import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStoryRoute: vi.fn(),
  fetchScenarioDocument: vi.fn(),
  fetchStoryCharactersOrEmpty: vi.fn(),
  processScenarioDataForPlayer: vi.fn()
}));

vi.mock("$lib/story/story-resolver.server", () => ({
  resolveStoryRoute: mocks.resolveStoryRoute,
  fetchScenarioDocument: mocks.fetchScenarioDocument,
  fetchStoryCharactersOrEmpty: mocks.fetchStoryCharactersOrEmpty,
  getStoryAssetBase: () => "https://assets.test"
}));
vi.mock("$lib/story/scenario-process", () => ({
  processScenarioDataForPlayer: mocks.processScenarioDataForPlayer
}));

import { load } from "./live2d/story-reader/[region]/[storyType]/[storyId]/+page.server";

// Generated PageData types flatten the loader union into optional fields, so
// tests assert against the loader's declared shape directly.
type LoadedPlayer = {
  readerStatus: "ok";
  voiceCharacters: { character2dId: number; assetName?: string; unit?: string }[];
  scenarioData: unknown;
  regionBucket: string;
  isCardStory: boolean;
  isActionSet: boolean;
  assetBase: string;
  story: Record<string, string>;
};

const buildLoadEvent = (params: Record<string, string | undefined>) =>
  ({
    params,
    fetch: vi.fn(),
    url: new URL("http://localhost:4103/live2d/story-reader/jp/unit/idol-1-1")
  }) as unknown as Parameters<typeof load>[0];

const rawScenario = { ScenarioId: "mmj_01_00" };
const processedScenario = { ScenarioId: "mmj_01_00", Processed: true };
const characterTables = {
  character2ds: [
    {
      id: 0,
      characterType: "game_character",
      characterId: 1,
      unit: "light_sound",
      assetName: "cls_01ichika"
    },
    { id: 1, characterType: "mob", characterId: 50, assetName: "mob_01" }
  ],
  gameCharacterNames: new Map([[1, "星乃一歌"]]),
  mobCharacterNames: new Map([[50, "モブ子"]]),
  subGameCharacterNames: new Map()
};

describe("media-lab-site live2d player route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveStoryRoute.mockResolvedValue({
      status: "ok",
      value: {
        identity: { region: "jp", storyType: "unit", storyId: "idol-1-1" },
        resolution: {
          scenarioPath: "scenario/unitstory/idol-story-chapter/mmj_01_00.asset",
          isCardStory: false,
          isActionSet: false,
          scenarioId: "mmj_01_00",
          chapterTitle: "Chapter 1",
          episodeTitle: "EP1"
        },
        urls: {
          region: (path: string) => `https://assets.test/sekai-jp-assets/${path}`,
          live2d: (path: string) => `https://assets.test/sekai-live2d-assets/${path}`
        }
      }
    });
    mocks.fetchScenarioDocument.mockResolvedValue(rawScenario);
    mocks.fetchStoryCharactersOrEmpty.mockResolvedValue(characterTables);
    mocks.processScenarioDataForPlayer.mockReturnValue(processedScenario);
  });

  it("returns the processed scenario with playback identity tables", async () => {
    const result = (await load(
      buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" })
    )) as LoadedPlayer;

    expect(mocks.processScenarioDataForPlayer).toHaveBeenCalledWith(
      { region: "jp", storyType: "unit", storyId: "idol-1-1" },
      rawScenario
    );
    expect(result).toMatchObject({
      readerStatus: "ok",
      isCardStory: false,
      isActionSet: false,
      assetBase: "https://assets.test",
      regionBucket: "sekai-jp-assets",
      scenarioData: processedScenario,
      story: {
        chapterTitle: "Chapter 1",
        episodeTitle: "EP1",
        scenarioId: "mmj_01_00"
      }
    });
    expect(result.voiceCharacters).toEqual([
      { character2dId: 0, assetName: "cls_01ichika", unit: "light_sound" },
      { character2dId: 1, assetName: "mob_01", unit: undefined }
    ]);
  });

  it("passes the route params through and maps unsupported outcomes", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({
      status: "unsupported",
      reason: "action set has no scenario"
    });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "area-talk", storyId: "1900" }))
    ).resolves.toMatchObject({ readerStatus: "unsupported-story" });
    expect(mocks.fetchScenarioDocument).not.toHaveBeenCalled();
  });

  it("reports master-data outages without failing", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({ status: "master-data-error" });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" }))
    ).resolves.toMatchObject({ readerStatus: "unavailable" });
  });

  it("maps unknown stories to 404", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({ status: "not-found" });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-9-9" }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects unsafe story ids before touching master data", async () => {
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "../1" }))
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.resolveStoryRoute).not.toHaveBeenCalled();
  });

  it("reports scenario fetch failures without failing the request", async () => {
    mocks.fetchScenarioDocument.mockRejectedValue(new Error("404"));
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" }))
    ).resolves.toMatchObject({ readerStatus: "scenario-error" });
  });
});
