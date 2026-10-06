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

  class DisplayObject {
    alpha = 1;
    x = 0;
    y = 0;
    visible = true;
    rotation = 0;
    scale = new Point();
    anchor = new Point();
    position = new Point();
    destroyed = false;
    destroyOptions?: { children?: boolean; texture?: boolean; baseTexture?: boolean };
    parent?: Container;

    removeFromParent(): this {
      this.parent?.removeChild(this);
      return this;
    }

    destroy(options?: { children?: boolean; texture?: boolean; baseTexture?: boolean }): void {
      this.destroyed = true;
      this.destroyOptions = options;
    }
  }

  class Container extends DisplayObject {
    children: DisplayObject[] = [];
    filters: unknown[] | null = null;

    addChild<T extends DisplayObject>(...children: T[]): T {
      for (const child of children) {
        child.removeFromParent();
        child.parent = this;
        this.children.push(child);
      }
      return children[children.length - 1]!;
    }

    removeChild<T extends DisplayObject>(child: T): T {
      const index = this.children.indexOf(child);
      if (index !== -1) this.children.splice(index, 1);
      child.parent = undefined;
      return child;
    }

    removeChildren(): DisplayObject[] {
      const children = [...this.children];
      children.forEach((child) => this.removeChild(child));
      return children;
    }

    override destroy(options?: {
      children?: boolean;
      texture?: boolean;
      baseTexture?: boolean;
    }): void {
      if (options?.children) this.children.forEach((child) => child.destroy(options));
      super.destroy(options);
    }
  }

  class AlphaFilter {
    resolution = 1;

    constructor(public alpha: number) {}
  }

  class BlurFilter {
    resolution = 1;

    constructor(public strength = 2) {}
  }

  class ColorMatrixFilter {
    resolution = 1;
    matrix: number[] = [];
  }

  class TextStyle {
    [key: string]: unknown;

    constructor(options: Record<string, unknown> = {}) {
      Object.assign(this, options);
    }
  }

  class Text extends DisplayObject {
    style: TextStyle = new TextStyle();

    constructor(public text: string) {
      super();
    }

    get height(): number {
      return this.text.split("\n").length * 20;
    }
  }

  class BaseTexture {
    static from(): BaseTexture {
      return new BaseTexture();
    }
  }

  class Texture {
    destroyedWithBaseTexture?: boolean;

    constructor() {}

    destroy(destroyBaseTexture = false): void {
      this.destroyedWithBaseTexture = destroyBaseTexture;
    }
  }

  class Sprite extends DisplayObject {
    constructor(public texture: Texture) {
      super();
    }
  }

  const createMotionManager = () => ({
    startMotion: vi.fn(async () => true),
    destroyed: false,
    isFinished: vi.fn(() => true)
  });

  const internalModels: Cubism4InternalModel[] = [];
  class Cubism4InternalModel {
    coreModel = {
      setOverwriteFlagForModelCullings: vi.fn(),
      setParameterValueById: vi.fn()
    };
    motionManager = { attachAnalyzer: vi.fn() };
    parallelMotionManager = [createMotionManager(), createMotionManager()];
    originalHeight = 1000;
    extendParallelMotionManager = vi.fn();

    constructor() {
      internalModels.push(this);
    }
  }

  class Live2DModel extends Container {
    internalModel = new Cubism4InternalModel();
    stopSpeaking = vi.fn();

    static from<T extends Live2DModel>(this: new () => T): Promise<T> {
      return Promise.resolve(new this());
    }
  }

  class Hologram {
    root = new Container();
    start = vi.fn();
    destroy = vi.fn();
    set_style = vi.fn();

    constructor() {}
  }

  return {
    Cubism: { Cubism4InternalModel, Live2DModel },
    Hologram,
    Pixi: {
      AlphaFilter,
      BaseTexture,
      BlurFilter,
      ColorMatrixFilter,
      Container,
      DisplayObject,
      Sprite,
      Text,
      TextStyle,
      Texture,
      Ticker: class {
        static shared: object = {};
      }
    },
    internalModels
  };
});

vi.mock("pixi.js", () => doubles.Pixi);
vi.mock("@sekai-world/pixi-live2d-display-mulmotion/cubism4", () => ({
  ...doubles.Cubism,
  MotionPreloadStrategy: { ALL: "all" },
  MotionPriority: { FORCE: 3 }
}));
vi.mock("../animation/Hologram.js", () => ({ default: doubles.Hologram }));
vi.mock("../animation/AnimationController.js", () => ({
  default: class {
    abort = vi.fn();
    progress_wrapper = vi.fn(async (apply: (progress: number) => void) => {
      apply(0);
      apply(0.5);
      apply(1);
    });
  }
}));
vi.mock("../audio-adapter.js", () => ({ createHowlerStoryAudioAdapter: vi.fn() }));

import { AlphaFilter, BlurFilter, ColorMatrixFilter, Container, Ticker } from "pixi.js";
import type { Texture } from "pixi.js";
import type { Howl } from "howler";
import type { StoryPlayerLogger } from "../../../core/log.js";
import type AnimationController from "../animation/AnimationController.js";
import type { ILive2DModelDataCollection, ILive2DTexture } from "../player-types.js";
import type { PixiStoryAudioAdapter, PixiStoryLipSyncConnection } from "../audio-adapter.js";
import { Curve as CurveValue } from "../animation/Curve.js";
import Hologram from "../animation/Hologram.js";
import BaseLayer from "./BaseLayer.js";
import Dialog from "./Dialog.js";
import FullScreenText from "./FullScreenText.js";
import Live2D from "./Live2D.js";
import Movie from "./Movie.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

class TestLayer extends BaseLayer {
  structure: Record<string, Container | Container[]> = {};

  async draw(): Promise<void> {}

  set_style(stageSize?: [number, number]): void {
    this.stage_size = stageSize ?? this.stage_size;
  }

  measure(h: number): number {
    return this.em(h);
  }

  randomBetween(min: number, max: number): number {
    return this.random(min, max);
  }

  get shakeController(): AnimationController {
    return this.shake_animation_controller;
  }
}

const createAnimationController = () => {
  const abortController = new AbortController();
  const progressWrapper = vi.fn(async (apply: (progress: number) => void, time_ms: number) => {
    void time_ms;
    apply(0);
    apply(0.5);
    apply(1);
  });
  return {
    abort_controller: abortController,
    abort: vi.fn(() => abortController.abort()),
    reset_abort: vi.fn(),
    wrapper: vi.fn(async (step: (ticker: Ticker) => void, finish: (ticker: Ticker) => boolean) => {
      const ticker = new Ticker();
      step(ticker);
      finish(ticker);
    }),
    progress_wrapper: progressWrapper,
    delay: vi.fn(async (ms: number) => {
      void ms;
    })
  } satisfies AnimationController;
};

const createLogger = (): StoryPlayerLogger => ({ log: vi.fn(), warn: vi.fn() });

const createAudioAdapter = (
  connection: PixiStoryLipSyncConnection | null = null
): { adapter: PixiStoryAudioAdapter; getEndListener: () => (() => void) | undefined } => {
  let endListener: (() => void) | undefined;
  const adapter: PixiStoryAudioAdapter = {
    isPlaying: vi.fn(() => true),
    play: vi.fn(),
    stop: vi.fn(),
    unload: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    setLoop: vi.fn(),
    fade: vi.fn(),
    once: vi.fn((_sound, event, listener) => {
      if (event === "end") endListener = listener;
    }),
    off: vi.fn(),
    connectLipSync: vi.fn(() => connection)
  };
  return { adapter, getEndListener: () => endListener };
};

const createLive2DLayer = () => {
  const logger = createLogger();
  const audio = createAudioAdapter();
  const animationController = createAnimationController();
  const layer = new Live2D({
    stage_size: [1280, 720],
    animation_controller: animationController,
    audioAdapter: audio.adapter,
    logger
  });
  return { layer, audio, animationController, logger };
};

const loadModel = async (layer: Live2D, costume: string) => {
  const modelData = {
    cid: 17,
    costume,
    data: {
      FileReferences: {
        Moc: "model.moc3",
        Physics: "physics3.json",
        Textures: [],
        Motions: { Motion: [], Expression: [] }
      }
    }
  } satisfies ILive2DModelDataCollection;
  await layer.load(modelData);
  const model = layer.find(costume);
  if (!model) throw new Error(`Expected ${costume} to be loaded`);
  return model;
};

const createVideo = (
  overrides: Partial<{
    readyState: number;
    videoWidth: number;
    videoHeight: number;
    currentTime: number;
    play: () => Promise<void> | undefined;
  }> = {}
) => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    const eventListeners = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    eventListeners.add(listener);
    listeners.set(type, eventListeners);
  });
  const removeEventListener = vi.fn(
    (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener);
    }
  );
  const video = {
    readyState: overrides.readyState ?? 2,
    videoWidth: overrides.videoWidth ?? 1920,
    videoHeight: overrides.videoHeight ?? 1080,
    currentTime: overrides.currentTime ?? 10,
    play: vi.fn(overrides.play ?? (() => Promise.resolve())),
    pause: vi.fn(),
    addEventListener,
    removeEventListener
  } as unknown as HTMLVideoElement;

  const emit = (type: string): void => {
    const event = { type } as Event;
    for (const listener of listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
  };

  return { video, addEventListener, removeEventListener, emit, listeners };
};

describe("BaseLayer lifecycle", () => {
  it("skips redundant visibility animations unless force is requested", async () => {
    const animationController = createAnimationController();
    const layer = new TestLayer({ animation_controller: animationController });

    await layer.show(120);
    expect(animationController.progress_wrapper).not.toHaveBeenCalled();

    await layer.show(120, true);
    expect(animationController.progress_wrapper).toHaveBeenCalledOnce();
    expect(layer.root.alpha).toBe(1);

    await layer.hide(80);
    expect(animationController.progress_wrapper).toHaveBeenCalledTimes(2);
    expect(layer.root.alpha).toBe(0);

    await layer.hide(80);
    expect(animationController.progress_wrapper).toHaveBeenCalledTimes(2);
    await layer.hide(80, true);
    expect(animationController.progress_wrapper).toHaveBeenCalledTimes(3);
  });

  it("resets shake position after the animation and aborts its dedicated controller", async () => {
    const layer = new TestLayer({});
    const curveX = new CurveValue((t) => t * 4);
    const curveY = new CurveValue((t) => -t * 2);
    const curveXProgress = vi.spyOn(curveX, "p");
    const curveYProgress = vi.spyOn(curveY, "p");

    await layer.shake(curveX, curveY, 300);

    expect(curveXProgress).toHaveBeenCalledWith(0.5);
    expect(curveYProgress).toHaveBeenCalledWith(0.5);
    expect(layer.root.position.x).toBe(0);
    expect(layer.root.position.y).toBe(0);
    layer.stop_shake();
    expect(layer.shakeController.abort).toHaveBeenCalledOnce();
  });

  it("adds and removes only the requested filter types", () => {
    const layer = new TestLayer({});
    const matrixA = Array.from({ length: 20 }, (_, index) => index);
    const matrixB = matrixA.map((value) => value + 1);

    layer.add_color_filter(
      matrixA.slice(0, 5),
      matrixA.slice(5, 10),
      matrixA.slice(10, 15),
      matrixA.slice(15)
    );
    layer.add_blur(4);
    layer.add_blur(8);
    layer.add_color_filter(
      matrixB.slice(0, 5),
      matrixB.slice(5, 10),
      matrixB.slice(10, 15),
      matrixB.slice(15)
    );

    expect(layer.root.filters).toHaveLength(4);
    expect(
      layer.root.filters?.filter((filter) => filter instanceof ColorMatrixFilter)
    ).toHaveLength(2);
    expect(layer.root.filters?.filter((filter) => filter instanceof BlurFilter)).toHaveLength(2);
    const firstFilter = layer.root.filters?.[0];
    expect(firstFilter).toBeInstanceOf(ColorMatrixFilter);
    if (!(firstFilter instanceof ColorMatrixFilter))
      throw new Error("Expected the first filter to be a color matrix filter");
    expect(firstFilter.matrix).toEqual(matrixA);

    layer.remove_blur();
    expect(layer.root.filters?.filter((filter) => filter instanceof BlurFilter)).toHaveLength(0);
    expect(layer.root.filters).toHaveLength(2);
    layer.remove_filter();
    expect(layer.root.filters).toHaveLength(0);

    const emptyLayer = new TestLayer({});
    emptyLayer.remove_blur();
    emptyLayer.remove_filter();
    emptyLayer.add_blur();
    expect(emptyLayer.root.filters).toHaveLength(1);
  });

  it("uses the shorter stage dimension for em units and recursively destroys children", () => {
    const animationController = createAnimationController();
    const layer = new TestLayer({
      stage_size: [1280, 720],
      animation_controller: animationController
    });
    const child = new Container();
    const grandchild = new Container();
    const destroyChild = vi.spyOn(child, "destroy");
    child.addChild(grandchild);
    layer.root.addChild(child);

    expect(layer.measure(400)).toBe(720);
    layer.set_style([720, 1280]);
    expect(layer.measure(400)).toBe(720);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(layer.randomBetween(10, 30)).toBe(15);

    layer.destroy();

    expect(animationController.abort).toHaveBeenCalledOnce();
    expect(child.destroyed).toBe(true);
    expect(destroyChild).toHaveBeenCalledWith({
      children: true,
      texture: true,
      baseTexture: true
    });
    expect(grandchild.destroyed).toBe(true);
  });
});

describe("Dialog text lifecycle", () => {
  const textures: ILive2DTexture[] = [
    { identifier: "ui/text_background", texture: {} as Texture },
    { identifier: "ui/text_underline", texture: {} as Texture }
  ];

  it("draws translated text, replaces it, and selects compact styling for long dialogue", async () => {
    const layer = new Dialog({ stage_size: [1280, 720], textures });

    await layer.draw("Miku", "one\ntwo\nthree", "translation one\ntwo\nthree");
    expect(layer.root.children).toHaveLength(1);
    expect(layer.structure.translated_text_c?.text).toBe("translation one\ntwo\nthree");
    expect(layer.structure.text_c?.style.fontSize).toBeCloseTo(19.8);

    const oldOriginal = layer.structure.text_c;
    const oldTranslation = layer.structure.translated_text_c;
    layer.draw_new_text("updated dialogue", "updated translation");
    expect(oldOriginal?.destroyed).toBe(true);
    expect(oldTranslation?.destroyed).toBe(true);
    expect(layer.structure.text_c?.text).toBe("updated dialogue");
    expect(layer.structure.translated_text_c?.text).toBe("updated translation");

    const updatedTranslation = layer.structure.translated_text_c;
    layer.draw_new_text("without translation", null);
    expect(updatedTranslation?.destroyed).toBe(true);
    expect(layer.structure.translated_text_c).toBeUndefined();
    expect(layer.structure.text_c?.text).toBe("without translation");
  });

  it("does not update text before drawing and completes immediately when animation is aborted", async () => {
    const animationController = createAnimationController();
    const layer = new Dialog({ textures, animation_controller: animationController });

    layer.set_style([720, 1280]);
    layer.draw_new_text("ignored");
    expect(layer.structure.text_c).toBeUndefined();

    animationController.abort_controller.abort();
    await layer.animate("Miku", "finish this line", "translation");

    expect(layer.structure.text_c?.text).toBe("finish this line");
    expect(animationController.delay).toHaveBeenCalledOnce();
  });

  it("advances un-aborted dialogue one character per delay", async () => {
    const animationController = createAnimationController();
    const layer = new Dialog({ textures, animation_controller: animationController });

    await layer.animate("Rin", "abc");

    expect(layer.structure.text_c?.text).toBe("abc");
    expect(animationController.delay).toHaveBeenCalledTimes(3);
  });
});

describe("FullScreenText lifecycle", () => {
  it("styles both text tracks and removes a stale translation when text changes", async () => {
    const layer = new FullScreenText({ stage_size: [1280, 720] });

    layer.set_style([900, 600]);
    layer.draw_new_text("ignored before draw");
    expect(layer.structure.text_c).toBeUndefined();
    await layer.draw("Original caption", "Translated caption");
    layer.set_style([1280, 720]);
    expect(layer.root.children).toHaveLength(2);
    expect(layer.structure.translated_text_c?.alpha).toBe(0.8);
    expect(layer.structure.translated_text_c?.x).toBe(640);
    expect(layer.structure.text_c?.x).toBe(640);
    expect(layer.structure.text_c?.y).toBe(360);

    const previousTranslation = layer.structure.translated_text_c;
    layer.draw_new_text("New caption");
    expect(previousTranslation?.destroyed).toBe(true);
    expect(layer.structure.translated_text_c).toBeUndefined();
    expect(layer.structure.text_c?.text).toBe("New caption");
  });

  it("renders the full caption on the first tick after cancellation", async () => {
    const animationController = createAnimationController();
    animationController.abort_controller.abort();
    const layer = new FullScreenText({ animation_controller: animationController });

    await layer.animate("all at once", "translation");

    expect(layer.structure.text_c?.text).toBe("all at once");
    expect(layer.structure.translated_text_c?.text).toBe("translation");
    expect(animationController.delay).toHaveBeenCalledOnce();
  });

  it("advances text while animation remains active", async () => {
    const animationController = createAnimationController();
    const layer = new FullScreenText({ animation_controller: animationController });

    await layer.animate("abc");

    expect(layer.structure.text_c?.text).toBe("abc");
    expect(animationController.delay).toHaveBeenCalledTimes(3);
  });
});

describe("Movie resource lifecycle", () => {
  it("waits for canplay, sizes the movie to cover the stage, and cleans up after completion", async () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const { video, emit, addEventListener, removeEventListener } = createVideo({
      readyState: 1,
      videoWidth: 2560,
      videoHeight: 1080
    });
    const layer = new Movie({ stage_size: [1280, 720] });
    layer.set_style([1280, 720]);
    const drawing = layer.draw(video);

    expect(addEventListener).toHaveBeenCalledWith("canplay", expect.any(Function));
    emit("canplay");
    await drawing;
    const sprite = layer.structure.movie;
    if (!sprite) throw new Error("Expected the movie sprite to be created");
    const destroyTexture = vi.spyOn(sprite.texture, "destroy");
    expect(sprite?.scale.x).toBeCloseTo(2 / 3);
    expect(sprite?.x).toBe(640);
    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith("canplay", expect.any(Function));

    let completed = false;
    const completion = layer.waitForCompletion().then(() => {
      completed = true;
    });
    expect(completed).toBe(false);
    emit("ended");
    await completion;
    expect(completed).toBe(true);

    const staleCompletion = layer.waitForCompletion();
    layer.clear();
    expect(video.pause).toHaveBeenCalledOnce();
    expect(destroyTexture).toHaveBeenCalledWith(true);
    expect(layer.root.children).toHaveLength(0);
    const endedListenerRemovals = removeEventListener.mock.calls.filter(
      ([event]) => event === "ended"
    ).length;
    emit("ended");
    await staleCompletion;
    expect(removeEventListener.mock.calls.filter(([event]) => event === "ended")).toHaveLength(
      endedListenerRemovals
    );
    await expect(layer.waitForCompletion()).resolves.toBeUndefined();
    layer.clear();
  });

  it("uses the fit-width branch for a taller video and handles a synchronous play result", async () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const { video } = createVideo({
      videoWidth: 800,
      videoHeight: 1200,
      play: () => undefined
    });
    const layer = new Movie({ stage_size: [1600, 900] });

    await layer.draw(video);

    expect(layer.structure.movie?.scale.x).toBe(2);
    expect(layer.structure.movie?.y).toBe(450);
  });

  it("rejects failed readiness and keeps cleanup safe when no movie was created", async () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const { video, emit, removeEventListener } = createVideo({ readyState: 0 });
    const layer = new Movie({});
    const drawing = layer.draw(video);

    emit("error");
    await expect(drawing).rejects.toThrow("Video failed to load");
    expect(removeEventListener).toHaveBeenCalledWith("canplay", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    await expect(layer.waitForCompletion()).resolves.toBeUndefined();
    layer.destroy();
    expect(layer.root.children).toHaveLength(0);
  });

  it("logs texture cleanup failures without throwing from clear", async () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const { video } = createVideo();
    const logger = createLogger();
    const layer = new Movie({ logger });
    await layer.draw(video);
    const texture = layer.structure.movie?.texture;
    if (!texture) throw new Error("Expected the movie texture to be created");
    vi.spyOn(texture, "destroy").mockImplementation(() => {
      throw new Error("texture disposal failed");
    });

    expect(() => layer.clear()).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "Movie layer: Error during cleanup:",
      expect.any(Error)
    );
  });
});

describe("Live2D layer lifecycle", () => {
  it("loads a model, exposes lookup status, and selects the expected layout scale", async () => {
    const { layer, logger } = createLive2DLayer();

    expect(layer.load_status()).toBe("ready");
    await layer.draw();
    await layer.load({ cid: 17, costume: "costume-a", data: {} } as ILive2DModelDataCollection);
    const model = layer.find("costume-a");
    expect(model).toBeDefined();
    expect(layer.get_model_list()).toHaveLength(1);
    expect(layer.load_status()).toBe("loaded");
    expect(layer.find("missing")).toBeUndefined();
    expect(model?.visible).toBe(false);
    expect(model?.live2DInfo).toMatchObject({ cid: 17, costume: "costume-a" });
    expect(model?.internalModel.extendParallelMotionManager).toHaveBeenCalledWith(2);
    const internalModel = doubles.internalModels.at(-1);
    if (!internalModel) throw new Error("Expected the internal model to be initialized");
    expect(model?.internalModel).toBe(internalModel);
    expect(internalModel.coreModel.setOverwriteFlagForModelCullings).toHaveBeenCalledWith(true);
    expect(logger.log).toHaveBeenCalledWith("Live2DPlayer", "costume-a init.");

    layer.set_position("costume-a", [0.25, 0.4]);
    expect(model?.visible).toBe(true);
    expect(model?.x).toBe(320);
    expect(model?.y).toBeCloseTo(504);
    expect(model?.scale.x).toBeCloseTo(1.512);
    expect(model?.anchor.x).toBe(0.5);

    const animation = new Hologram([]);
    model?.live2DInfo.animations.push(animation);
    layer.layout_mode = "three_models";
    layer.set_style([1000, 500]);
    expect(model?.scale.x).toBeCloseTo(0.9);
    expect(animation.root.position.x).toBe(250);
    expect(animation.root.position.y).toBe(500);
    expect(animation.set_style).toHaveBeenCalledWith([1000, 500]);
    layer.set_style([800, 600], []);
    expect(model?.x).toBe(200);
    layer.set_position("missing", [0, 0]);
    await layer.move("missing", undefined, [0, 0], 50);
  });

  it("shows and hides models, including their attached animations", async () => {
    const { layer, animationController } = createLive2DLayer();
    const model = await loadModel(layer, "costume-a");
    const animation = new Hologram([]);
    model.live2DInfo.animations.push(animation);

    await layer.show_model("costume-a", 100);
    expect(model.visible).toBe(true);
    expect(model.live2DInfo.hidden).toBe(false);
    const alphaFilter = model.filters?.[0];
    expect(alphaFilter).toBeInstanceOf(AlphaFilter);
    if (!(alphaFilter instanceof AlphaFilter)) throw new Error("Expected an alpha filter");
    expect(alphaFilter.alpha).toBe(1);
    expect(animation.root.alpha).toBe(1);
    const callCount = animationController.progress_wrapper.mock.calls.length;
    await layer.show_model("costume-a", 100);
    expect(animationController.progress_wrapper).toHaveBeenCalledTimes(callCount);
    layer.set_position("costume-a", [0.25, 0.5]);
    expect(animation.root.position.x).toBe(320);
    expect(animation.root.position.y).toBe(720);
    expect(animation.set_style).toHaveBeenCalledWith([1280, 720]);

    await layer.hide_model("costume-a", 100);
    expect(model.visible).toBe(false);
    expect(model.live2DInfo.hidden).toBe(true);
    expect(alphaFilter.alpha).toBe(0);
    expect(animation.root.alpha).toBe(0);
    await layer.hide_model("missing", 100);
    await layer.show_model("missing", 100);
    layer.set_style();
  });

  it("moves from an explicit origin and updates the selected motion manager", async () => {
    const { layer, animationController } = createLive2DLayer();
    const model = await loadModel(layer, "costume-a");
    const internalModel = doubles.internalModels.at(-1);
    if (!internalModel) throw new Error("Expected the internal model to be initialized");
    const [bodyManager, faceManager] = internalModel.parallelMotionManager;

    await layer.move("costume-a", [0.1, 0.2], [0.8, 0.9], 300);
    expect(model.live2DInfo.position[0]).toBeCloseTo(0.8);
    expect(model.live2DInfo.position[1]).toBeCloseTo(0.9);
    expect(animationController.progress_wrapper).toHaveBeenCalledOnce();
    await layer.move("costume-a", [0.8, 0.9], [0.8, 0.9], 300);
    expect(animationController.progress_wrapper).toHaveBeenCalledOnce();
    animationController.progress_wrapper.mockImplementation(async (apply) => {
      apply(1);
    });
    await layer.move("costume-a", undefined, [0.4, 0.5], 300);
    expect(model.live2DInfo.position).toEqual([0.4, 0.5]);

    await layer.update_motion("Motion", "costume-a", 3);
    expect(bodyManager.startMotion).toHaveBeenCalledWith("Motion", 3, 3, false);
    expect(faceManager.startMotion).not.toHaveBeenCalled();
    expect(model.live2DInfo.t_pose).toBe(false);

    model.live2DInfo.t_pose = true;
    await layer.update_motion("Expression", "costume-a", 2, true);
    expect(faceManager.startMotion).toHaveBeenCalledWith("Expression", 2, 3, true);
    expect(internalModel.coreModel.setParameterValueById).toHaveBeenCalledWith(
      "ParamMouthOpenY",
      0,
      1
    );
    expect(faceManager.isFinished).toHaveBeenCalledOnce();
    bodyManager.isFinished.mockClear();
    bodyManager.destroyed = true;
    await layer.update_motion("Motion", "costume-a", 4);
    expect(bodyManager.isFinished).not.toHaveBeenCalled();
    await layer.update_motion("Motion", "missing", 0);
  });

  it("connects lip sync and clears the active talk when the sound ends", async () => {
    const disconnect = vi.fn();
    const connection = {
      analyser: {} as AnalyserNode,
      disconnect
    } satisfies PixiStoryLipSyncConnection;
    const audio = createAudioAdapter(connection);
    const layer = new Live2D({ stage_size: [1280, 720], audioAdapter: audio.adapter });
    const model = await loadModel(layer, "costume-a");
    const sound = {} as Howl;

    layer.speak(["missing", "costume-a"], sound, 0.65);

    expect(audio.adapter.connectLipSync).toHaveBeenCalledWith(sound);
    expect(model.internalModel.motionManager.attachAnalyzer).toHaveBeenCalledWith(
      connection.analyser
    );
    const internalModel = doubles.internalModels.at(-1);
    if (!internalModel) throw new Error("Expected the internal model to be initialized");
    expect(internalModel.coreModel.setParameterValueById).toHaveBeenCalledWith(
      "ParamMouthOpenY",
      0,
      1
    );
    expect(model.live2DInfo.speaking).toBe(true);
    expect(audio.adapter.setVolume).toHaveBeenCalledWith(sound, 0.65);
    expect(audio.adapter.play).toHaveBeenCalledWith(sound);
    expect(audio.getEndListener()).toBeDefined();

    audio.getEndListener()?.();

    expect(disconnect).toHaveBeenCalledOnce();
    expect(model.stopSpeaking).toHaveBeenCalledOnce();
    expect(model.live2DInfo.speaking).toBe(false);
    expect(layer.current_sound).toBeUndefined();

    layer.speak(["costume-a"], sound, 0.2);
    layer.stop_speaking();
    expect(audio.adapter.off).toHaveBeenCalledWith(sound, "end");
    expect(audio.adapter.stop).toHaveBeenCalledWith(sound);
    expect(model.stopSpeaking).toHaveBeenCalledTimes(2);
  });

  it("plays audio without lip sync when the adapter cannot create a connection", async () => {
    const audio = createAudioAdapter(null);
    const layer = new Live2D({ stage_size: [1280, 720], audioAdapter: audio.adapter });
    const model = await loadModel(layer, "costume-a");
    const sound = {} as Howl;

    layer.speak(["costume-a"], sound, 0.3);

    expect(audio.adapter.connectLipSync).toHaveBeenCalledWith(sound);
    expect(audio.adapter.setVolume).toHaveBeenCalledWith(sound, 0.3);
    expect(audio.adapter.play).toHaveBeenCalledWith(sound);
    expect(model.live2DInfo.speaking).toBe(false);
    audio.getEndListener()?.();
    expect(layer.current_sound).toBeUndefined();
    expect(model.stopSpeaking).not.toHaveBeenCalled();
  });

  it("does not start audio when no requested costume is loaded and clears effects and models", async () => {
    const { layer, audio, logger } = createLive2DLayer();
    layer.speak(["not-loaded"], {} as Howl, 0.4);
    expect(audio.adapter.connectLipSync).not.toHaveBeenCalled();

    const model = await loadModel(layer, "costume-a");
    layer.add_effect("costume-a");
    expect(model.live2DInfo.animations).toHaveLength(1);
    expect(layer.structure.effect.children).toHaveLength(1);
    const effectAnimation = model.live2DInfo.animations[0];
    expect(effectAnimation?.root).toBe(layer.structure.effect.children[0]);
    expect(effectAnimation?.root.alpha).toBe(0);
    layer.remove_effect("costume-a");
    expect(model.live2DInfo.animations).toHaveLength(0);
    expect(model.filters).toHaveLength(1);
    expect(effectAnimation?.destroy).toHaveBeenCalledOnce();
    layer.remove_effect("costume-a");
    layer.add_effect("missing");

    layer.clear();
    expect(model.destroyed).toBe(true);
    expect(logger.log).toHaveBeenCalledWith("Live2DPlayer", "live2d stage clear.");
    layer.destroy();
  });
});
