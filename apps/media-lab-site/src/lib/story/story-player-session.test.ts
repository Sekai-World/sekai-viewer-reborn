import { beforeEach, describe, expect, it, vi } from "vitest";
import { Live2DAssetType, type StoryPlayerRuntime } from "@platform/live2d-story-player";
import type { IScenarioData } from "./scenario-types";

const sessionMocks = vi.hoisted(() => ({
  ensureCubismCore: vi.fn(),
  createStoryModelSource: vi.fn(),
  getUIMediaUrls: vi.fn()
}));

const cubismImportControl = vi.hoisted(() => ({
  gate: Promise.resolve(),
  onStart: (): void => undefined,
  onFinish: (): void => undefined
}));

const pixiImportControl = vi.hoisted(() => ({
  gate: Promise.resolve(),
  onStart: (): void => undefined,
  onFinish: (): void => undefined,
  createPixiStoryRuntime: vi.fn()
}));

vi.mock("#lib/live2d/cubism-core.js", async () => {
  cubismImportControl.onStart();
  await cubismImportControl.gate;
  cubismImportControl.onFinish();
  return { ensureCubismCore: sessionMocks.ensureCubismCore };
});
vi.mock("@platform/live2d-story-player/pixi", async () => {
  pixiImportControl.onStart();
  await pixiImportControl.gate;
  pixiImportControl.onFinish();
  return { createPixiStoryRuntime: pixiImportControl.createPixiStoryRuntime };
});
vi.mock("./story-model-source", () => ({
  createStoryModelSource: sessionMocks.createStoryModelSource
}));
vi.mock("./player/ui_assets", () => ({
  getUIMediaUrls: sessionMocks.getUIMediaUrls
}));

import {
  createStoryPlayerSession,
  type StoryPlayerSessionOptions,
  type StoryPlayerSessionSnapshot
} from "./story-player-session";

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createRuntime = (): StoryPlayerRuntime => ({
  nextStep: async () => "ready",
  prevStep: async () => "ready",
  canGoBack: false,
  abort: vi.fn(),
  setVolume: vi.fn(),
  setTextAnimation: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn()
});

const createOptions = (): StoryPlayerSessionOptions => ({
  host: {} as HTMLElement,
  stageSize: [640, 360] as [number, number],
  storyDocument: {
    identity: { region: "jp", storyType: "unit", storyId: "idol-1-1" },
    story: { scenarioId: "mmj_01_00" },
    scenario: {
      scenarioId: "mmj_01_00",
      path: "scenario/unitstory/idol-story-chapter/mmj_01_00.asset",
      url: "https://assets.test/sekai-jp-assets/scenario/unitstory/idol-story-chapter/mmj_01_00.asset"
    },
    assetBase: "https://assets.test",
    isCardStory: true,
    isActionSet: false,
    voiceCharacters: [],
    scenarioData: {} as IScenarioData,
    text: { scenarioId: "mmj_01_00", translationSource: "none" },
    initialMedia: [],
    media: [
      {
        kind: "voice",
        identifier: "voice_01",
        path: "sound/card_scenario/voice/mmj_01_00/voice_01.mp3",
        url: "https://assets.test/sekai-jp-assets/sound/card_scenario/voice/mmj_01_00/voice_01.mp3"
      }
    ],
    models: []
  },
  settings: {
    voiceVolume: 0.8,
    bgmVolume: 0.5,
    seVolume: 0.7,
    autoplay: true,
    textAnimation: false
  },
  callbacks: {
    onProgress: () => undefined,
    onWarning: vi.fn(),
    onSelectable: vi.fn()
  }
});

beforeEach(() => {
  sessionMocks.ensureCubismCore.mockReset().mockResolvedValue(undefined);
  sessionMocks.createStoryModelSource.mockReset().mockReturnValue({});
  sessionMocks.getUIMediaUrls.mockReset().mockReturnValue([]);
  cubismImportControl.gate = Promise.resolve();
  cubismImportControl.onStart = () => undefined;
  cubismImportControl.onFinish = () => undefined;
  pixiImportControl.createPixiStoryRuntime
    .mockReset()
    .mockImplementation(async () => createRuntime());
  pixiImportControl.gate = Promise.resolve();
  pixiImportControl.onStart = () => undefined;
  pixiImportControl.onFinish = () => undefined;
});

describe("createStoryPlayerSession", () => {
  it("does not initialize Cubism if destroyed during its module import", async () => {
    const importGate = createDeferred<void>();
    const importStarted = createDeferred<void>();
    const importFinished = createDeferred<void>();
    cubismImportControl.gate = importGate.promise;
    cubismImportControl.onStart = () => importStarted.resolve(undefined);
    cubismImportControl.onFinish = () => importFinished.resolve(undefined);

    const session = createStoryPlayerSession(createOptions());
    const loading = session.load();
    await importStarted.promise;

    session.destroy();
    await loading;
    importGate.resolve(undefined);
    await importFinished.promise;
    await import("#lib/live2d/cubism-core.js");

    expect(sessionMocks.ensureCubismCore).not.toHaveBeenCalled();
    expect(pixiImportControl.createPixiStoryRuntime).not.toHaveBeenCalled();
  });

  it("cancels an in-flight Pixi import when destroyed", async () => {
    const importGate = createDeferred<void>();
    const importStarted = createDeferred<void>();
    const importFinished = createDeferred<void>();
    const initializationOrder: string[] = [];
    pixiImportControl.gate = importGate.promise;
    pixiImportControl.onStart = () => {
      initializationOrder.push("pixi-import");
      importStarted.resolve(undefined);
    };
    pixiImportControl.onFinish = () => importFinished.resolve(undefined);
    sessionMocks.ensureCubismCore.mockImplementation(async () => {
      initializationOrder.push("cubism-ready");
    });

    const session = createStoryPlayerSession(createOptions());
    expect(session.state).toBe("loading");
    expect(sessionMocks.ensureCubismCore).not.toHaveBeenCalled();

    const loading = session.load();
    await importStarted.promise;
    expect(initializationOrder).toEqual(["cubism-ready", "pixi-import"]);

    session.destroy();
    await loading;
    importGate.resolve(undefined);
    await importFinished.promise;
    await import("@platform/live2d-story-player/pixi");

    expect(session.state).toBe("destroyed");
    expect(pixiImportControl.createPixiStoryRuntime).not.toHaveBeenCalled();
  });

  it("creates the command handle synchronously and wires app media into Pixi on load", async () => {
    const options = createOptions();
    const modelSource = { getModelDataForCostume: vi.fn() };
    const mediaAssets = [
      {
        identifier: "voice_01",
        type: Live2DAssetType.Talk,
        url: options.storyDocument.media[0].url
      }
    ];
    const uiAssets = [{ url: "https://region.test/ui.png", type: "image" }];
    sessionMocks.createStoryModelSource.mockReturnValue(modelSource);
    sessionMocks.getUIMediaUrls.mockReturnValue(uiAssets);

    const session = createStoryPlayerSession(options);
    expect(session).toBeDefined();
    expect(session.state).toBe("loading");
    expect(pixiImportControl.createPixiStoryRuntime).not.toHaveBeenCalled();

    await session.load();

    expect(session.state).toBe("ready");
    expect(sessionMocks.createStoryModelSource).toHaveBeenCalledWith(
      expect.objectContaining({
        live2dUrl: expect.any(Function),
        signal: expect.any(AbortSignal)
      })
    );
    expect(sessionMocks.getUIMediaUrls).toHaveBeenCalledWith(
      options.storyDocument.scenarioData,
      expect.any(Function)
    );
    expect(pixiImportControl.createPixiStoryRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        host: options.host,
        stageSize: options.stageSize,
        scenarioData: options.storyDocument.scenarioData,
        mediaAssets,
        uiAssets,
        modelSource,
        settings: {
          voiceVolume: options.settings.voiceVolume,
          bgmVolume: options.settings.bgmVolume,
          seVolume: options.settings.seVolume,
          autoplay: options.settings.autoplay,
          textAnimation: options.settings.textAnimation
        }
      }),
      expect.any(AbortSignal)
    );

    session.destroy();
  });

  it("replays a late load failure to subscribers and retries the session", async () => {
    const failure = new Error("runtime initialization failed");
    pixiImportControl.createPixiStoryRuntime
      .mockImplementationOnce(async () => {
        throw failure;
      })
      .mockImplementationOnce(async () => createRuntime());

    const session = createStoryPlayerSession(createOptions());
    await expect(session.load()).rejects.toBe(failure);

    const snapshots: StoryPlayerSessionSnapshot[] = [];
    const unsubscribe = session.subscribe((snapshot) => snapshots.push(snapshot));
    expect(snapshots.at(-1)).toMatchObject({ state: "error", error: failure });
    expect(session.error).toBe(failure);

    await session.retry();

    expect(session.state).toBe("ready");
    expect(pixiImportControl.createPixiStoryRuntime).toHaveBeenCalledTimes(2);
    unsubscribe();
    session.destroy();
  });

  it("normalizes synchronous factory throws and asynchronous rejections", async () => {
    const synchronousFailure = { code: "synchronous-initialization-failure" };
    sessionMocks.ensureCubismCore.mockImplementation(() => {
      throw synchronousFailure;
    });
    const synchronousSession = createStoryPlayerSession(createOptions());

    await expect(synchronousSession.load()).rejects.toMatchObject({
      message: "Story player operation failed",
      cause: synchronousFailure
    });
    expect(synchronousSession.state).toBe("error");
    synchronousSession.destroy();

    sessionMocks.ensureCubismCore.mockReset().mockRejectedValue("asynchronous failure");
    const asynchronousSession = createStoryPlayerSession(createOptions());

    await expect(asynchronousSession.load()).rejects.toMatchObject({
      message: "asynchronous failure",
      cause: "asynchronous failure"
    });
    expect(asynchronousSession.state).toBe("error");
    asynchronousSession.destroy();
  });
});
