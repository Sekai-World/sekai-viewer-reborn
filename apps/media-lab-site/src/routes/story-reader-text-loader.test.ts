import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStoryRoute: vi.fn(),
  fetchScenarioDocument: vi.fn(),
  fetchStoryCharactersOrEmpty: vi.fn(),
  flattenScenarioToRows: vi.fn(),
  buildVoiceCharacterLookup: vi.fn()
}));

vi.mock("$lib/story/story-resolver.server", () => ({
  resolveStoryRoute: mocks.resolveStoryRoute,
  fetchScenarioDocument: mocks.fetchScenarioDocument,
  fetchStoryCharactersOrEmpty: mocks.fetchStoryCharactersOrEmpty,
  getStoryAssetBase: () => "https://assets.test"
}));
vi.mock("$lib/story/scenario-rows", () => ({
  flattenScenarioToRows: mocks.flattenScenarioToRows,
  buildVoiceCharacterLookup: mocks.buildVoiceCharacterLookup
}));

import { load } from "./story-reader/[region]/[storyType]/[storyId]/+page.server";

// Generated PageData types flatten the loader union into optional fields, so
// tests assert against the loader's declared shapes directly.
type LoadedText =
  | { readerStatus: "unavailable" }
  | { readerStatus: "unsupported-story" }
  | { readerStatus: "scenario-error" }
  | {
      readerStatus: "ok";
      story: { scenarioId: string };
      assetBase: string;
      rows: { kind: string; voiceUrls: string[] }[];
    };

const buildLoadEvent = (params: Record<string, string | undefined>) =>
  ({ params, fetch: vi.fn() }) as unknown as Parameters<typeof load>[0];

const okResolution = {
  status: "ok" as const,
  value: {
    identity: { region: "jp", storyType: "unit", storyId: "idol-1-1" },
    resolution: {
      scenarioPath: "scenario/unitstory/bundle/mmj_01_00.asset",
      isCardStory: false,
      isActionSet: false,
      scenarioId: "mmj_01_00"
    },
    urls: {
      region: (path: string) => `https://assets.test/sekai-jp-assets/${path}`,
      live2d: (path: string) => `https://assets.test/sekai-live2d-assets/${path}`
    }
  }
};

describe("media-lab-site text reader route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildVoiceCharacterLookup.mockReturnValue(new Map());
    mocks.fetchStoryCharactersOrEmpty.mockResolvedValue({
      character2ds: [],
      gameCharacterNames: new Map(),
      mobCharacterNames: new Map(),
      subGameCharacterNames: new Map()
    });
    mocks.flattenScenarioToRows.mockReturnValue({
      scenarioId: "mmj_01_00",
      cast: [],
      rows: [
        { kind: "talk", name: "花里みのり", body: "こんにちは！", voicePaths: ["sound/a.mp3"] }
      ]
    });
    mocks.fetchScenarioDocument.mockResolvedValue({ ScenarioId: "mmj_01_00" });
  });

  it("rejects an unsafe story address", async () => {
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "../1" }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it("maps an unknown story to 404", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({ status: "not-found" });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-9-9" }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reports master-data outages without failing", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({ status: "master-data-error" });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" }))
    ).resolves.toMatchObject({ readerStatus: "unavailable" });
  });

  it("reports unsupported stories explicitly", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({
      status: "unsupported",
      reason: "action set has no scenario"
    });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "area-talk", storyId: "2" }))
    ).resolves.toMatchObject({ readerStatus: "unsupported-story" });
  });

  it("returns script rows with resolved media URLs", async () => {
    mocks.resolveStoryRoute.mockResolvedValue(okResolution);
    const result = (await load(
      buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" })
    )) as LoadedText;
    expect(result.readerStatus).toBe("ok");
    if (result.readerStatus !== "ok") return;
    expect(result.rows[0]).toMatchObject({
      kind: "talk",
      voiceUrls: ["https://assets.test/sekai-jp-assets/sound/a.mp3"]
    });
    expect(result.story.scenarioId).toBe("mmj_01_00");
    expect(result.assetBase).toBe("https://assets.test");
  });

  it("reports scenario fetch failures without failing the request", async () => {
    mocks.resolveStoryRoute.mockResolvedValue(okResolution);
    mocks.fetchScenarioDocument.mockRejectedValue(new Error("502"));
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" }))
    ).resolves.toMatchObject({ readerStatus: "scenario-error" });
  });
});
