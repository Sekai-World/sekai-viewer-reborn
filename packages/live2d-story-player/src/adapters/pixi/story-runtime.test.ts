import { describe, expect, it, vi } from "vitest";

vi.mock("./Live2DController.js", () => ({
  Live2DController: class Live2DController {}
}));

import type { ILive2DAbortableStoryModelSource, Live2DLoadRequest } from "./adapter-types.js";
import { Live2DPlayerEventEmitter } from "./Live2DPlayerEventEmitter.js";
import {
  createPixiStoryRuntime,
  type PixiStoryRuntimeOptions,
  type PixiStoryRuntimeController
} from "./story-runtime.js";
import { Live2DAssetType } from "./player-types.js";
import {
  CharacterLayoutDepthType,
  CharacterLayoutMode,
  CharacterLayoutMoveSpeedType,
  CharacterLayoutPosition,
  CharacterLayoutType,
  SnippetAction,
  SnippetProgressBehavior
} from "../../model/scenario-types.js";
import type { IScenarioData } from "../../model/scenario-types.js";
import type { ILive2DModelDataCollection } from "../../model/live2d-model.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";

const scenarioData: IScenarioData = {
  ScenarioId: "test",
  AppearCharacters: [],
  FirstLayout: [],
  FirstBgm: "",
  FirstBackground: "",
  FirstCharacterLayoutMode: CharacterLayoutMode.Normal,
  Snippets: [],
  TalkData: [],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: []
};

const modelSource: ILive2DAbortableStoryModelSource = {
  getModelDataForCostume: async () => null
};

const createModelScenario = (): IScenarioData => ({
  ...scenarioData,
  AppearCharacters: [{ Character2dId: 1, CostumeType: "costume-a" }],
  Snippets: [
    {
      Action: SnippetAction.CharacterMotion,
      ProgressBehavior: SnippetProgressBehavior.WaitUnitilFinished,
      ReferenceIndex: 0,
      Delay: 0
    }
  ],
  LayoutData: [
    {
      Type: CharacterLayoutType.CharacterMotion,
      SideFrom: CharacterLayoutPosition.Unspecified,
      SideFromOffsetX: 0,
      SideTo: CharacterLayoutPosition.Unspecified,
      SideToOffsetX: 0,
      DepthType: CharacterLayoutDepthType.Top,
      Character2dId: 1,
      CostumeType: "costume-a",
      MotionName: "motion-a",
      FacialName: "",
      MoveSpeedType: CharacterLayoutMoveSpeedType.Normal
    }
  ]
});

const createModelSource = (): ILive2DAbortableStoryModelSource => ({
  getModelDataForCostume: async () => ({
    cid: 1,
    costume: "costume-a",
    data: {
      url: "https://assets.invalid/costume-a/",
      FileReferences: {
        Textures: ["texture.png"],
        Moc: "model.moc3",
        Physics: "physics3.json",
        Motions: {
          Motion: [
            {
              Name: "motion-a",
              File: "https://assets.invalid/costume-a/motion-a.motion3.json",
              FadeInTime: 0,
              FadeOutTime: 0
            }
          ],
          Expression: []
        }
      }
    } as unknown as ILive2DModelDataCollection["data"]
  })
});

const directRequest: Live2DLoadRequest = <T>(
  request: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> => request(signal);

const makeHost = () => {
  const children: HTMLCanvasElement[] = [];
  const host = {
    appendChild: (canvas: HTMLCanvasElement): HTMLCanvasElement => {
      children.push(canvas);
      return canvas;
    },
    removeChild: (canvas: HTMLCanvasElement): HTMLCanvasElement => {
      const index = children.indexOf(canvas);
      if (index !== -1) children.splice(index, 1);
      return canvas;
    }
  } as unknown as HTMLElement;
  return { host, children };
};

const makeApplication = () => {
  const canvas = {
    style: { width: "", height: "", display: "" }
  } as HTMLCanvasElement;
  const application = {
    view: canvas,
    renderer: { resize: vi.fn() },
    destroy: vi.fn()
  };
  return application;
};

interface FakeControllerOptions {
  loadModel?: () => Promise<void>;
  onDestroy?: () => void;
  stepResults?: number[];
  silentStepResult?: number;
}

const makeController = (options: FakeControllerOptions = {}) => {
  const events = new Live2DPlayerEventEmitter();
  const stepCalls: { step: number; silent: boolean }[] = [];
  const volumeCalls: Parameters<PixiStoryRuntimeController["set_volume"]>[0][] = [];
  const stageSizes: [number, number][] = [];
  const destroyed: string[] = [];
  let pendingSelectable: string[] | null = null;
  const stepResults = [...(options.stepResults ?? [])];
  const controller = {
    step: 0,
    get pending_selectable(): string[] | null {
      return pendingSelectable;
    },
    events,
    animate: { abort: vi.fn() },
    settings: { text_animation: true },
    live2d_load_model: vi.fn(() => options.loadModel?.() ?? Promise.resolve()),
    step_until_checkpoint: async (
      step: number,
      stepOptions?: { silent?: boolean }
    ): Promise<number> => {
      stepCalls.push({ step, silent: stepOptions?.silent ?? false });
      if (stepOptions?.silent) return options.silentStepResult ?? -1;
      return stepResults.shift() ?? -1;
    },
    stop_sounds: vi.fn(),
    set_volume: vi.fn((volume: Parameters<PixiStoryRuntimeController["set_volume"]>[0]) => {
      volumeCalls.push(volume);
    }),
    set_stage_size: vi.fn((stageSize: [number, number]) => {
      stageSizes.push(stageSize);
    }),
    destroy: vi.fn(() => {
      destroyed.push("controller");
      options.onDestroy?.();
    })
  } satisfies PixiStoryRuntimeController;

  return {
    controller,
    destroyed,
    setPendingSelectable: (choices: string[] | null): void => {
      pendingSelectable = choices;
    },
    stepCalls,
    stageSizes,
    volumeCalls
  };
};

const makeOptions = (
  overrides: Partial<PixiStoryRuntimeOptions> = {},
  loadModel?: () => Promise<void>
) => {
  const { host, children } = makeHost();
  const application = makeApplication();
  const image = {} as HTMLImageElement;
  const releaseImage = vi.fn();
  const controllerFixture = makeController({
    stepResults: [4, 9],
    silentStepResult: 4,
    loadModel
  });
  const options: PixiStoryRuntimeOptions = {
    host,
    stageSize: [1920, 1080],
    scenarioData,
    mediaAssets: [],
    uiAssets: [
      {
        type: Live2DAssetType.UI,
        identifier: "ui",
        url: "https://assets.invalid/ui.png"
      }
    ],
    modelSource,
    settings: {
      voiceVolume: 0.65,
      bgmVolume: 0.4,
      seVolume: 0.3,
      textAnimation: true
    },
    loadOptions: {
      media: {
        image: {
          create: () => image,
          load: async () => undefined,
          release: releaseImage
        }
      }
    },
    createApplication: () => application,
    createController: () => controllerFixture.controller,
    ...overrides
  };
  return { options, application, children, controllerFixture, releaseImage };
};

describe("createPixiStoryRuntime", () => {
  const assertPreloadFailureReleasesMedia = async (
    failingStage: "models" | "motions"
  ): Promise<void> => {
    const { options, application, releaseImage } = makeOptions();
    const failure = new Response(null, { status: 503 });
    const fetcher = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      const shouldFail =
        failingStage === "models" ? url.endsWith("/texture.png") : url.endsWith(".motion3.json");
      return shouldFail ? failure : new Response(null, { status: 200 });
    });
    const createApplication = vi.fn(() => application);
    options.scenarioData = createModelScenario();
    options.modelSource = createModelSource();
    options.createApplication = createApplication;
    options.loadOptions = {
      ...options.loadOptions,
      fetch: fetcher,
      request: directRequest
    };

    await expect(createPixiStoryRuntime(options, new AbortController().signal)).rejects.toBe(
      failure
    );
    await vi.waitFor(() => expect(releaseImage).toHaveBeenCalledOnce());

    expect(fetcher).toHaveBeenCalled();
    expect(createApplication).not.toHaveBeenCalled();
    expect(application.destroy).not.toHaveBeenCalled();
    expect(releaseImage).toHaveBeenCalledOnce();
  };

  it("initializes and exposes checkpoint, settings, and resize commands", async () => {
    const { options, application, children, controllerFixture, releaseImage } = makeOptions();
    const selected: string[][] = [];
    options.callbacks = { onSelectable: (choices) => selected.push(choices) };
    const runtime = await createPixiStoryRuntime(options, new AbortController().signal);

    expect(children).toHaveLength(1);
    expect(controllerFixture.volumeCalls).toEqual([
      { voice_volume: 0.65, bgm_volume: 0.4, se_volume: 0.3 }
    ]);
    expect(controllerFixture.controller.settings.text_animation).toBe(true);
    expect(runtime.canGoBack).toBe(false);
    expect(runtime.canAutoplay).toBe(true);

    await expect(runtime.nextStep()).resolves.toBe("ready");
    await expect(runtime.nextStep()).resolves.toBe("ready");
    expect(runtime.canGoBack).toBe(true);

    controllerFixture.setPendingSelectable(["choice"]);
    expect(runtime.canAutoplay).toBe(false);
    await expect(runtime.prevStep()).resolves.toBe("ready");
    expect(controllerFixture.stepCalls).toEqual([
      { step: 0, silent: false },
      { step: 4, silent: false },
      { step: 0, silent: true }
    ]);
    expect(controllerFixture.controller.stop_sounds).toHaveBeenCalledWith([Live2DAssetType.Talk]);
    expect(selected).toEqual([["choice"]]);
    expect(runtime.canGoBack).toBe(false);

    runtime.setVolume({ voiceVolume: 0.2, seVolume: 0.1 });
    runtime.setTextAnimation(false);
    runtime.resize(800, 600);
    expect(controllerFixture.volumeCalls.at(-1)).toEqual({
      voice_volume: 0.2,
      bgm_volume: undefined,
      se_volume: 0.1
    });
    expect(controllerFixture.controller.settings.text_animation).toBe(false);
    expect(application.renderer.resize).toHaveBeenCalledWith(800, 600);
    expect(controllerFixture.stageSizes).toEqual([[800, 600]]);

    runtime.abort();
    expect(controllerFixture.controller.animate.abort).toHaveBeenCalledTimes(2);
    runtime.destroy();
    runtime.destroy();
    expect(controllerFixture.controller.destroy).toHaveBeenCalledTimes(1);
    expect(application.destroy).toHaveBeenCalledTimes(1);
    expect(releaseImage).toHaveBeenCalledTimes(1);
    expect(children).toHaveLength(0);
  });

  it("passes the injected audio adapter through to controller construction", async () => {
    const audioAdapter = {
      isPlaying: vi.fn(() => false),
      play: vi.fn(),
      stop: vi.fn(),
      unload: vi.fn(),
      setVolume: vi.fn(),
      getVolume: vi.fn(() => 1),
      setLoop: vi.fn(),
      fade: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      connectLipSync: vi.fn(() => null)
    } satisfies PixiStoryAudioAdapter;
    const { options, controllerFixture } = makeOptions({ audioAdapter });
    const receivedAdapters: (PixiStoryAudioAdapter | undefined)[] = [];
    options.createController = (_application, _stageSize, data) => {
      receivedAdapters.push(data.audioAdapter);
      return controllerFixture.controller;
    };

    const runtime = await createPixiStoryRuntime(options, new AbortController().signal);

    expect(receivedAdapters).toEqual([audioAdapter]);
    runtime.destroy();
  });

  it("disposes partially initialized media and the app when initial model loading fails", async () => {
    const failure = new Error("model creation failed");
    const { options, application, children, controllerFixture, releaseImage } = makeOptions(
      {},
      async () => {
        throw failure;
      }
    );

    await expect(createPixiStoryRuntime(options, new AbortController().signal)).rejects.toBe(
      failure
    );
    await vi.waitFor(() => {
      expect(controllerFixture.controller.destroy).toHaveBeenCalledTimes(1);
      expect(application.destroy).toHaveBeenCalledTimes(1);
      expect(releaseImage).toHaveBeenCalledTimes(1);
    });
    expect(children).toHaveLength(0);
  });

  it("disposes loaded media once when controller construction fails", async () => {
    const failure = new Error("controller construction failed");
    const { options, application, children, releaseImage } = makeOptions({
      createController: async () => {
        throw failure;
      }
    });

    await expect(createPixiStoryRuntime(options, new AbortController().signal)).rejects.toBe(
      failure
    );
    await vi.waitFor(() => {
      expect(application.destroy).toHaveBeenCalledOnce();
      expect(releaseImage).toHaveBeenCalledOnce();
    });

    expect(children).toHaveLength(0);
    expect(releaseImage).toHaveBeenCalledOnce();
  });

  it("disposes loaded media once when later model asset preloading fails", async () => {
    await assertPreloadFailureReleasesMedia("models");
  });

  it("disposes loaded media once when later motion preloading fails", async () => {
    await assertPreloadFailureReleasesMedia("motions");
  });

  it("waits for an in-flight model creation before disposing on abort", async () => {
    let finishModelCreation: (() => void) | undefined;
    const order: string[] = [];
    const modelCreation = new Promise<void>((resolve) => {
      finishModelCreation = () => {
        order.push("model-created");
        resolve();
      };
    });
    let controllerFixtureForAbort: PixiStoryRuntimeController | undefined;
    const { options, application, children, releaseImage } = makeOptions({
      createController: () => {
        const controller = makeController({
          loadModel: () => modelCreation,
          onDestroy: () => order.push("controller-destroyed")
        }).controller;
        controllerFixtureForAbort = controller;
        return controller;
      }
    });
    const abortController = new AbortController();
    const initialization = createPixiStoryRuntime(options, abortController.signal);

    await vi.waitFor(() => expect(controllerFixtureForAbort?.live2d_load_model).toHaveBeenCalled());
    abortController.abort();
    await expect(initialization).rejects.toMatchObject({ name: "AbortError" });

    expect(application.destroy).not.toHaveBeenCalled();
    finishModelCreation?.();
    await vi.waitFor(() => expect(application.destroy).toHaveBeenCalledTimes(1));
    expect(controllerFixtureForAbort?.destroy).toHaveBeenCalledTimes(1);
    expect(releaseImage).toHaveBeenCalledTimes(1);
    expect(children).toHaveLength(0);
    expect(order).toEqual(["model-created", "controller-destroyed"]);
  });
});
