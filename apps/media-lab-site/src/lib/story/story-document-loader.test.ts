import { describe, expect, it, vi } from "vitest";
import type { StoryDocumentReference } from "$lib/live2d/story-document";
import { SnippetAction, SnippetProgressBehavior, SpecialEffectType } from "./scenario-types";
import { loadStoryDocument, StoryDocumentLoadError } from "./story-document-loader";

/** Verified fields from the public JP `mmj_01_00.asset` scenario sample. */
const verifiedScenarioFixture = {
  ScenarioId: "mmj_01_00",
  AppearCharacters: [
    { Character2dId: 5, CostumeType: "05minori_normal" },
    { Character2dId: 5, CostumeType: "05minori_cloth002" },
    { Character2dId: 25, CostumeType: "21miku_idol" },
    { Character2dId: 27, CostumeType: "22rin_idol" },
    { Character2dId: 6, CostumeType: "06haruka_normal" }
  ],
  FirstLayout: [],
  FirstBgm: "bgm00000",
  FirstBackground: "bg_b000603",
  FirstCharacterLayoutMode: 0,
  Snippets: [
    {
      Action: SnippetAction.Talk,
      ProgressBehavior: SnippetProgressBehavior.Now,
      ReferenceIndex: 0,
      Delay: 0
    }
  ],
  TalkData: [
    {
      TalkCharacters: [{ Character2dId: 0 }],
      WindowDisplayName: "みのりの母",
      Body: "みのり、お腹の薬、リビングのテーブルの上に置いといたからね。",
      TalkTention: 0,
      LipSync: 1,
      MotionChangeFrom: 1,
      Motions: [],
      Voices: [{ Character2dId: 0, VoiceId: "voice_op_idol0_05a_158", Volume: 1 }],
      Speed: 0,
      FontSize: 0,
      WhenFinishCloseWindow: 0,
      RequirePlayEffect: 0,
      EffectReferenceIdx: 0,
      RequirePlaySound: 0,
      SoundReferenceIdx: 0
    }
  ],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: []
};

const createReference = (
  region: StoryDocumentReference["identity"]["region"] = "jp",
  overrides: Partial<StoryDocumentReference> = {}
): StoryDocumentReference => ({
  identity: { region, storyType: "unit", storyId: "idol-1-1" },
  story: { scenarioId: "mmj_01_00", chapterTitle: "Chapter 1", episodeTitle: "EP1" },
  scenario: {
    scenarioId: "mmj_01_00",
    path: "scenario/unitstory/idol-story-chapter/mmj_01_00.asset",
    url: `https://storage.sekai.best/sekai-${region === "tw" ? "tc" : region}-assets/scenario/unitstory/idol-story-chapter/mmj_01_00.asset`
  },
  assetBase: "https://storage.sekai.best",
  isCardStory: false,
  isActionSet: false,
  voiceCharacters: [],
  ...overrides
});

const scenarioResponse = (scenario: unknown): Response =>
  new Response(JSON.stringify(scenario), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

const movieScenarioFixture = {
  ...verifiedScenarioFixture,
  Snippets: [
    {
      Action: SnippetAction.SpecialEffect,
      ProgressBehavior: SnippetProgressBehavior.Now,
      ReferenceIndex: 0,
      Delay: 0
    }
  ],
  SpecialEffectData: [
    {
      EffectType: SpecialEffectType.Movie,
      StringVal: "movie_01",
      StringValSub: "",
      Duration: 0,
      IntVal: 0
    }
  ]
};

describe("loadStoryDocument", () => {
  it("normalizes the verified JP scenario sample into serializable references", async () => {
    const sourceSnapshot = structuredClone(verifiedScenarioFixture);
    const fetch = vi.fn().mockResolvedValue(scenarioResponse(verifiedScenarioFixture));
    const progress: { loadedBytes: number; totalBytes: number | null }[] = [];
    const controller = new AbortController();

    const document = await loadStoryDocument(createReference(), {
      signal: controller.signal,
      fetch,
      onProgress: (value) => progress.push(value)
    });

    expect(document.identity.region).toBe("jp");
    expect(document.scenarioData.Snippets.map((snippet) => snippet.Action)).toContain(
      SnippetAction.SpecialEffect
    );
    expect(document.initialMedia).toEqual([
      {
        kind: "background",
        identifier: "bg_b000603",
        path: "scenario/background/bg_b000603/bg_b000603.webp",
        url: "https://storage.sekai.best/sekai-jp-assets/scenario/background/bg_b000603/bg_b000603.webp"
      },
      {
        kind: "bgm",
        identifier: "bgm00000",
        path: "sound/scenario/bgm/bgm00000/bgm00000.mp3",
        url: "https://storage.sekai.best/sekai-jp-assets/sound/scenario/bgm/bgm00000/bgm00000.mp3"
      }
    ]);
    expect(document.media.map(({ kind, path, url }) => ({ kind, path, url }))).toEqual(
      expect.arrayContaining([
        {
          kind: "voice",
          path: "sound/scenario/voice/mmj_01_00/voice_op_idol0_05a_158.mp3",
          url: "https://storage.sekai.best/sekai-jp-assets/sound/scenario/voice/mmj_01_00/voice_op_idol0_05a_158.mp3"
        },
        {
          kind: "background",
          path: "scenario/background/bg_b000603/bg_b000603.webp",
          url: "https://storage.sekai.best/sekai-jp-assets/scenario/background/bg_b000603/bg_b000603.webp"
        },
        {
          kind: "bgm",
          path: "sound/scenario/bgm/bgm00000/bgm00000.mp3",
          url: "https://storage.sekai.best/sekai-jp-assets/sound/scenario/bgm/bgm00000/bgm00000.mp3"
        }
      ])
    );
    expect(document.models).toEqual([
      { character2dId: 5, assetName: "05minori_normal" },
      { character2dId: 5, assetName: "05minori_cloth002" },
      { character2dId: 25, assetName: "21miku_idol" },
      { character2dId: 27, assetName: "22rin_idol" },
      { character2dId: 6, assetName: "06haruka_normal" }
    ]);
    expect(document.text).toEqual({ scenarioId: "mmj_01_00", translationSource: "none" });
    expect(verifiedScenarioFixture).toEqual(sourceSnapshot);
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("accepts scenarios without optional initial media", async () => {
    const noInitialMedia = {
      ...verifiedScenarioFixture,
      FirstBackground: "",
      FirstBgm: "",
      Snippets: []
    };
    const document = await loadStoryDocument(createReference(), {
      signal: new AbortController().signal,
      fetch: vi.fn().mockResolvedValue(scenarioResponse(noInitialMedia))
    });

    expect(document.initialMedia).toEqual([]);
    expect(document.media).toEqual([]);
  });

  it("returns an actionable typed error for malformed scenario input", async () => {
    await expect(
      loadStoryDocument(createReference(), {
        signal: new AbortController().signal,
        fetch: vi.fn().mockResolvedValue(scenarioResponse({ ScenarioId: 1 }))
      })
    ).rejects.toMatchObject<Partial<StoryDocumentLoadError>>({
      name: "StoryDocumentLoadError",
      code: "scenario-invalid"
    });
  });

  it("classifies malformed nested rows, unsafe paths, and snippet references as scenario-invalid", async () => {
    const malformedScenarios: unknown[] = [
      { ...verifiedScenarioFixture, AppearCharacters: [null] },
      { ...verifiedScenarioFixture, FirstLayout: [null] },
      { ...verifiedScenarioFixture, LayoutData: [null] },
      { ...verifiedScenarioFixture, FirstBackground: "../unsafe" },
      {
        ...verifiedScenarioFixture,
        Snippets: [{ ...verifiedScenarioFixture.Snippets[0], ReferenceIndex: 99 }]
      },
      {
        ...verifiedScenarioFixture,
        TalkData: [{ ...verifiedScenarioFixture.TalkData[0], Voices: [null] }]
      }
    ];

    for (const scenario of malformedScenarios) {
      await expect(
        loadStoryDocument(createReference(), {
          signal: new AbortController().signal,
          fetch: vi.fn().mockResolvedValue(scenarioResponse(scenario))
        })
      ).rejects.toMatchObject({ name: "StoryDocumentLoadError", code: "scenario-invalid" });
    }
  });

  it("forwards movie discovery failures as fallback warnings", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(scenarioResponse(movieScenarioFixture))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    const onWarning = vi.fn();

    const document = await loadStoryDocument(createReference(), {
      signal: new AbortController().signal,
      fetch,
      onWarning
    });

    expect(onWarning).toHaveBeenCalledWith(
      "Movie file not listed for movie_01; using default file name."
    );
    expect(document.media).toContainEqual(
      expect.objectContaining({
        kind: "movie",
        identifier: "movie_01",
        path: "scenario/movie/movie_01/movie_01.mp4",
        url: "https://storage.sekai.best/sekai-jp-assets/scenario/movie/movie_01/movie_01.mp4"
      })
    );
  });

  it("does not fall back to another region when the selected scenario is unavailable", async () => {
    const reference = createReference("en");
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 404 }));

    await expect(
      loadStoryDocument(reference, { signal: new AbortController().signal, fetch })
    ).rejects.toMatchObject({ code: "scenario-http" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(reference.scenario.url);
    expect(reference.scenario.url).toContain("/sekai-en-assets/");
  });

  it("can retry after cancelling an in-flight scenario request", async () => {
    const controller = new AbortController();
    let requestCount = 0;
    const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requestCount += 1;
      if (requestCount > 1) return Promise.resolve(scenarioResponse(verifiedScenarioFixture));
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      });
    });

    const loading = loadStoryDocument(createReference(), { signal: controller.signal, fetch });
    controller.abort();

    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      loadStoryDocument(createReference(), { signal: new AbortController().signal, fetch })
    ).resolves.toMatchObject({ identity: { region: "jp" } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not emit the movie fallback warning after cancellation", async () => {
    const controller = new AbortController();
    let requestCount = 0;
    let resolveDiscoveryStarted: () => void = () => {};
    const discoveryStarted = new Promise<void>((resolve) => {
      resolveDiscoveryStarted = resolve;
    });
    const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requestCount += 1;
      if (requestCount === 1) return Promise.resolve(scenarioResponse(movieScenarioFixture));
      resolveDiscoveryStarted();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      });
    });
    const onWarning = vi.fn();

    const loading = loadStoryDocument(createReference(), {
      signal: controller.signal,
      fetch,
      onWarning
    });
    await discoveryStarted;
    controller.abort();

    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it("classifies rejected scenario requests separately from HTTP failures", async () => {
    const networkFailure = new Error("offline");
    const fetch = vi.fn().mockRejectedValue(networkFailure);

    await expect(
      loadStoryDocument(createReference(), {
        signal: new AbortController().signal,
        fetch
      })
    ).rejects.toMatchObject({
      name: "StoryDocumentLoadError",
      code: "scenario-network",
      cause: networkFailure
    });
    expect(fetch).toHaveBeenCalledOnce();

    await expect(
      loadStoryDocument(createReference(), {
        signal: new AbortController().signal,
        fetch: vi.fn().mockResolvedValue(new Response("", { status: 503 }))
      })
    ).rejects.toMatchObject({ code: "scenario-http", message: expect.stringContaining("503") });
  });

  it("does not start a scenario request when cancellation already happened", async () => {
    const controller = new AbortController();
    controller.abort("navigation changed");
    const fetch = vi.fn();

    await expect(
      loadStoryDocument(createReference(), { signal: controller.signal, fetch })
    ).rejects.toMatchObject({ name: "AbortError", cause: "navigation changed" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports actual byte progress when the response has no readable body", async () => {
    const text = JSON.stringify(verifiedScenarioFixture);
    const byteLength = new TextEncoder().encode(text).byteLength;
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "0" }),
      body: null,
      text: vi.fn().mockResolvedValue(text)
    } as unknown as Response;
    const progress: { loadedBytes: number; totalBytes: number | null }[] = [];

    await loadStoryDocument(createReference(), {
      signal: new AbortController().signal,
      fetch: vi.fn().mockResolvedValue(response),
      onProgress: (value) => progress.push(value)
    });

    expect(response.text).toHaveBeenCalledOnce();
    expect(progress).toEqual([
      { loadedBytes: 0, totalBytes: null },
      { loadedBytes: byteLength, totalBytes: byteLength }
    ]);
  });

  it("uses a valid content length for streamed progress updates", async () => {
    const text = JSON.stringify(verifiedScenarioFixture);
    const byteLength = new TextEncoder().encode(text).byteLength;
    const progress: { loadedBytes: number; totalBytes: number | null }[] = [];

    await loadStoryDocument(createReference(), {
      signal: new AbortController().signal,
      fetch: vi.fn().mockResolvedValue(
        new Response(text, {
          headers: { "content-length": String(byteLength) }
        })
      ),
      onProgress: (value) => progress.push(value)
    });

    expect(progress[0]).toEqual({ loadedBytes: 0, totalBytes: byteLength });
    expect(progress.at(-1)).toEqual({ loadedBytes: byteLength, totalBytes: byteLength });
  });

  it("converts a failed stream read into an invalid-scenario error with its cause", async () => {
    const streamFailure = new Error("scenario stream interrupted");
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(streamFailure);
        }
      })
    );

    await expect(
      loadStoryDocument(createReference(), {
        signal: new AbortController().signal,
        fetch: vi.fn().mockResolvedValue(response)
      })
    ).rejects.toMatchObject({
      code: "scenario-invalid",
      cause: expect.objectContaining({ message: "scenario stream interrupted" })
    });
  });

  it("aborts a streamed read when cancellation arrives during progress reporting", async () => {
    const controller = new AbortController();
    const text = JSON.stringify(verifiedScenarioFixture);
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode(text));
        }
      })
    );

    await expect(
      loadStoryDocument(createReference(), {
        signal: controller.signal,
        fetch: vi.fn().mockResolvedValue(response),
        onProgress: ({ loadedBytes }) => {
          if (loadedBytes > 0) controller.abort("reader closed");
        }
      })
    ).rejects.toMatchObject({ name: "AbortError", cause: "reader closed" });
  });

  it("deduplicates model references while retaining character unit metadata", async () => {
    const repeatedCostume = "05minori_normal";
    const scenario = {
      ...verifiedScenarioFixture,
      FirstLayout: [
        {
          Character2dId: 5,
          CostumeType: repeatedCostume,
          MotionName: "idle",
          FacialName: "normal",
          OffsetX: 0,
          PositionSide: 4
        }
      ],
      LayoutData: [
        {
          Character2dId: 5,
          CostumeType: repeatedCostume,
          MotionName: "idle",
          FacialName: "normal"
        }
      ]
    };
    const document = await loadStoryDocument(
      createReference("jp", {
        voiceCharacters: [{ character2dId: 5, assetName: "05minori", unit: "mmj" }]
      }),
      {
        signal: new AbortController().signal,
        fetch: vi.fn().mockResolvedValue(scenarioResponse(scenario))
      }
    );

    expect(document.models.filter(({ assetName }) => assetName === repeatedCostume)).toEqual([
      { character2dId: 5, assetName: repeatedCostume, unit: "mmj" }
    ]);
  });

  it("classifies an unsafe nested media path as a media-resolution failure", async () => {
    const scenario = structuredClone(verifiedScenarioFixture);
    scenario.TalkData[0]!.Voices[0]!.VoiceId = "../outside-bucket";

    await expect(
      loadStoryDocument(createReference(), {
        signal: new AbortController().signal,
        fetch: vi.fn().mockResolvedValue(scenarioResponse(scenario))
      })
    ).rejects.toMatchObject({
      name: "StoryDocumentLoadError",
      code: "media-resolution"
    });
  });

  it("normalizes sound-effect references without treating them as music", async () => {
    const scenario = {
      ...verifiedScenarioFixture,
      Snippets: [
        {
          Action: SnippetAction.Sound,
          ProgressBehavior: SnippetProgressBehavior.Now,
          ReferenceIndex: 0,
          Delay: 0
        }
      ],
      SoundData: [
        {
          PlayMode: 0,
          Bgm: "",
          Se: "se00001",
          Volume: 1,
          SeBundleName: "",
          Duration: 0
        }
      ]
    };
    const document = await loadStoryDocument(createReference(), {
      signal: new AbortController().signal,
      fetch: vi.fn().mockResolvedValue(scenarioResponse(scenario))
    });

    expect(document.media).toContainEqual(
      expect.objectContaining({
        kind: "se",
        identifier: "se00001",
        path: "sound/scenario/se/se_pack00001/se00001.mp3"
      })
    );
  });
});
