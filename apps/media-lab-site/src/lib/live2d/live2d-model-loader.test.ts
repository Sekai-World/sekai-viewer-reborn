import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLive2dModelSettings,
  createLive2dModelLoader,
  ensureCubismCore,
  type Live2dCubismRuntime,
  type Live2dModelInstance,
  type Live2dPixiApplication,
  type Live2dPixiRuntime,
  type Live2dRuntimeFacade
} from "./live2d-model-loader";
import type { Live2dModelDescriptor } from "./model-viewer";

const defaultRuntimeMocks = vi.hoisted(() => {
  const application = {
    view: {},
    ticker: {},
    stage: {
      addChild: vi.fn(),
      removeChild: vi.fn()
    },
    renderer: { resize: vi.fn() },
    render: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    destroy: vi.fn()
  };
  const state: { model: unknown } = { model: null };

  return {
    application,
    state,
    addExtension: vi.fn(),
    loadModel: vi.fn(async () => state.model),
    config: { LOG_LEVEL_ERROR: 0, logLevel: 0, sound: true }
  };
});

vi.mock("pixi.js", () => ({
  TickerPlugin: {},
  extensions: { add: defaultRuntimeMocks.addExtension },
  Application: class {
    constructor() {
      return defaultRuntimeMocks.application;
    }
  }
}));

vi.mock("@sekai-world/pixi-live2d-display-mulmotion/cubism4", () => ({
  config: defaultRuntimeMocks.config,
  MotionPriority: { FORCE: 3 },
  Live2DModel: { from: defaultRuntimeMocks.loadModel }
}));

type TestScript = {
  async: boolean;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  parentNode: TestScriptParent | null;
};

type TestScriptParent = {
  appendChild(script: TestScript): void;
  removeChild(script: TestScript): void;
};

const createBrowserMocks = () => {
  const appendedScripts: TestScript[] = [];
  const removedScripts: TestScript[] = [];
  const head: TestScriptParent = {
    appendChild: vi.fn((script: TestScript) => {
      script.parentNode = head;
      appendedScripts.push(script);
    }),
    removeChild: vi.fn((script: TestScript) => {
      script.parentNode = null;
      removedScripts.push(script);
    })
  };
  const documentMock = {
    createElement: vi.fn(
      () =>
        ({
          async: false,
          src: "",
          onload: null,
          onerror: null,
          parentNode: null
        }) as TestScript
    ),
    head
  };
  const windowMock: { Live2DCubismCore?: unknown } = {};

  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("window", windowMock);

  return { appendedScripts, removedScripts, windowMock };
};

beforeEach(() => {
  defaultRuntimeMocks.state.model = null;
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllGlobals());

const descriptor: Live2dModelDescriptor = {
  modelId: "sample-model",
  region: "jp",
  modelUrl: "https://assets.example.test/models/sample.model3.json",
  motions: [
    { id: "idle", url: "https://assets.example.test/motions/idle.motion3.json" },
    { id: "wave", url: "https://assets.example.test/motions/wave.motion3.json" }
  ],
  expressions: [
    { id: "smile", url: "https://assets.example.test/motions/facial/smile.motion3.json" },
    { id: "sad", url: "https://assets.example.test/motions/facial/sad.motion3.json" }
  ]
};

const settingsPayload = {
  Version: 3,
  FileReferences: {
    Moc: "sample.moc3",
    Textures: ["sample.2048/texture_00.png"],
    Expressions: [{ Name: "legacy", File: "legacy.exp3.json" }],
    Motions: {
      Idle: [{ File: "guessed-relative-idle.motion3.json" }]
    }
  }
};

const createModel = () => {
  const bodyMotionManager = {
    startMotion: vi.fn(async () => true),
    stopAllMotions: vi.fn()
  };
  const faceMotionManager = {
    startMotion: vi.fn(async () => true),
    stopAllMotions: vi.fn()
  };
  let breathParameters: unknown = ["breath"];
  const breath = {
    getParameters: vi.fn(() => breathParameters),
    setParameters: vi.fn((parameters: unknown) => {
      breathParameters = parameters;
    })
  };
  const model: Live2dModelInstance = {
    internalModel: {
      breath,
      width: 400,
      height: 800,
      motionManager: bodyMotionManager,
      parallelMotionManager: [bodyMotionManager, faceMotionManager],
      extendParallelMotionManager: vi.fn()
    },
    anchor: { set: vi.fn() },
    position: { set: vi.fn() },
    scale: { set: vi.fn() },
    destroy: vi.fn()
  };
  return { model, bodyMotionManager, faceMotionManager, breath };
};

const createRuntime = (model: Live2dModelInstance, settings = settingsPayload) => {
  const ticker = {} as Live2dPixiApplication["ticker"];
  const application = {
    ticker,
    addModel: vi.fn(),
    removeModel: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn()
  };
  const pixi = {
    createApplication: vi.fn(() => application)
  } satisfies Live2dPixiRuntime;
  const cubism = {
    forcePriority: 3,
    loadModel: vi.fn(async () => model)
  } satisfies Live2dCubismRuntime;
  const runtime = {
    loadPixi: vi.fn(async () => pixi),
    loadCubism4: vi.fn(async () => cubism),
    fetchSettings: vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => settings
    }))
  } satisfies Live2dRuntimeFacade;
  return {
    runtime,
    pixi: { createApplication: pixi.createApplication, application },
    cubism: { loadModel: cubism.loadModel }
  };
};

describe("Live2D model settings adapter", () => {
  it("clones model settings and routes body/facial files to Motion groups", () => {
    const settings = buildLive2dModelSettings(settingsPayload, descriptor);
    const references = settings.FileReferences as Record<string, unknown>;

    expect(settings).toEqual({
      ...settingsPayload,
      url: descriptor.modelUrl,
      FileReferences: {
        ...settingsPayload.FileReferences,
        Expressions: [],
        Motions: {
          Motion: descriptor.motions.map((motion) => ({ File: motion.url })),
          Expression: descriptor.expressions.map((expression) => ({ File: expression.url }))
        }
      }
    });
    expect(references).not.toBe(settingsPayload.FileReferences);
    expect(settingsPayload.FileReferences.Motions).toEqual({
      Idle: [{ File: "guessed-relative-idle.motion3.json" }]
    });
  });
});

describe("Live2D Pixi/Cubism loader", () => {
  it("can construct the default loader in the node test environment", () => {
    const loader = createLive2dModelLoader({} as HTMLElement);

    expect(loader.load).toEqual(expect.any(Function));
  });

  it("loads the same-origin Cubism Core once and retries after a failed script", async () => {
    const browser = createBrowserMocks();
    const firstLoad = ensureCubismCore();
    const secondLoad = ensureCubismCore();

    await vi.waitFor(() => expect(browser.appendedScripts).toHaveLength(1));
    const firstScript = browser.appendedScripts[0];
    expect(firstScript.src).toBe("/live2d/cubism-core/live2dcubismcore.min.js");
    expect(firstScript.async).toBe(true);

    firstScript.onerror?.();
    await expect(firstLoad).rejects.toThrow("Failed to load Live2D Cubism Core");
    await expect(secondLoad).rejects.toThrow("Failed to load Live2D Cubism Core");
    expect(browser.removedScripts).toEqual([firstScript]);

    const retryFirstLoad = ensureCubismCore();
    const retrySecondLoad = ensureCubismCore();

    await vi.waitFor(() => expect(browser.appendedScripts).toHaveLength(2));
    const retryScript = browser.appendedScripts[1];
    expect(retryScript.src).toBe("/live2d/cubism-core/live2dcubismcore.min.js");
    browser.windowMock.Live2DCubismCore = {};
    retryScript.onload?.();

    await Promise.all([retryFirstLoad, retrySecondLoad]);

    const loadedAgain = ensureCubismCore();
    expect(browser.appendedScripts).toHaveLength(2);
    await loadedAgain;
  });

  it("does not load browser runtimes until load is called", async () => {
    const { model } = createModel();
    const { runtime } = createRuntime(model);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });

    expect(runtime.loadPixi).not.toHaveBeenCalled();
    expect(runtime.loadCubism4).not.toHaveBeenCalled();
    expect(runtime.fetchSettings).not.toHaveBeenCalled();

    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());
    expect(runtime.loadPixi).toHaveBeenCalledTimes(1);
    expect(runtime.loadCubism4).toHaveBeenCalledTimes(1);
    expect(runtime.fetchSettings).toHaveBeenCalledWith(
      descriptor.modelUrl,
      expect.any(AbortSignal)
    );
    await resource.destroy();
  });

  it("maps body and facial labels to independent parallel motion slots", async () => {
    const { model, bodyMotionManager, faceMotionManager, breath } = createModel();
    const { runtime, pixi, cubism } = createRuntime(model);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });
    const progress: number[] = [];

    const resource = await loader.load(descriptor, new AbortController().signal, (value) => {
      progress.push(value);
    });

    expect(model.internalModel.extendParallelMotionManager).toHaveBeenCalledWith(2);
    expect(pixi.application.addModel).toHaveBeenCalledWith(model);
    expect(cubism.loadModel).toHaveBeenCalledWith(expect.any(Object), {
      ticker: pixi.application.ticker
    });
    expect(progress).toEqual([0, 0.15, 0.3, 1]);

    await resource.playMotion("wave", { loop: true, speed: 1.5 });
    await resource.playExpression("sad");

    expect(bodyMotionManager.startMotion).toHaveBeenCalledWith("Motion", 1, 3);
    expect(faceMotionManager.startMotion).toHaveBeenCalledWith("Expression", 1, 3);
    expect(bodyMotionManager.startMotion).toHaveBeenCalledTimes(1);
    expect(faceMotionManager.startMotion).toHaveBeenCalledTimes(1);
    await resource.pause();
    await resource.reset();
    await resource.resize(640, 480);
    expect(pixi.application.pause).toHaveBeenCalledTimes(1);
    expect(bodyMotionManager.stopAllMotions).toHaveBeenCalledTimes(1);
    expect(faceMotionManager.stopAllMotions).toHaveBeenCalledTimes(1);
    expect(pixi.application.resize).toHaveBeenCalledWith(640, 480);
    await resource.setIdle(false);
    await resource.setIdle(true);
    expect(breath.setParameters).toHaveBeenNthCalledWith(1, []);
    expect(breath.setParameters).toHaveBeenNthCalledWith(2, ["breath"]);
    await expect(resource.playMotion("missing", { loop: false, speed: 1 })).rejects.toThrow(
      "Unknown Live2D motion"
    );
    await expect(resource.playExpression("missing")).rejects.toThrow("Unknown Live2D expression");
    await resource.destroy();
  });

  it("centers and contains the model on load and recomputes its transform on resize", async () => {
    const { model } = createModel();
    const { runtime, pixi } = createRuntime(model);
    const loader = createLive2dModelLoader(
      { clientWidth: 1000, clientHeight: 800 } as HTMLElement,
      { runtime }
    );

    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    expect(model.anchor.set).toHaveBeenCalledWith(0.5, 0.5);
    expect(model.scale.set).toHaveBeenCalledWith(0.8, 0.8);
    expect(model.position.set).toHaveBeenCalledWith(500, 400);

    await resource.resize(1200, 600);

    expect(model.scale.set).toHaveBeenLastCalledWith(0.6, 0.6);
    expect(model.position.set).toHaveBeenLastCalledWith(600, 300);
    expect(pixi.application.resize).toHaveBeenCalledWith(1200, 600);
    await resource.destroy();
  });

  it("destroys the model and Pixi canvas exactly once", async () => {
    const { model } = createModel();
    const { runtime, pixi } = createRuntime(model);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    await resource.destroy();
    await resource.destroy();

    expect(pixi.application.removeModel).toHaveBeenCalledTimes(1);
    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(pixi.application.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects an aborted model load and retires a late model without WebGL", async () => {
    const { model } = createModel();
    let resolveModel: ((value: Live2dModelInstance) => void) | undefined;
    const { runtime, pixi, cubism } = createRuntime(model);
    cubism.loadModel.mockImplementation(
      () =>
        new Promise<Live2dModelInstance>((resolve) => {
          resolveModel = resolve;
        })
    );
    const controller = new AbortController();
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });
    const pendingLoad = loader.load(descriptor, controller.signal, vi.fn());

    await vi.waitFor(() => expect(cubism.loadModel).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(pendingLoad).rejects.toMatchObject({ name: "AbortError" });
    expect(pixi.application.destroy).toHaveBeenCalledTimes(1);

    resolveModel?.(model);
    await Promise.resolve();
    expect(model.destroy).toHaveBeenCalledTimes(1);
  });
});
