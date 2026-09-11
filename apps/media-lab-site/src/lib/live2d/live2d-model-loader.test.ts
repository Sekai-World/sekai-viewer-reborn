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
  const state: { model: unknown; applicationOptions: unknown } = {
    model: null,
    applicationOptions: null
  };

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
    constructor(options: unknown) {
      defaultRuntimeMocks.state.applicationOptions = options;
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
  remove(): void;
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
    createElement: vi.fn(() => {
      const script = {
        async: false,
        src: "",
        onload: null,
        onerror: null,
        parentNode: null,
        remove: vi.fn(() => {
          if (script.parentNode) script.parentNode.removeChild(script);
        })
      } as TestScript;
      return script;
    }),
    head
  };
  const windowMock: { Live2DCubismCore?: unknown; devicePixelRatio?: number } = {};

  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("window", windowMock);

  return { appendedScripts, removedScripts, windowMock };
};

beforeEach(() => {
  defaultRuntimeMocks.state.model = null;
  defaultRuntimeMocks.state.applicationOptions = null;
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

const relayDescriptor: Live2dModelDescriptor = {
  ...descriptor,
  modelUrl: "/live2d/assets/model/v1/sample/sample.model3.json",
  motions: [{ id: "idle", url: "/live2d/assets/motion/v1/sample/idle.motion3.json" }],
  expressions: [{ id: "smile", url: "/live2d/assets/motion/v1/sample/face_%20worry.motion3.json" }]
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

const relaySettingsPayload = {
  Version: 3,
  FileReferences: {
    Moc: "sample.moc3",
    Textures: ["textures/texture_00.png"],
    Physics: "sample.physics3.json",
    Pose: "sample.pose3.json",
    DisplayInfo: "sample.cdi3.json",
    UserData: "sample.userdata3.json",
    Expressions: [{ Name: "legacy", File: "legacy.exp3.json" }],
    Motions: { Idle: [{ File: "legacy.motion3.json" }] }
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

const createRuntime = (model: Live2dModelInstance, settings: unknown = settingsPayload) => {
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
        Moc: "https://assets.example.test/models/sample.moc3",
        Textures: ["https://assets.example.test/models/sample.2048/texture_00.png"],
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

  it("rejects model settings without FileReferences", () => {
    expect(() => buildLive2dModelSettings({}, descriptor)).toThrow(
      "Live2D model settings are missing FileReferences"
    );
  });

  it("rewrites relay model references to absolute same-origin relay URLs", () => {
    vi.stubGlobal("window", { location: { origin: "https://viewer.example.test" } });

    const settings = buildLive2dModelSettings(relaySettingsPayload, relayDescriptor);
    const references = settings.FileReferences as Record<string, unknown>;

    expect(settings).toMatchObject({
      url: "https://viewer.example.test/live2d/assets/model/v1/sample/sample.model3.json",
      FileReferences: {
        Moc: "https://viewer.example.test/live2d/assets/model/v1/sample/sample.moc3",
        Textures: [
          "https://viewer.example.test/live2d/assets/model/v1/sample/textures/texture_00.png"
        ],
        Physics: "https://viewer.example.test/live2d/assets/model/v1/sample/sample.physics3.json",
        Pose: "https://viewer.example.test/live2d/assets/model/v1/sample/sample.pose3.json",
        DisplayInfo: "https://viewer.example.test/live2d/assets/model/v1/sample/sample.cdi3.json",
        UserData: "https://viewer.example.test/live2d/assets/model/v1/sample/sample.userdata3.json",
        Expressions: [],
        Motions: {
          Motion: [
            { File: "https://viewer.example.test/live2d/assets/motion/v1/sample/idle.motion3.json" }
          ],
          Expression: [
            {
              File: "https://viewer.example.test/live2d/assets/motion/v1/sample/face_%20worry.motion3.json"
            }
          ]
        }
      }
    });
    expect(references.Motions).not.toEqual(relaySettingsPayload.FileReferences.Motions);
  });

  it("fetches relay model settings from the current origin before Cubism load", async () => {
    vi.stubGlobal("window", { location: { origin: "https://viewer.example.test" } });
    const { model } = createModel();
    const { runtime, cubism } = createRuntime(model, relaySettingsPayload);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });

    const resource = await loader.load(relayDescriptor, new AbortController().signal, vi.fn());

    expect(runtime.fetchSettings).toHaveBeenCalledWith(
      "https://viewer.example.test/live2d/assets/model/v1/sample/sample.model3.json",
      expect.any(AbortSignal)
    );
    expect(cubism.loadModel).toHaveBeenCalledTimes(1);
    await resource.destroy();
  });

  it("rewrites fixed upstream bucket references through the relay", () => {
    const settings = buildLive2dModelSettings(
      {
        FileReferences: {
          Moc: "https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/sample/sample.moc3"
        }
      },
      {
        ...relayDescriptor,
        modelUrl:
          "https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/sample/sample.model3.json"
      }
    );

    expect(settings).toMatchObject({
      url: "http://localhost/live2d/assets/model/v1/sample/sample.model3.json",
      FileReferences: {
        Moc: "http://localhost/live2d/assets/model/v1/sample/sample.moc3"
      }
    });
  });

  it("rejects unsafe relay references before Cubism load", async () => {
    const { model } = createModel();
    const { runtime, cubism } = createRuntime(model, {
      FileReferences: { Moc: "https://evil.example.test/model.moc3" }
    });
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });

    await expect(
      loader.load(relayDescriptor, new AbortController().signal, vi.fn())
    ).rejects.toThrow("Live2D asset reference is outside the relay");
    expect(cubism.loadModel).not.toHaveBeenCalled();
    expect(model.destroy).not.toHaveBeenCalled();
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

    const missingGlobalFirstLoad = ensureCubismCore();
    const missingGlobalSecondLoad = ensureCubismCore();

    await vi.waitFor(() => expect(browser.appendedScripts).toHaveLength(2));
    const missingGlobalScript = browser.appendedScripts[1];
    missingGlobalScript.onload?.();

    await expect(missingGlobalFirstLoad).rejects.toThrow("did not expose window.Live2DCubismCore");
    await expect(missingGlobalSecondLoad).rejects.toThrow("did not expose window.Live2DCubismCore");
    expect(browser.removedScripts).toEqual([firstScript, missingGlobalScript]);

    const detachedLoad = ensureCubismCore();

    await vi.waitFor(() => expect(browser.appendedScripts).toHaveLength(3));
    const detachedScript = browser.appendedScripts[2];
    detachedScript.parentNode = null;
    detachedScript.onerror?.();

    await expect(detachedLoad).rejects.toThrow("Failed to load Live2D Cubism Core");
    expect(browser.removedScripts).toEqual([firstScript, missingGlobalScript]);

    const retryFirstLoad = ensureCubismCore();
    const retrySecondLoad = ensureCubismCore();

    await vi.waitFor(() => expect(browser.appendedScripts).toHaveLength(4));
    const retryScript = browser.appendedScripts[3];
    expect(retryScript.src).toBe("/live2d/cubism-core/live2dcubismcore.min.js");
    browser.windowMock.Live2DCubismCore = {};
    retryScript.onload?.();

    await Promise.all([retryFirstLoad, retrySecondLoad]);

    const loadedAgain = ensureCubismCore();
    expect(browser.appendedScripts).toHaveLength(4);
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

  it("cleans up attached default-runtime display objects", async () => {
    const browser = createBrowserMocks();
    browser.windowMock.Live2DCubismCore = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => settingsPayload
      }))
    );
    const { model } = createModel();
    const view = { parentNode: null as unknown, remove: vi.fn() };
    defaultRuntimeMocks.application.view = view;
    defaultRuntimeMocks.state.model = model;

    type TestElement = { parentNode: unknown };
    const host = {
      appendChild: vi.fn((element: TestElement) => {
        element.parentNode = host;
      })
    } as unknown as HTMLElement;
    const displayObject = model as Live2dModelInstance & {
      parent: unknown;
      removeFromParent(): void;
    };
    displayObject.parent = defaultRuntimeMocks.application.stage;
    displayObject.removeFromParent = vi.fn();

    const loader = createLive2dModelLoader(host);
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    expect(defaultRuntimeMocks.state.applicationOptions).toMatchObject({
      autoDensity: true,
      resolution: 1
    });
    await resource.resize(640, 480);

    expect(defaultRuntimeMocks.application.renderer.resize).toHaveBeenCalledWith(640, 480);
    expect(defaultRuntimeMocks.application.render).not.toHaveBeenCalled();

    await resource.destroy();

    expect(displayObject.removeFromParent).toHaveBeenCalledTimes(1);
    expect(view.remove).toHaveBeenCalledTimes(1);
  });

  it("uses the browser device pixel ratio for default Pixi rendering", async () => {
    const browser = createBrowserMocks();
    browser.windowMock.Live2DCubismCore = {};
    browser.windowMock.devicePixelRatio = 2;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => settingsPayload
      }))
    );
    const { model } = createModel();
    defaultRuntimeMocks.application.view = {};
    defaultRuntimeMocks.state.model = model;

    const host = { appendChild: vi.fn() } as unknown as HTMLElement;
    const loader = createLive2dModelLoader(host);
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    expect(defaultRuntimeMocks.state.applicationOptions).toMatchObject({
      autoDensity: true,
      resolution: 2
    });

    await resource.destroy();
  });

  it("rejects a failed model settings response", async () => {
    const { model } = createModel();
    const { runtime } = createRuntime(model);
    runtime.fetchSettings.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => settingsPayload
    });
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });

    await expect(loader.load(descriptor, new AbortController().signal, vi.fn())).rejects.toThrow(
      "Failed to load Live2D model settings (503)"
    );
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

  it("forwards resource pause and resume to the Pixi application", async () => {
    const { model } = createModel();
    const { runtime, pixi } = createRuntime(model);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    await resource.pause();
    await resource.resume();

    expect(pixi.application.pause).toHaveBeenCalledTimes(1);
    expect(pixi.application.resume).toHaveBeenCalledTimes(1);
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

  it("allows horizontal pan for a model smaller than the viewport and clamps at the stage edge", async () => {
    const { model } = createModel();
    const { runtime } = createRuntime(model);
    const loader = createLive2dModelLoader(
      { clientWidth: 1000, clientHeight: 800 } as HTMLElement,
      { runtime }
    );
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    await resource.pan(100, 0);
    expect(model.position.set).toHaveBeenLastCalledWith(600, 400);

    await resource.pan(10_000, 0);
    expect(model.position.set).toHaveBeenLastCalledWith(840, 400);

    await resource.destroy();
  });

  it("preserves zoom and pan while refitting the model after a resize", async () => {
    const { model } = createModel();
    const { runtime } = createRuntime(model);
    const loader = createLive2dModelLoader(
      { clientWidth: 1000, clientHeight: 800 } as HTMLElement,
      { runtime }
    );
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    await resource.zoom(4, 500, 400);
    expect(model.scale.set).toHaveBeenLastCalledWith(3.2, 3.2);
    expect(model.position.set).toHaveBeenLastCalledWith(500, 400);
    await resource.pan(100, -50);
    await resource.resize(900, 700);

    expect(model.scale.set).toHaveBeenLastCalledWith(2.8, 2.8);
    expect(model.position.set).toHaveBeenLastCalledWith(550, 300);
    await resource.destroy();
  });

  it("bounds pan to the model viewport and resets the viewport with motion state", async () => {
    const { model, bodyMotionManager, faceMotionManager } = createModel();
    const { runtime } = createRuntime(model);
    const loader = createLive2dModelLoader(
      { clientWidth: 1000, clientHeight: 800 } as HTMLElement,
      { runtime }
    );
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    await resource.zoom(4, 500, 400);
    await resource.pan(100_000, 100_000);

    expect(model.position.set).toHaveBeenLastCalledWith(640, 1280);

    await resource.reset();

    expect(model.scale.set).toHaveBeenLastCalledWith(0.8, 0.8);
    expect(model.position.set).toHaveBeenLastCalledWith(500, 400);
    expect(bodyMotionManager.stopAllMotions).toHaveBeenCalled();
    expect(faceMotionManager.stopAllMotions).toHaveBeenCalled();
    await resource.destroy();
  });

  it("rejects non-positive or non-finite resize dimensions", async () => {
    const { model } = createModel();
    const { runtime, pixi } = createRuntime(model);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });
    const resource = await loader.load(descriptor, new AbortController().signal, vi.fn());

    expect(() => resource.resize(0, 480)).toThrow(
      "Live2D resize dimensions must be positive and finite"
    );
    expect(() => resource.resize(640, Number.POSITIVE_INFINITY)).toThrow(
      "Live2D resize dimensions must be positive and finite"
    );
    expect(pixi.application.resize).not.toHaveBeenCalled();

    await resource.destroy();
  });

  it("cleans up an attached model when progress reporting fails", async () => {
    const { model } = createModel();
    const { runtime, pixi } = createRuntime(model);
    const loader = createLive2dModelLoader({} as HTMLElement, { runtime });
    const onProgress = vi.fn((progress: number) => {
      if (progress === 1) throw new Error("progress consumer failed");
    });

    await expect(loader.load(descriptor, new AbortController().signal, onProgress)).rejects.toThrow(
      "progress consumer failed"
    );
    expect(pixi.application.removeModel).toHaveBeenCalledWith(model);
    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(pixi.application.destroy).toHaveBeenCalledTimes(1);
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
