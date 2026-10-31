import { afterEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => {
  class Point {
    x = 0;
    y = 0;

    set(x: number, y = x): void {
      this.x = x;
      this.y = y;
    }
  }

  class Container {
    alpha = 1;
    visible = false;
    x = 0;
    y = 0;
    rotation = 0;
    filters: unknown[] | null = null;
    children: Container[] = [];
    position = new Point();
    scale = new Point();
    anchor = new Point();

    addChild<T extends Container>(...children: T[]): T {
      this.children.push(...children);
      return children[children.length - 1]!;
    }

    removeChildren(): Container[] {
      const children = [...this.children];
      this.children = [];
      return children;
    }

    destroy(): void {
      this.children = [];
    }
  }

  class DisplayObject extends Container {}

  class AlphaFilter {
    resolution = 1;

    constructor(public alpha: number) {}
  }

  class ColorMatrixFilter {
    resolution = 1;
    matrix: number[] = [];
  }

  class Filter {
    resolution = 1;

    constructor(...args: unknown[]) {
      void args;
    }
  }

  class TextStyle {
    constructor(options: Record<string, unknown> = {}) {
      Object.assign(this, options);
    }
  }

  class Text extends DisplayObject {
    style = new TextStyle();

    constructor(public text: string) {
      super();
    }
  }

  class Sprite extends DisplayObject {
    constructor(texture?: unknown) {
      super();
      void texture;
    }
  }

  class Texture {
    static from(): Texture {
      return new Texture();
    }
  }

  class Ticker {
    static shared = {};
  }

  class FakeAnimation {
    root = new Container();

    start(): Promise<void> {
      return Promise.resolve();
    }

    set_style(stageSize: [number, number]): void {
      void stageSize;
    }

    destroy(): void {}
  }

  class FakeHologram extends FakeAnimation {}

  class FakeLive2DModel extends Container {
    internalModel = {};

    static from<T extends FakeLive2DModel>(this: new () => T): Promise<T> {
      return Promise.resolve(new this());
    }
  }

  return {
    AlphaFilter,
    ColorMatrixFilter,
    Container,
    DisplayObject,
    FakeAnimation,
    FakeHologram,
    FakeLive2DModel,
    Filter,
    Sprite,
    Text,
    TextStyle,
    Texture,
    Ticker
  };
});

vi.mock("pixi.js", () => ({
  AlphaFilter: doubles.AlphaFilter,
  BlurFilter: doubles.Filter,
  ColorMatrixFilter: doubles.ColorMatrixFilter,
  Container: doubles.Container,
  DisplayObject: doubles.DisplayObject,
  Sprite: doubles.Sprite,
  Text: doubles.Text,
  TextStyle: doubles.TextStyle,
  Texture: doubles.Texture,
  Ticker: doubles.Ticker
}));

vi.mock("@sekai-world/pixi-live2d-display-mulmotion/cubism4", () => ({
  Cubism4InternalModel: class {},
  Live2DModel: doubles.FakeLive2DModel,
  MotionPreloadStrategy: { ALL: "all" },
  MotionPriority: { FORCE: 3 }
}));

vi.mock("../../core/log.js", () => ({ log: { log: vi.fn(), warn: vi.fn() } }));
vi.mock("./Live2DPlayer.js", () => ({ Live2DPlayer: class {} }));
vi.mock("./action/index.js", () => ({ default: vi.fn() }));
vi.mock("./action/special_effect/SimpleSelectable.js", () => ({
  default: vi.fn(),
  parseSimpleSelectableChoices: vi.fn(() => [])
}));
vi.mock("./audio-adapter.js", () => ({ createHowlerStoryAudioAdapter: vi.fn(() => ({})) }));
vi.mock("./animation/AnimationController.js", () => ({
  default: class {
    abort_controller = new AbortController();
    abort = vi.fn();
    reset_abort = vi.fn();
    delay = vi.fn(async () => {});
    wrapper = vi.fn(async () => {});
    progress_wrapper = vi.fn(async (apply: (progress: number) => void) => apply(1));
  }
}));
vi.mock("./animation/Hologram.js", () => ({ default: doubles.FakeHologram }));
vi.mock("./animation/BaseAnimation.js", () => ({ default: doubles.FakeAnimation }));
vi.mock("./animation/Line.js", () => ({ default: doubles.FakeAnimation }));
vi.mock("./animation/LineLegend.js", () => ({ default: doubles.FakeAnimation }));
vi.mock("./animation/Kirakira.js", () => ({ default: doubles.FakeAnimation }));
vi.mock("./animation/Blackout.js", () => ({ default: doubles.FakeAnimation }));
vi.mock("./animation/Lightup.js", () => ({ default: doubles.FakeAnimation }));
vi.mock("./animation/LightupLegend.js", () => ({ default: doubles.FakeAnimation }));

import type { Application } from "pixi.js";
import {
  CharacterLayoutDepthType,
  CharacterLayoutMoveSpeedType,
  CharacterLayoutPosition,
  CharacterLayoutType,
  CharacterLayoutMode,
  SnippetAction,
  SnippetProgressBehavior
} from "../../model/scenario-types.js";
import type { IScenarioData, LayoutData, Snippet, TalkData } from "../../model/scenario-types.js";
import type { StoryPlayerLogger } from "../../core/log.js";
import type { ILive2DScenarioResource } from "./player-types.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";
import { Live2DController } from "./Live2DController.js";
import action_layout from "./action/character_layout.js";
import action_talk from "./action/talk.js";
import Dialog from "./layer/Dialog.js";
import FullScreenText from "./layer/FullScreenText.js";
import Live2D from "./layer/Live2D.js";
import SceneEffect from "./layer/SceneEffect.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: (value: T) => resolvePromise(value),
    reject: rejectPromise
  };
}

const createLogger = (): StoryPlayerLogger => ({ log: vi.fn(), warn: vi.fn() });

const createSnippet = (Action: SnippetAction, ReferenceIndex = 0, Delay = 0): Snippet => ({
  Action,
  ProgressBehavior: SnippetProgressBehavior.WaitUnitilFinished,
  ReferenceIndex,
  Delay
});

const createScenario = (Snippets: Snippet[] = []): IScenarioData => ({
  ScenarioId: "sonar-core-test",
  AppearCharacters: [],
  FirstLayout: [],
  FirstBgm: "",
  FirstBackground: "",
  FirstCharacterLayoutMode: CharacterLayoutMode.Normal,
  Snippets,
  TalkData: [],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: []
});

const createTalkData = (overrides: Partial<TalkData> = {}): TalkData => ({
  TalkCharacters: [],
  WindowDisplayName: "Miku",
  Body: "line",
  TalkTention: 0,
  LipSync: 0,
  MotionChangeFrom: 0,
  Motions: [],
  Voices: [],
  Speed: 1,
  FontSize: 16,
  WhenFinishCloseWindow: 0,
  RequirePlayEffect: 0,
  EffectReferenceIdx: 0,
  RequirePlaySound: 0,
  SoundReferenceIdx: 0,
  ...overrides
});

function createTalkController(talk: TalkData, textAnimation = true) {
  const layers = {
    telop: { hide: vi.fn(async () => {}) },
    dialog: {
      draw: vi.fn(async () => {}),
      animate: vi.fn(async () => {}),
      show: vi.fn(async () => {})
    },
    live2d: { stop_speaking: vi.fn(), speak: vi.fn() }
  };
  const controller = {
    scenarioData: { TalkData: [talk] },
    scenarioResource: { audio: [] },
    layers,
    logger: createLogger(),
    events: { emit: vi.fn() },
    replay_silent: false,
    settings: { text_animation: textAnimation, voice_volume: 0.8 },
    audioAdapter: { setVolume: vi.fn(), play: vi.fn() },
    resolveText: vi.fn((_kind: string, _index: number, original: string) => ({
      displayText: original,
      translatedText: null
    })),
    live2d_get_costume: vi.fn(() => "costume-a"),
    apply_live2d_motion: vi.fn(async () => {}),
    stop_sounds: vi.fn()
  } as unknown as Live2DController;
  return { controller, layers };
}

function createLayoutData(Type: CharacterLayoutType): LayoutData {
  return {
    Type,
    SideFrom: CharacterLayoutPosition.Left,
    SideFromOffsetX: 0,
    SideTo: CharacterLayoutPosition.Right,
    SideToOffsetX: 0,
    DepthType: CharacterLayoutDepthType.Back,
    Character2dId: 1,
    CostumeType: "costume-a",
    MotionName: "wave",
    FacialName: "smile",
    MoveSpeedType: CharacterLayoutMoveSpeedType.Normal
  };
}

describe("Sonar async ownership regressions", () => {
  it("runs the dialog fade beside checkpoint actions and reports failure without delaying them", async () => {
    const fade = deferred<void>();
    const actionStarted = deferred<void>();
    const scenario = createScenario([
      createSnippet(SnippetAction.None),
      createSnippet(SnippetAction.None, 0, 1.2)
    ]);
    const logger = createLogger();
    const controller = new Live2DController({} as Application, [1280, 720], {
      scenarioData: scenario,
      scenarioResource: { image: [], video: [], audio: [] } as ILive2DScenarioResource,
      modelData: [],
      audioAdapter: {} as PixiStoryAudioAdapter,
      logger
    });
    controller.animate = { reset_abort: vi.fn() } as unknown as Live2DController["animate"];
    controller.layers = {
      dialog: { hide: vi.fn(() => fade.promise) }
    } as unknown as Live2DController["layers"];
    controller.live2d_load_model = vi.fn(async () => {});
    controller.apply_action = vi.fn(async () => {
      actionStarted.resolve(undefined);
    });
    controller.wait_talk_sounds_finished = vi.fn(async () => {});

    const error = new Error("dialog fade failed");
    const result = controller.step_until_checkpoint(0).then(
      () => ({ status: "fulfilled" as const }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );

    await actionStarted.promise;
    expect(controller.layers.dialog.hide).toHaveBeenCalledWith(200);
    await expect(result).resolves.toEqual({ status: "fulfilled" });
    fade.reject(error);
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "Dialog hide failed during checkpoint advance:",
      error
    );
  });

  it("keeps delayed appearance motion detached from show and move timing", async () => {
    const show = deferred<void>();
    const move = deferred<void>();
    const delay = deferred<void>();
    const motion = deferred<void>();
    const hide = deferred<void>();
    const data = createLayoutData(CharacterLayoutType.Appear);
    const logger = createLogger();
    const applyMotion = vi.fn(
      (_costume: string, _motion: string, _expression: string, toLastFrame?: boolean) =>
        toLastFrame ? Promise.resolve() : motion.promise
    );
    const live2d = {
      layout_mode: "normal" as const,
      show_model: vi.fn(() => show.promise),
      move: vi.fn(() => move.promise),
      set_position: vi.fn()
    };
    const controller = {
      scenarioData: { LayoutData: [data] },
      logger,
      layers: { telop: { hide: vi.fn(() => hide.promise) }, live2d },
      animate: { delay: vi.fn(() => delay.promise) },
      live2d_set_costume: vi.fn(() => "costume-a"),
      live2d_get_costume: vi.fn(() => "costume-a"),
      live2d_set_appear: vi.fn(),
      live2d_track_appear: vi.fn(),
      apply_live2d_motion: applyMotion
    } as unknown as Live2DController;
    const result = action_layout(controller, createSnippet(SnippetAction.CharacterLayout)).then(
      () => ({ status: "fulfilled" as const }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );

    expect(controller.layers.telop.hide).toHaveBeenCalledWith(500);
    await Promise.resolve();
    expect(live2d.show_model).toHaveBeenCalledWith("costume-a", 200);
    expect(live2d.move).toHaveBeenCalledOnce();
    expect(controller.animate.delay).toHaveBeenCalledWith(10);
    expect(applyMotion).toHaveBeenCalledTimes(1);

    show.resolve(undefined);
    await Promise.resolve();
    expect(controller.live2d_set_appear).toHaveBeenCalledWith(1);
    move.resolve(undefined);
    delay.resolve(undefined);
    await Promise.resolve();
    expect(applyMotion).toHaveBeenCalledTimes(2);

    await expect(result).resolves.toEqual({ status: "fulfilled" });
    const motionError = new Error("delayed appearance motion failed");
    const hideError = new Error("telop hide failed");
    motion.reject(motionError);
    hide.reject(hideError);
    await Promise.resolve();
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "Character appearance motion failed:",
      expect.anything(),
      motionError
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "Character layout telop hide failed:",
      expect.anything(),
      hideError
    );
  });

  it("hides a cleared model only after its parallel Appear has finished", async () => {
    const appeared = deferred<void>();
    const hideModel = vi.fn(async () => {});
    const controller = {
      scenarioData: { LayoutData: [createLayoutData(CharacterLayoutType.Clear)] },
      logger: createLogger(),
      layers: {
        telop: { hide: vi.fn(async () => {}) },
        live2d: {
          layout_mode: "normal" as const,
          move: vi.fn(async () => {}),
          hide_model: hideModel
        }
      },
      live2d_get_costume: vi.fn(() => "costume-a"),
      live2d_wait_appeared: vi.fn(() => appeared.promise),
      live2d_stay: vi.fn(async () => {})
    } as unknown as Live2DController;

    const done = action_layout(controller, createSnippet(SnippetAction.CharacterLayout));
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.live2d_wait_appeared).toHaveBeenCalledWith(1);
    expect(controller.live2d_stay).not.toHaveBeenCalled();
    expect(hideModel).not.toHaveBeenCalled();

    appeared.resolve(undefined);
    await done;
    expect(hideModel).toHaveBeenCalledWith("costume-a", 200);
  });

  it("reports a rejected telop hide without blocking an otherwise synchronous layout action", async () => {
    const hide = deferred<void>();
    const logger = createLogger();
    const controller = {
      scenarioData: { LayoutData: [createLayoutData(CharacterLayoutType.ChangeDepth)] },
      logger,
      events: { emit: vi.fn() },
      layers: {
        telop: { hide: vi.fn(() => hide.promise) },
        live2d: { layout_mode: "normal" as const }
      }
    } as unknown as Live2DController;
    const error = new Error("telop hide failed");
    const result = action_layout(controller, createSnippet(SnippetAction.CharacterLayout)).then(
      () => ({ status: "fulfilled" as const }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );

    await expect(result).resolves.toEqual({ status: "fulfilled" });
    hide.reject(error);
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "Character layout telop hide failed:",
      expect.anything(),
      error
    );
  });

  it("keeps talk motions concurrent with dialog animation and logs failures without delaying the talk", async () => {
    const animation = deferred<void>();
    const show = deferred<void>();
    const motion = deferred<void>();
    const showStarted = deferred<void>();
    const motionStarted = deferred<void>();
    const { controller, layers } = createTalkController(
      createTalkData({
        Motions: [{ Character2dId: 1, MotionName: "wave", FacialName: "", TimingSyncValue: 0 }]
      })
    );
    const logger = controller.logger;
    layers.dialog.animate.mockReturnValue(animation.promise);
    layers.dialog.show.mockImplementation(() => {
      showStarted.resolve(undefined);
      return show.promise;
    });
    controller.apply_live2d_motion = vi.fn(() => {
      motionStarted.resolve(undefined);
      return motion.promise;
    });
    const error = new Error("talk motion failed");
    const outcome = action_talk(controller, createSnippet(SnippetAction.Talk)).then(
      () => ({ status: "fulfilled" as const }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );

    await showStarted.promise;
    expect(layers.dialog.animate).toHaveBeenCalledOnce();
    show.resolve(undefined);
    await motionStarted.promise;
    animation.resolve(undefined);
    await expect(outcome).resolves.toEqual({ status: "fulfilled" });
    motion.reject(error);
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "Talk motion failed:",
      expect.anything(),
      error
    );
  });

  it("waits for drawing in silent talk and propagates draw failure before showing the dialog", async () => {
    const { controller, layers } = createTalkController(createTalkData(), false);
    const error = new Error("dialog draw failed");
    layers.dialog.draw.mockRejectedValue(error);

    await expect(action_talk(controller, createSnippet(SnippetAction.Talk))).rejects.toBe(error);
    expect(layers.dialog.show).not.toHaveBeenCalled();
  });

  it.each([
    [Dialog, "Miku", ""],
    [FullScreenText, "", ""]
  ])("propagates a rejected initial draw from %p animation", async (Layer, first, second) => {
    const layer = Object.create(Layer.prototype) as InstanceType<typeof Layer>;
    const error = new Error("initial draw failed");
    vi.spyOn(layer, "draw").mockRejectedValue(error);

    await expect(layer.animate(first, second)).rejects.toBe(error);
  });

  it("keeps hologram start non-blocking and reports a failed persistent animation", async () => {
    const run = deferred<void>();
    const logger = createLogger();
    vi.spyOn(doubles.FakeHologram.prototype, "start").mockReturnValue(run.promise);
    const layer = new Live2D({
      stage_size: [1280, 720],
      logger,
      audioAdapter: {} as PixiStoryAudioAdapter
    });
    const model = new doubles.Container() as InstanceType<typeof doubles.Container> & {
      live2DInfo: { costume: string; animations: unknown[]; position: [number, number] };
      filters: InstanceType<typeof doubles.AlphaFilter>[];
      internalModel: { originalHeight: number };
    };
    model.live2DInfo = { costume: "costume-a", animations: [], position: [0.5, 0.5] };
    model.filters = [new doubles.AlphaFilter(0)];
    model.internalModel = { originalHeight: 1000 };
    layer.structure.live2d.addChild(model as never);

    expect(() => layer.add_effect("costume-a")).not.toThrow();
    expect(model.live2DInfo.animations).toHaveLength(1);
    const error = new Error("hologram start failed");
    run.reject(error);
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DPlayer",
      "Hologram animation failed for costume-a:",
      error
    );
  });

  it("returns from scene-effect draw while its abort-bound animation runs and reports rejection", async () => {
    const run = deferred<void>();
    const logger = createLogger();
    vi.spyOn(doubles.FakeAnimation.prototype, "start").mockReturnValue(run.promise);
    const layer = new SceneEffect({ stage_size: [1280, 720], logger });
    const emitter = { emit: vi.fn() };

    await expect(layer.draw("line", emitter as never)).resolves.toBeUndefined();
    expect(layer.scene_effects).toHaveLength(1);
    const error = new Error("scene animation start failed");
    run.reject(error);
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith("SceneEffects", "Animation failed for line:", error);
  });
});
