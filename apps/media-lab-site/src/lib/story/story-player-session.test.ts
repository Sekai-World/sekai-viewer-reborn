import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoryPlayerRuntime } from "@platform/live2d-story-player";
import type { IScenarioData } from "./scenario-types";
import type { StoryVoiceCharacter } from "./scenario-rows";

const sessionMocks = vi.hoisted(() => ({
  ensureCubismCore: vi.fn(),
  collectStoryMediaUrls: vi.fn(),
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

vi.mock("$lib/live2d/cubism-core", async () => {
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
vi.mock("./story-media", () => ({
  collectStoryMediaUrls: sessionMocks.collectStoryMediaUrls
}));
vi.mock("./story-model-source", () => ({
  createStoryModelSource: sessionMocks.createStoryModelSource
}));
vi.mock("./player/ui_assets", () => ({
  getUIMediaUrls: sessionMocks.getUIMediaUrls
}));

import { createStoryPlayerSession, type StoryPlayerSessionSnapshot } from "./story-player-session";

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

const createOptions = () => ({
  host: {} as HTMLElement,
  stageSize: [640, 360] as [number, number],
  scenarioData: {} as IScenarioData,
  isCardStory: true,
  isActionSet: false,
  regionBucket: "bucket-jp",
  regionBase: "https://assets.test/",
  regionUrl: (path: string) => `https://region.test/${path}`,
  live2dUrl: (path: string) => `https://live2d.test/${path}`,
  voiceCharacters: new Map<number, StoryVoiceCharacter>(),
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
  sessionMocks.collectStoryMediaUrls.mockReset().mockResolvedValue([]);
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
    await import("$lib/live2d/cubism-core");

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
    expect(sessionMocks.collectStoryMediaUrls).not.toHaveBeenCalled();
    expect(pixiImportControl.createPixiStoryRuntime).not.toHaveBeenCalled();
  });

  it("does not continue initialization when media collection finishes after destroy", async () => {
    const media = createDeferred<unknown[]>();
    sessionMocks.collectStoryMediaUrls.mockReturnValue(media.promise);

    const session = createStoryPlayerSession(createOptions());
    const loading = session.load();
    await vi.waitFor(() => expect(sessionMocks.collectStoryMediaUrls).toHaveBeenCalledOnce());

    session.destroy();
    await loading;
    media.resolve([]);
    await media.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(sessionMocks.createStoryModelSource).not.toHaveBeenCalled();
    expect(pixiImportControl.createPixiStoryRuntime).not.toHaveBeenCalled();
  });

  it("creates the command handle synchronously and wires app media into Pixi on load", async () => {
    const options = createOptions();
    const modelSource = { getModelDataForCostume: vi.fn() };
    const mediaAssets = [{ url: "https://region.test/voice.ogg", type: "voice" }];
    const uiAssets = [{ url: "https://region.test/ui.png", type: "image" }];
    sessionMocks.createStoryModelSource.mockReturnValue(modelSource);
    sessionMocks.collectStoryMediaUrls.mockResolvedValue(mediaAssets);
    sessionMocks.getUIMediaUrls.mockReturnValue(uiAssets);

    const session = createStoryPlayerSession(options);
    expect(session).toBeDefined();
    expect(session.state).toBe("loading");
    expect(pixiImportControl.createPixiStoryRuntime).not.toHaveBeenCalled();

    await session.load();

    expect(session.state).toBe("ready");
    expect(sessionMocks.collectStoryMediaUrls).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioData: options.scenarioData,
        isCardStory: options.isCardStory,
        isActionSet: options.isActionSet,
        regionBucket: options.regionBucket,
        regionBase: options.regionBase,
        regionUrl: options.regionUrl,
        voiceCharacters: options.voiceCharacters
      })
    );
    expect(sessionMocks.createStoryModelSource).toHaveBeenCalledWith({
      live2dUrl: options.live2dUrl
    });
    expect(sessionMocks.getUIMediaUrls).toHaveBeenCalledWith(
      options.scenarioData,
      options.regionUrl
    );
    expect(pixiImportControl.createPixiStoryRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        host: options.host,
        stageSize: options.stageSize,
        scenarioData: options.scenarioData,
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
