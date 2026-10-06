import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseTexture, Container, Texture } from "pixi.js";
import type { ILive2DTexture } from "../player-types.js";
import AnimationController from "./AnimationController.js";
import BaseAnimation from "./BaseAnimation.js";
import Blackout from "./Blackout.js";
import { Curve } from "./Curve.js";
import Hologram from "./Hologram.js";
import Kirakira from "./Kirakira.js";
import Lightup from "./Lightup.js";
import LightupLegend from "./LightupLegend.js";
import Line from "./Line.js";
import LineLegend from "./LineLegend.js";
import Sekai from "./Sekai.js";
import { linear_gradient, texture_slice } from "./utils.js";

const pixiDoubles = vi.hoisted(() => {
  type DestroyOptions = { children?: boolean; texture?: boolean; baseTexture?: boolean };
  type GraphicsOperation = { name: string; args: unknown[] };

  class Point {
    x: number;
    y: number;

    constructor(x = 0, y = x) {
      this.x = x;
      this.y = y;
    }

    set(x = 0, y = x) {
      this.x = x;
      this.y = y;
    }
  }

  class DisplayObject {
    position = new Point();
    scale = new Point(1, 1);
    anchor = new Point();
    alpha = 1;
    angle = 0;
    rotation = 0;
    filters: unknown[] | null = null;
    children: DisplayObject[] | undefined;
    parent: DisplayObject | null = null;
    destroyed = false;
    destroyOptions: DestroyOptions | undefined;

    destroy(options?: DestroyOptions) {
      this.destroyed = true;
      this.destroyOptions = options;
      destroyedObjects.push(this);
      if (this.children) {
        const children = this.children.splice(0);
        children.forEach((child) => {
          child.parent = null;
          if (options?.children) child.destroy(options);
        });
      }
    }
  }

  const destroyedObjects: DisplayObject[] = [];

  class Container extends DisplayObject {
    override children: DisplayObject[] = [];

    addChild<T extends DisplayObject>(child: T) {
      this.children.push(child);
      child.parent = this;
      return child;
    }
  }

  const graphics: Graphics[] = [];
  class Graphics extends DisplayObject {
    operations: GraphicsOperation[] = [];

    constructor() {
      super();
      graphics.push(this);
    }

    private record(name: string, ...args: unknown[]) {
      this.operations.push({ name, args });
      return this;
    }

    clear() {
      return this.record("clear");
    }

    beginFill(color: number, alpha?: number) {
      return this.record("beginFill", color, ...(alpha === undefined ? [] : [alpha]));
    }

    drawRect(x: number, y: number, width: number, height: number) {
      return this.record("drawRect", x, y, width, height);
    }

    moveTo(x: number, y: number) {
      return this.record("moveTo", x, y);
    }

    lineTo(x: number, y: number) {
      return this.record("lineTo", x, y);
    }

    closePath() {
      return this.record("closePath");
    }

    endFill() {
      return this.record("endFill");
    }
  }

  class Rectangle {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number
    ) {}
  }

  class BaseTexture {
    readonly realWidth: number;
    readonly realHeight: number;

    constructor(options: { width?: number; height?: number } = {}) {
      this.realWidth = options.width ?? 256;
      this.realHeight = options.height ?? 256;
    }
  }

  const textures: Texture[] = [];
  class Texture {
    readonly baseTexture: BaseTexture;
    readonly frame: Rectangle | undefined;
    readonly source: unknown;

    constructor(baseTexture?: BaseTexture, frame?: Rectangle, source: unknown = null) {
      this.baseTexture = baseTexture ?? new BaseTexture();
      this.frame = frame;
      this.source = source;
      textures.push(this);
    }

    static from(source: unknown) {
      return new Texture(undefined, undefined, source);
    }
  }

  const sprites: Sprite[] = [];
  class Sprite extends DisplayObject {
    constructor(public texture: Texture) {
      super();
      sprites.push(this);
    }
  }

  const blurFilters: BlurFilter[] = [];
  class BlurFilter {
    resolution = 1;

    constructor(public blur = 0) {
      blurFilters.push(this);
    }
  }

  const colorMatrixFilters: ColorMatrixFilter[] = [];
  class ColorMatrixFilter {
    matrix: number[] = [];
    resolution = 1;

    constructor() {
      colorMatrixFilters.push(this);
    }
  }

  type TickerRecord = {
    elapsedMS: number;
    started: boolean;
    destroyed: boolean;
    add(callback: () => void): void;
    start(): void;
    destroy(): void;
    tick(elapsedMS: number): void;
  };

  const tickers: TickerRecord[] = [];
  class Ticker implements TickerRecord {
    elapsedMS = 0;
    started = false;
    destroyed = false;
    private callback: (() => void) | undefined;

    constructor() {
      tickers.push(this);
    }

    add(callback: () => void) {
      this.callback = callback;
    }

    start() {
      this.started = true;
    }

    destroy() {
      this.destroyed = true;
      this.callback = undefined;
    }

    tick(elapsedMS: number) {
      if (!this.started || this.destroyed) return;
      this.elapsedMS = elapsedMS;
      this.callback?.();
    }
  }

  return {
    BaseTexture,
    BlurFilter,
    ColorMatrixFilter,
    Container,
    DisplayObject,
    Graphics,
    Rectangle,
    Sprite,
    Texture,
    Ticker,
    blurFilters,
    colorMatrixFilters,
    destroyedObjects,
    graphics,
    sprites,
    textures,
    tickers
  };
});

vi.mock("pixi.js", () => ({
  BaseTexture: pixiDoubles.BaseTexture,
  BlurFilter: pixiDoubles.BlurFilter,
  ColorMatrixFilter: pixiDoubles.ColorMatrixFilter,
  Container: pixiDoubles.Container,
  DisplayObject: pixiDoubles.DisplayObject,
  Graphics: pixiDoubles.Graphics,
  Rectangle: pixiDoubles.Rectangle,
  Sprite: pixiDoubles.Sprite,
  Texture: pixiDoubles.Texture,
  Ticker: pixiDoubles.Ticker
}));

const gradientStops: Array<{ stop: number; color: string }> = [];
const gradient = {
  addColorStop(stop: number, color: string) {
    gradientStops.push({ stop, color });
  }
};
const canvasContext = {
  createLinearGradient: vi.fn(() => gradient),
  fillStyle: null as unknown,
  fillRect: vi.fn()
};
const canvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => canvasContext)
};

beforeEach(() => {
  pixiDoubles.blurFilters.length = 0;
  pixiDoubles.colorMatrixFilters.length = 0;
  pixiDoubles.destroyedObjects.length = 0;
  pixiDoubles.graphics.length = 0;
  pixiDoubles.sprites.length = 0;
  pixiDoubles.textures.length = 0;
  pixiDoubles.tickers.length = 0;
  gradientStops.length = 0;
  canvas.width = 0;
  canvas.height = 0;
  canvasContext.createLinearGradient.mockClear();
  canvasContext.fillRect.mockClear();
  canvas.getContext.mockClear();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("document", {
    createElement: vi.fn(() => canvas)
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function valueAt<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`No value at index ${index}`);
  return value;
}

function latestTicker() {
  return valueAt(pixiDoubles.tickers, pixiDoubles.tickers.length - 1);
}

function spriteAt(
  container: { children: readonly unknown[] },
  index: number
): InstanceType<typeof pixiDoubles.Sprite> {
  const displayObject = container.children[index];
  if (!(displayObject instanceof pixiDoubles.Sprite)) {
    throw new Error(`Child ${index} is not a Sprite`);
  }
  return displayObject;
}

function containerAt(
  container: { children: readonly unknown[] },
  index: number
): InstanceType<typeof pixiDoubles.Container> {
  const displayObject = container.children[index];
  if (!(displayObject instanceof pixiDoubles.Container)) {
    throw new Error(`Child ${index} is not a Container`);
  }
  return displayObject;
}

function texture(identifier: string, width = 1024, height = 1024): ILive2DTexture {
  const baseTexture = new BaseTexture({ width, height });
  return { identifier, texture: new Texture(baseTexture) };
}

async function stopAnimation(animation: BaseAnimation, running: Promise<void>) {
  animation.controller.abort();
  latestTicker().tick(0);
  await running;
  animation.destroy();
}

class ProbeAnimation extends BaseAnimation {
  protected override structure: Record<string, never> = {};
  readonly curveTarget = new Container();
  readonly functionTarget = new Container();
  readonly styleTarget = new Container();

  constructor(loop = true, period = 1000) {
    super({ stage_size: [800, 400] });
    this.loop = loop;
    this.period_ms = period;
    this.root.addChild(this.curveTarget);
    this.root.addChild(this.functionTarget);
    this.root.addChild(this.styleTarget);
    this.settings.push({
      obj: this.curveTarget,
      x_curve: new Curve().map_range(0.1, 0.9),
      y_curve: new Curve().map_range(0.2, 0.8),
      scale_curve: new Curve().map_range(1, 3),
      scale_x_curve: new Curve().map_range(2, 4),
      scale_y_curve: new Curve().map_range(3, 5),
      angle_curve: new Curve().map_range(0, 360),
      alpha_curve: new Curve()
    });
    this.settings.push({
      obj: this.functionTarget,
      x_func: (t) => 10 + t * 100,
      y_func: (t) => 20 + t * 200,
      scale_func: (t) => 1 + t,
      scale_x_func: (t) => 2 + t,
      scale_y_func: (t) => 3 + t,
      angle_func: (t) => 90 * t,
      alpha_func: (t) => t
    });
    this.settings.push({
      obj: this.styleTarget,
      x: () => 0,
      y: () => 0,
      scale: () => 2,
      scale_x: () => 3,
      scale_y: () => 4,
      angle: () => 0,
      alpha: () => 0
    });
  }
}

describe("animation utilities", () => {
  it("slices a texture in row-major order and stops at the requested count", () => {
    const source = new BaseTexture({ width: 400, height: 200 });
    const firstTen = texture_slice(source, [4, 4], 10);

    expect(firstTen).toHaveLength(10);
    expect(firstTen[0]?.frame).toMatchObject({ x: 0, y: 0, width: 100, height: 50 });
    expect(firstTen[9]?.frame).toMatchObject({ x: 100, y: 100, width: 100, height: 50 });
    expect(texture_slice(source, [4, 4])).toHaveLength(16);
    expect(texture_slice(source, [4, 4], 0)).toHaveLength(16);
  });

  it("builds a canvas gradient and wraps the canvas in a Pixi texture", () => {
    linear_gradient([
      { stop: 0, color: "rgba(255, 0, 0, 0)" },
      { stop: 1, color: "rgba(255, 0, 0, 0.5)" }
    ]);

    expect(canvas.width).toBe(256);
    expect(canvas.height).toBe(1);
    expect(canvasContext.createLinearGradient).toHaveBeenCalledWith(0, 0, 256, 0);
    expect(gradientStops).toEqual([
      { stop: 0, color: "rgba(255, 0, 0, 0)" },
      { stop: 1, color: "rgba(255, 0, 0, 0.5)" }
    ]);
    expect(canvasContext.fillRect).toHaveBeenCalledWith(0, 0, 256, 1);
    expect(valueAt(pixiDoubles.textures, 0).source).toBe(canvas);
  });
});

describe("BaseAnimation lifecycle", () => {
  it("applies style callbacks and advances curves and functions on a looping ticker", async () => {
    const animation = new ProbeAnimation();
    animation.set_style([800, 400]);

    expect(animation.styleTarget.position.x).toBe(0);
    expect(animation.styleTarget.position.y).toBe(0);
    expect(animation.styleTarget.scale.x).toBe(3);
    expect(animation.styleTarget.scale.y).toBe(4);
    expect(animation.styleTarget.angle).toBe(0);
    expect(animation.styleTarget.alpha).toBe(0);

    const running = animation.start();
    const ticker = latestTicker();
    expect(ticker.started).toBe(true);
    ticker.tick(250);

    expect(animation.curveTarget.position.x).toBeCloseTo(240);
    expect(animation.curveTarget.position.y).toBeCloseTo(140);
    expect(animation.curveTarget.scale.x).toBeCloseTo(2.5);
    expect(animation.curveTarget.scale.y).toBeCloseTo(3.5);
    expect(animation.curveTarget.angle).toBeCloseTo(90);
    expect(animation.curveTarget.alpha).toBeCloseTo(0.25);
    expect(animation.functionTarget.position.x).toBeCloseTo(35);
    expect(animation.functionTarget.position.y).toBeCloseTo(70);
    expect(animation.functionTarget.scale.x).toBeCloseTo(2.25);
    expect(animation.functionTarget.scale.y).toBeCloseTo(3.25);
    expect(animation.functionTarget.angle).toBeCloseTo(22.5);
    expect(animation.functionTarget.alpha).toBeCloseTo(0.25);

    ticker.tick(1000);
    expect(animation.curveTarget.position.x).toBeCloseTo(240);
    expect(ticker.destroyed).toBe(false);
    await stopAnimation(animation, running);

    expect(ticker.destroyed).toBe(true);
    expect(pixiDoubles.destroyedObjects).toContain(animation.root);
    expect(animation.root.children).toHaveLength(0);
  });

  it("waits past the exact finite duration, clamps progress, then releases its ticker", async () => {
    const animation = new ProbeAnimation(false, 1000);
    const running = animation.start();
    const ticker = latestTicker();
    let resolved = false;
    void running.then(() => {
      resolved = true;
    });

    ticker.tick(500);
    expect(animation.functionTarget.alpha).toBeCloseTo(0.5);
    ticker.tick(500);
    await Promise.resolve();
    expect(ticker.destroyed).toBe(false);
    expect(resolved).toBe(false);
    expect(animation.functionTarget.alpha).toBe(1);

    ticker.tick(1);
    await running;
    expect(ticker.destroyed).toBe(true);
    expect(resolved).toBe(true);
    expect(animation.functionTarget.alpha).toBe(1);
    animation.destroy();
  });

  it("finishes a finite animation immediately when its controller aborts", async () => {
    const animation = new ProbeAnimation(false, 1000);
    await animation.draw();
    const running = animation.start();
    const ticker = latestTicker();

    animation.controller.abort();
    ticker.tick(10);
    await running;

    expect(ticker.destroyed).toBe(true);
    animation.destroy();
  });

  it("honors an externally supplied abort signal without replacing its own controller", async () => {
    const animation = new ProbeAnimation();
    const externalController = new AbortController();
    const running = animation.start(externalController);
    const ticker = latestTicker();

    animation.controller.abort();
    ticker.tick(100);
    expect(animation.functionTarget.alpha).toBeCloseTo(0.1);
    expect(ticker.destroyed).toBe(false);

    externalController.abort();
    ticker.tick(0);
    await running;
    expect(ticker.destroyed).toBe(true);
    animation.destroy();
  });
});

describe("AnimationController lifecycle", () => {
  it("resets an aborted controller and resolves wrappers on finish or abort", async () => {
    const controller = new AnimationController();
    const original = controller.abort_controller;
    controller.reset_abort();
    expect(controller.abort_controller).toBe(original);
    controller.abort();
    expect(original.signal.aborted).toBe(true);
    await controller.wrapper(
      () => {},
      () => false
    );
    expect(pixiDoubles.tickers).toHaveLength(0);

    controller.reset_abort();
    expect(controller.abort_controller).not.toBe(original);
    expect(controller.abort_controller.signal.aborted).toBe(false);
    const elapsed: number[] = [];
    const finished = controller.wrapper(
      (ticker) => elapsed.push(ticker.elapsedMS),
      (ticker) => ticker.elapsedMS >= 80
    );
    const finishingTicker = latestTicker();
    finishingTicker.tick(40);
    finishingTicker.tick(80);
    await finished;
    expect(elapsed).toEqual([40, 80]);
    expect(finishingTicker.destroyed).toBe(true);

    controller.abort();
    controller.reset_abort();
    const aborted = controller.wrapper(
      () => {},
      () => false
    );
    const abortedTicker = latestTicker();
    controller.abort();
    await aborted;
    expect(abortedTicker.destroyed).toBe(true);
  });

  it("emits progress endpoints for short and ticker-driven transitions", async () => {
    const controller = new AnimationController();
    const shortProgress: number[] = [];
    await controller.progress_wrapper((progress) => shortProgress.push(progress), 29);
    expect(shortProgress).toEqual([0, 1]);
    expect(pixiDoubles.tickers).toHaveLength(0);

    const progress: number[] = [];
    const running = controller.progress_wrapper((value) => progress.push(value), 40);
    const ticker = latestTicker();
    expect(progress).toEqual([0]);
    ticker.tick(20);
    ticker.tick(20);
    await running;

    expect(progress).toEqual([0, 0.5, 1, 1]);
    expect(ticker.destroyed).toBe(true);
  });

  it("resolves delays on elapsed time and abort while cancelling pending timers", async () => {
    vi.useFakeTimers();
    const controller = new AnimationController();
    const completed = controller.delay(40);
    await vi.advanceTimersByTimeAsync(40);
    await completed;
    expect(vi.getTimerCount()).toBe(0);

    controller.abort();
    controller.reset_abort();
    const aborted = controller.delay(100);
    controller.abort();
    await aborted;
    expect(vi.getTimerCount()).toBe(0);

    await controller.delay(100);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("concrete animation geometry and lifecycle", () => {
  it("sizes Blackout coverage to each stage and destroys its display root", () => {
    const animation = new Blackout(0.35);
    const graphic = valueAt(pixiDoubles.graphics, 0);
    const fill = graphic.operations.find((operation) => operation.name === "beginFill");
    const rectangle = graphic.operations.find((operation) => operation.name === "drawRect");

    expect(fill?.args).toEqual([0x000000, 0.35]);
    expect(rectangle?.args).toEqual([0, 0, 2000, 2000]);
    animation.set_style([800, 400]);
    expect(graphic.scale.x).toBeCloseTo(0.4);
    expect(graphic.scale.y).toBeCloseTo(0.2);
    animation.set_style([1600, 900]);
    expect(graphic.scale.x).toBeCloseTo(0.8);
    expect(graphic.scale.y).toBeCloseTo(0.45);

    animation.destroy();
    expect(pixiDoubles.destroyedObjects).toContain(animation.root);
    expect(animation.root.children).toHaveLength(0);
  });

  it("draws and animates Line rays while retaining its blur filter", async () => {
    const animation = new Line(0x123456);
    animation.set_style([800, 400]);
    const graphic = valueAt(pixiDoubles.graphics, 0);
    const fill = graphic.operations.find((operation) => operation.name === "beginFill");

    expect(animation.root.filters).toHaveLength(1);
    expect(valueAt(pixiDoubles.blurFilters, 0)).toMatchObject({ blur: 2, resolution: 2 });
    expect(fill?.args).toEqual([0x123456]);
    expect(graphic.operations).toContainEqual({ name: "lineTo", args: [-7, 300] });
    expect(graphic.operations).toContainEqual({ name: "lineTo", args: [7, 300] });
    expect(graphic.position.x).toBeCloseTo(400);
    expect(graphic.position.y).toBeCloseTo(50);
    expect(graphic.alpha).toBe(0);

    const running = animation.start();
    const ticker = latestTicker();
    ticker.tick(200);
    expect(graphic.alpha).toBeCloseTo(0.8);
    await stopAnimation(animation, running);
    expect(ticker.destroyed).toBe(true);
  });

  it.each([
    { direction: "up", angle: 0, x: 300, y: -37.5 },
    { direction: "down", angle: 180, x: 300, y: 337.5 },
    { direction: "left", angle: 270, x: -75, y: 150 },
    { direction: "right", angle: 90, x: 675, y: 150 }
  ])("moves LineLegend rays toward the $direction edge", async ({ direction, angle, x, y }) => {
    const animation = new LineLegend(direction, 0xaabbcc, 0x112233);
    animation.set_style([600, 300]);
    const graphic = valueAt(pixiDoubles.graphics, 0);
    expect(graphic.angle).toBe(angle);
    expect(animation.root.filters).toHaveLength(1);

    const running = animation.start();
    const ticker = latestTicker();
    ticker.tick(100);
    expect(graphic.position.x).toBeCloseTo(x);
    expect(graphic.position.y).toBeCloseTo(y);
    await stopAnimation(animation, running);
  });

  it("uses LineLegend's alternate color when its style randomizer selects it", () => {
    const animation = new LineLegend("up", 0xaabbcc, 0x112233);
    vi.mocked(Math.random).mockReturnValue(0.1);
    animation.set_style([600, 300]);

    const fill = valueAt(pixiDoubles.graphics, 0).operations.find(
      (operation) => operation.name === "beginFill"
    );
    expect(fill?.args).toEqual([0x112233]);
  });

  it("leaves unsupported LineLegend directions stationary instead of failing", async () => {
    const animation = new LineLegend("diagonal", 0xaabbcc);
    animation.set_style([600, 300]);
    const graphic = valueAt(pixiDoubles.graphics, 0);
    const running = animation.start();
    const ticker = latestTicker();
    ticker.tick(100);

    expect(graphic.position.x).toBe(0);
    expect(graphic.position.y).toBe(0);
    await stopAnimation(animation, running);
  });

  it("applies Hologram layers, filters, resize style, and mid-cycle motion", async () => {
    const animation = new Hologram([
      texture("ui/tex_scenario_light"),
      texture("ui/tex_scenario_tri_01"),
      texture("ui/tex_scenario_kira")
    ]);
    animation.set_style([800, 400]);

    expect(animation.root.children).toHaveLength(4);
    const sparkle = containerAt(animation.root, 0);
    const triangles = containerAt(animation.root, 1);
    const lightOne = containerAt(animation.root, 2);
    const lightTwo = containerAt(animation.root, 3);
    expect(sparkle.children).toHaveLength(3);
    expect(triangles.children).toHaveLength(8);
    expect(lightOne.children).toHaveLength(1);
    expect(lightTwo.children).toHaveLength(1);
    expect(valueAt(pixiDoubles.colorMatrixFilters, 0).matrix).toEqual([
      0.9, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0
    ]);
    expect(spriteAt(lightOne, 0).position.y).toBe(100);
    expect(spriteAt(lightOne, 0).scale.x).toBeCloseTo(600 / 256);

    const running = animation.start();
    const ticker = latestTicker();
    ticker.tick(2000);
    expect(lightOne.scale.x).toBeCloseTo(1.05);
    expect(lightOne.scale.y).toBeCloseTo(1.05);
    expect(lightOne.alpha).toBeCloseTo(0.8);
    expect(spriteAt(triangles, 0).position.x).toBeCloseTo(-110);
    expect(spriteAt(triangles, 0).position.y).toBeCloseTo(-100);
    expect(spriteAt(triangles, 0).angle).toBeCloseTo(90);
    expect(spriteAt(triangles, 0).alpha).toBeCloseTo(0.4);
    await stopAnimation(animation, running);
  });

  it.each([
    { fogType: "center", x: 80 },
    { fogType: "corner", x: 40 }
  ])("resizes LightupLegend fog positions for $fogType layouts", async ({ fogType, x }) => {
    const animation = new LightupLegend([texture("ui/tex_light_up_legend")], fogType);
    animation.set_style([800, 400]);

    expect(animation.root.children).toHaveLength(7);
    const cameraLight = spriteAt(animation.root, 5);
    const cameraLightTwo = spriteAt(animation.root, 6);
    expect(cameraLight.scale.x).toBeCloseTo(1.09375);
    expect(cameraLightTwo.position.x).toBe(480);
    expect(cameraLightTwo.position.y).toBe(80);

    const running = animation.start();
    const ticker = latestTicker();
    ticker.tick(0);
    const firstFog = spriteAt(animation.root, 0);
    expect(firstFog.position.x).toBeCloseTo(x);
    expect(firstFog.position.y).toBe(400);
    expect(firstFog.alpha).toBe(0);
    await stopAnimation(animation, running);
  });

  it.each([
    { movingType: "still", childCount: 60, movingIndex: 0, startX: 400, middleX: 370 },
    { movingType: "outward", childCount: 90, movingIndex: 60, startX: 400, middleX: 80 },
    { movingType: "inward", childCount: 90, movingIndex: 60, startX: 80, middleX: 400 }
  ])("moves Kirakira $movingType sprites along the selected path", async (scenario) => {
    const animation = new Kirakira([texture("ui/tex_kirakira_01")], scenario.movingType);
    animation.set_style([800, 400]);
    expect(animation.root.children).toHaveLength(scenario.childCount);

    const animatedSprite = spriteAt(animation.root, scenario.movingIndex);
    const running = animation.start();
    const ticker = latestTicker();
    ticker.tick(0);
    expect(animatedSprite.position.x).toBeCloseTo(scenario.startX);
    expect(spriteAt(animation.root, 0).alpha).toBe(0);
    ticker.tick(5000);
    expect(animatedSprite.position.x).toBeCloseTo(scenario.middleX);
    expect(spriteAt(animation.root, 0).alpha).toBe(1);
    await stopAnimation(animation, running);
  });

  it("creates and animates the firework Lightup gradient while steady light stays opaque", async () => {
    const firework = new Lightup("255, 0, 0", "firework");
    firework.set_style([800, 400]);
    const fireworkSprite = valueAt(pixiDoubles.sprites, 0);
    expect(fireworkSprite.angle).toBe(90);
    expect(fireworkSprite.position.x).toBe(800);
    expect(fireworkSprite.position.y).toBe(200);
    expect(fireworkSprite.scale.x).toBeCloseTo(0.78125);
    expect(fireworkSprite.scale.y).toBe(800);
    expect(valueAt(pixiDoubles.textures, 0).source).toBe(canvas);

    const running = firework.start();
    const ticker = latestTicker();
    ticker.tick(0);
    expect(fireworkSprite.alpha).toBeCloseTo(0.85);
    ticker.tick(300);
    expect(fireworkSprite.alpha).toBe(1);
    ticker.tick(300);
    expect(fireworkSprite.alpha).toBeCloseTo(0.85);
    await stopAnimation(firework, running);

    const steady = new Lightup("0, 0, 255", "steady");
    steady.set_style([800, 400]);
    expect(valueAt(pixiDoubles.sprites, 1).alpha).toBe(1);
  });

  it.each(["out_corner", "in_corner", "out_center", "in_center"] as const)(
    "runs Sekai %s from its origin through the exact end boundary and completion",
    async (condition) => {
      const animation = new Sekai([texture("ui/tex_scenario_tri_01")], 1000, condition);
      animation.set_style([800, 400]);
      expect(animation.root.children).toHaveLength(60);
      expect(pixiDoubles.colorMatrixFilters).toHaveLength(10);
      const firstTriangle = spriteAt(animation.root, 0);
      expect(firstTriangle.scale.x).toBeCloseTo(57.5 / 128);

      const running = animation.start();
      const ticker = latestTicker();
      let resolved = false;
      void running.then(() => {
        resolved = true;
      });

      ticker.tick(0);
      const startX = firstTriangle.position.x;
      ticker.tick(500);
      expect(Number.isFinite(firstTriangle.position.x)).toBe(true);
      expect(firstTriangle.position.x).not.toBe(startX);
      if (condition.endsWith("center")) {
        expect(firstTriangle.position.x).toBeGreaterThan(400);
      } else {
        expect(firstTriangle.position.x).toBeLessThan(400);
      }
      expect(firstTriangle.alpha).toBe(1);

      ticker.tick(500);
      await Promise.resolve();
      expect(ticker.destroyed).toBe(false);
      expect(resolved).toBe(false);
      expect(firstTriangle.alpha).toBe(0);

      ticker.tick(1);
      await running;
      expect(ticker.destroyed).toBe(true);
      expect(resolved).toBe(true);
      animation.destroy();
    }
  );
});
