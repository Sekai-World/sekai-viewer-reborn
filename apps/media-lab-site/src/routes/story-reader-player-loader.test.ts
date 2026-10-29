import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStoryRoute: vi.fn(),
  fetchStoryCharactersOrEmpty: vi.fn()
}));

vi.mock("#lib/story/story-resolver.server.js", () => ({
  resolveStoryRoute: mocks.resolveStoryRoute,
  fetchStoryCharactersOrEmpty: mocks.fetchStoryCharactersOrEmpty,
  getStoryAssetBase: () => "https://assets.test"
}));
import { load } from "./live2d/story-reader/[region]/[storyType]/[storyId]/+page.server";

const buildLoadEvent = (params: Record<string, string | undefined>) =>
  ({
    params,
    fetch: vi.fn(),
    url: new URL("http://localhost:4103/live2d/story-reader/jp/unit/idol-1-1")
  }) as unknown as Parameters<typeof load>[0];

const okResolution = {
  status: "ok" as const,
  value: {
    identity: { region: "jp", storyType: "unit", storyId: "idol-1-1" },
    resolution: {
      scenarioPath: "scenario/unitstory/idol-story-chapter/mmj_01_00.asset",
      isCardStory: false,
      isActionSet: false,
      scenarioId: "mmj_01_00",
      chapterTitle: "Chapter 1",
      episodeTitle: "EP1",
      bannerPath: "story/episode_image/idol-story-chapter/ep1.webp"
    },
    urls: {
      region: (path: string) => `https://assets.test/sekai-jp-assets/${path}`,
      live2d: (path: string) => `https://assets.test/sekai-live2d-assets/${path}`
    }
  }
};

describe("media-lab-site Live2D route data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveStoryRoute.mockResolvedValue(okResolution);
    mocks.fetchStoryCharactersOrEmpty.mockResolvedValue({
      character2ds: [{ id: 5, assetName: "05minori", unit: "more_more_jump" }]
    });
  });

  it("returns a JSON-serializable reference and leaves heavy loading to the browser", async () => {
    const result = await load(
      buildLoadEvent({ region: "jp", storyType: "unit", storyId: "idol-1-1" })
    );
    if (!result) throw new Error("Expected story reader route data");

    expect(result).toMatchObject({
      readerStatus: "ok",
      story: {
        chapterTitle: "Chapter 1",
        episodeTitle: "EP1",
        scenarioId: "mmj_01_00",
        bannerUrl:
          "https://assets.test/sekai-jp-assets/story/episode_image/idol-story-chapter/ep1.webp"
      },
      storyDocument: {
        identity: { region: "jp", storyType: "unit", storyId: "idol-1-1" },
        scenario: {
          scenarioId: "mmj_01_00",
          path: "scenario/unitstory/idol-story-chapter/mmj_01_00.asset",
          url: "https://assets.test/sekai-jp-assets/scenario/unitstory/idol-story-chapter/mmj_01_00.asset"
        },
        isCardStory: false,
        isActionSet: false,
        voiceCharacters: [{ character2dId: 5, assetName: "05minori", unit: "more_more_jump" }]
      }
    });
    expect("scenarioData" in result).toBe(false);
    expect(JSON.parse(JSON.stringify(result.storyDocument))).toEqual(result.storyDocument);
    expect(mocks.fetchStoryCharactersOrEmpty).toHaveBeenCalledWith("jp", expect.any(Function));
  });

  it("binds the route's region to the scenario URL without JP fallback", async () => {
    const result = await load(
      buildLoadEvent({ region: "en", storyType: "unit", storyId: "idol-1-1" })
    );
    if (!result) throw new Error("Expected story reader route data");

    expect(result.storyDocument?.scenario.url).toBe(
      "https://assets.test/sekai-en-assets/scenario/unitstory/idol-story-chapter/mmj_01_00.asset"
    );
  });

  it("passes route params through and maps unsupported outcomes", async () => {
    mocks.resolveStoryRoute.mockResolvedValue({
      status: "unsupported",
      reason: "action set has no scenario"
    });
    await expect(
      load(buildLoadEvent({ region: "jp", storyType: "area-talk", storyId: "1900" }))
    ).resolves.toMatchObject({ readerStatus: "unsupported-story" });
    expect(mocks.fetchStoryCharactersOrEmpty).not.toHaveBeenCalled();
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
});
