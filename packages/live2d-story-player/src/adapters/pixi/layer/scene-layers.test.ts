import { beforeEach, describe, expect, it, vi } from "vitest";

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
    angle = 0;
    scale = new Point();
    anchor = new Point();
    position = new Point();
    parent?: Container;
    destroyed = false;

    destroy(options?: { children?: boolean; texture?: boolean; baseTexture?: boolean }): void {
      this.destroyed = true;
      if (options?.children && this instanceof Container)
        this.children.forEach((child) => child.destroy(options));
    }
  }

  class Container extends DisplayObject {
    children: DisplayObject[] = [];
    filters: unknown[] | null = null;

    addChild<T extends DisplayObject>(...children: T[]): T {
      for (const child of children) {
        child.parent?.removeChild(child);
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
  }

  class Texture {
    width = 1000;
    height = 1000;

    static from(source: unknown): Texture {
      const texture = new Texture();
      if (source && typeof source === "object") {
        const image = source as { width?: number; height?: number };
        texture.width = image.width ?? texture.width;
        texture.height = image.height ?? texture.height;
      }
      return texture;
    }
  }

  class Sprite extends DisplayObject {
    constructor(public texture: Texture) {
      super();
    }

    get width(): number {
      return this.texture.width * this.scale.x;
    }

    get height(): number {
      return this.texture.height * this.scale.y;
    }
  }

  class Graphics extends DisplayObject {
    fillCalls: unknown[][] = [];
    rects: number[][] = [];
    clearCount = 0;

    beginFill(...args: unknown[]): this {
      this.fillCalls.push(args);
      return this;
    }

    drawRect(...args: number[]): this {
      this.rects.push(args);
      return this;
    }

    endFill(): this {
      return this;
    }

    clear(): this {
      this.clearCount++;
      this.rects = [];
      this.fillCalls = [];
      return this;
    }
  }

  class TextStyle {
    [key: string]: unknown;

    constructor(options: Record<string, unknown> = {}) {
      Object.assign(this, options);
    }
  }

  class Text extends DisplayObject {
    style = new TextStyle();

    constructor(public text: string) {
      super();
    }

    get width(): number {
      return this.text.length * 10;
    }

    get height(): number {
      return this.text.split("\n").length * 20;
    }
  }

  class BlurFilter {
    resolution = 1;

    constructor(public strength = 2) {}
  }

  class ColorMatrixFilter {
    resolution = 1;
    matrix: number[] = [];
  }

  const animationInstances: { kind: string; args: unknown[]; instance: FakeAnimation }[] = [];
  class FakeAnimation {
    root = new Container();
    set_style = vi.fn();
    start = vi.fn();
    destroy = vi.fn();

    constructor(
      public kind: string,
      public args: unknown[]
    ) {
      animationInstances.push({ kind, args, instance: this });
    }
  }

  const makeAnimation = (kind: string) =>
    class extends FakeAnimation {
      constructor(...args: unknown[]) {
        super(kind, args);
      }
    };

  const animationTypes = {
    Line: makeAnimation("Line"),
    LineLegend: makeAnimation("LineLegend"),
    Kirakira: makeAnimation("Kirakira"),
    Blackout: makeAnimation("Blackout"),
    Lightup: makeAnimation("Lightup"),
    LightupLegend: makeAnimation("LightupLegend")
  };

  const sekaiInstances: FakeSekai[] = [];
  class FakeSekai {
    root = new Container();
    set_style = vi.fn();
    start = vi.fn(async () => {});
    destroy = vi.fn();

    constructor(
      public textures: unknown[],
      public duration: number,
      public condition: string
    ) {
      sekaiInstances.push(this);
    }
  }

  return {
    animationInstances,
    animationTypes,
    FakeAnimation,
    FakeSekai,
    Pixi: {
      BlurFilter,
      ColorMatrixFilter,
      Container,
      DisplayObject,
      Graphics,
      Sprite,
      Text,
      TextStyle,
      Texture
    },
    sekaiInstances
  };
});

vi.mock("pixi.js", () => doubles.Pixi);
vi.mock("../animation/AnimationController.js", () => ({
  default: class {
    abort_controller = new AbortController();
    abort = vi.fn();
    reset_abort = vi.fn();
    progress_wrapper = vi.fn(async (apply: (progress: number) => void) => {
      apply(0);
      apply(0.5);
      apply(1);
    });
    wrapper = vi.fn(async () => {});
    delay = vi.fn(async () => {});
  }
}));
vi.mock("../animation/Line.js", () => ({ default: doubles.animationTypes.Line }));
vi.mock("../animation/LineLegend.js", () => ({ default: doubles.animationTypes.LineLegend }));
vi.mock("../animation/Kirakira.js", () => ({ default: doubles.animationTypes.Kirakira }));
vi.mock("../animation/Blackout.js", () => ({ default: doubles.animationTypes.Blackout }));
vi.mock("../animation/Lightup.js", () => ({ default: doubles.animationTypes.Lightup }));
vi.mock("../animation/LightupLegend.js", () => ({ default: doubles.animationTypes.LightupLegend }));
vi.mock("../animation/Sekai.js", () => ({ default: doubles.FakeSekai }));

import { Graphics, Sprite, Texture } from "pixi.js";
import type AnimationController from "../animation/AnimationController.js";
import type { Live2DPlayerEventEmitter } from "../Live2DPlayerEventEmitter.js";
import type { ILive2DLayerData, ILive2DTexture } from "../player-types.js";
import Background from "./Background.js";
import Fullcolor from "./Fullcolor.js";
import PlaceInfo from "./PlaceInfo.js";
import SceneEffect from "./SceneEffect.js";
import Sekai from "./Sekai.js";
import Telop from "./Telop.js";
import Wipe from "./Wipe.js";

beforeEach(() => {
  doubles.animationInstances.length = 0;
  doubles.sekaiInstances.length = 0;
});

const createAnimationController = () => {
  const abortController = new AbortController();
  return {
    abort_controller: abortController,
    abort: vi.fn(() => abortController.abort()),
    reset_abort: vi.fn(),
    progress_wrapper: vi.fn(async (apply: (progress: number) => void) => {
      apply(0);
      apply(0.5);
      apply(1);
    }),
    wrapper: vi.fn(async () => {}),
    delay: vi.fn(async () => {})
  } as unknown as AnimationController;
};

const createLayerData = (overrides: Partial<ILive2DLayerData> = {}): ILive2DLayerData => ({
  stage_size: [1280, 720],
  animation_controller: createAnimationController(),
  ...overrides
});

const asTestGraphics = (graphics: Graphics | undefined) =>
  graphics as unknown as {
    fillCalls: unknown[][];
    rects: number[][];
    scale: { x: number; y: number };
  };

describe("Background layer", () => {
  it("covers a wide stage by height and a tall image by width when resized", async () => {
    const layer = new Background(createLayerData());
    layer.set_style([1000, 1000]);
    expect(layer.structure.background).toBeUndefined();

    await layer.draw({ width: 3200, height: 900 } as HTMLImageElement);
    const wide = layer.structure.background;
    expect(wide).toBeInstanceOf(Sprite);
    expect(wide?.scale.x).toBeCloseTo(1000 / 900);
    expect(wide?.scale.y).toBeCloseTo(1000 / 900);
    expect(wide?.x).toBe(500);
    expect(wide?.y).toBe(500);
    expect(wide?.anchor.x).toBe(0.5);

    await layer.draw({ width: 900, height: 1800 } as HTMLImageElement);
    const tall = layer.structure.background;
    expect(layer.root.children).toHaveLength(1);
    expect(tall).not.toBe(wide);
    expect(tall?.scale.x).toBeCloseTo(1000 / 900);
    expect(tall?.scale.y).toBeCloseTo(1000 / 900);
    expect(tall?.x).toBe(500);
    expect(tall?.y).toBe(500);
    expect(layer.root.children[0]).toBe(tall);
  });
});

describe("Fullcolor layer", () => {
  it("draws a sized color plane, defaults alpha, and replaces the previous plane", async () => {
    const layer = new Fullcolor(createLayerData({ stage_size: [1000, 500], screen_length: 1000 }));
    layer.set_style([500, 250]);
    expect(layer.structure.color).toBeUndefined();

    await layer.draw(0x123456, 0.25);
    const first = asTestGraphics(layer.structure.color);
    expect(layer.structure.color).toBeInstanceOf(Graphics);
    expect(first?.fillCalls).toContainEqual([0x123456, 0.25]);
    expect(first?.rects).toContainEqual([0, 0, 1000, 1000]);
    expect(first?.scale.x).toBe(0.5);
    expect(first?.scale.y).toBe(0.25);

    layer.set_style([1500, 750]);
    expect(first?.scale.x).toBe(1.5);
    expect(first?.scale.y).toBe(0.75);

    await layer.draw(0xffffff);
    expect(asTestGraphics(layer.structure.color).fillCalls).toContainEqual([0xffffff, 1]);
    expect(layer.root.children).toHaveLength(1);
    expect(layer.root.children[0]).toBe(layer.structure.color);
  });
});

describe("Wipe layer", () => {
  const textures = [
    { identifier: "ui/black_wipe", texture: { width: 2000, height: 2000 } as Texture }
  ] satisfies ILive2DTexture[];

  it.each([
    ["left", 0, 1280, 0, "x"],
    ["right", 180, 0, 720, "x"],
    ["top", 90, 1280, 720, "y"],
    ["bottom", 270, 0, 0, "y"]
  ] as const)(
    "sizes and animates the %s wipe along the expected axis",
    async (direction, angle, x, y, axis) => {
      const animationController = createAnimationController();
      const layer = new Wipe(
        createLayerData({ textures, animation_controller: animationController })
      );
      await layer.draw();
      const wipe = layer.structure.wipe;
      const container = layer.structure.container;
      const bulk = layer.structure.bulk;
      expect(layer.root.children).toEqual([container]);
      expect(container?.alpha).toBe(0);
      expect(wipe?.scale.x).toBeCloseTo(0.36);
      expect(asTestGraphics(bulk).rects).toContainEqual([0, 0, 1280, 720]);

      await layer.animate(true, direction, 400);
      expect(wipe?.angle).toBe(angle);
      expect(wipe?.position.x).toBe(x);
      expect(wipe?.position.y).toBe(y);
      expect(animationController.progress_wrapper).toHaveBeenCalledWith(expect.any(Function), 400);
      expect(container?.alpha).toBe(1);
      if (axis === "x") expect(container?.position.x).toBe(0);
      else expect(container?.position.y).toBe(0);

      await layer.animate(false, direction, 200);
      expect(animationController.progress_wrapper).toHaveBeenLastCalledWith(
        expect.any(Function),
        200
      );
      expect(container?.alpha).toBe(0);
    }
  );
});

describe("Sekai layer", () => {
  it("starts the requested transition, resizes it, and destroys its animation", async () => {
    const animationController = createAnimationController();
    const textures = [{ identifier: "fog", texture: {} as Texture }];
    const layer = new Sekai(
      createLayerData({ textures, animation_controller: animationController })
    );

    await layer.draw("in_corner", 600);
    const effect = doubles.sekaiInstances[0];
    expect(effect?.textures).toBe(textures);
    expect(effect?.duration).toBe(600);
    expect(effect?.condition).toBe("in_corner");
    expect(effect?.set_style).toHaveBeenCalledWith([1280, 720]);
    expect(effect?.start).toHaveBeenCalledWith(animationController.abort_controller);
    expect(layer.root.children).toEqual([effect?.root]);

    layer.set_style([640, 360]);
    expect(effect?.set_style).toHaveBeenLastCalledWith([640, 360]);
    layer.destroy();
    expect(effect?.destroy).toHaveBeenCalledOnce();
    expect(layer.sekai).toBeUndefined();
    expect(animationController.abort).toHaveBeenCalledOnce();
  });
});

describe("Telop and place-info layers", () => {
  it("draws translated telop text above the original and restyles both tracks", async () => {
    const layer = new Telop(createLayerData({ stage_size: [1280, 720] }));
    await layer.draw("Original", "Translation");
    const text = layer.structure.text;
    const translated = layer.structure.translated_text;
    const background = layer.structure.bg_graphic;

    expect(layer.root.children).toEqual([background, text, translated]);
    expect(text?.anchor.x).toBe(0.5);
    expect(text?.anchor.y).toBe(0.5);
    expect(text?.x).toBe(640);
    expect(text?.y).toBe(360);
    expect(translated?.x).toBe(640);
    expect(translated?.y).toBe(36);
    expect(background?.y).toBe(306);
    expect(background?.scale.x).toBeCloseTo(1280 / 2000);
    expect(background?.scale.y).toBeCloseTo(108 / 2000);

    layer.set_style([800, 600]);
    expect(text?.x).toBe(400);
    expect(text?.y).toBe(300);
    expect(translated?.y).toBe(30);
    expect(background?.y).toBe(255);
    expect(background?.scale.y).toBeCloseTo(90 / 2000);

    await layer.draw("No translation", null);
    expect(layer.structure.translated_text).toBeUndefined();
    expect(layer.root.children).toHaveLength(2);
  });

  it("draws a top-left place label with a bounded gradient panel", async () => {
    const layer = new PlaceInfo(createLayerData({ stage_size: [1280, 720] }));
    expect(layer.root.alpha).toBe(0);
    layer.set_style([800, 600]);
    await layer.draw("Rooftop\nEvening");

    const text = layer.structure.text;
    const background = layer.structure.bg_graphic;
    const gradient = asTestGraphics(background);
    expect(layer.root.children).toEqual([background, text]);
    expect(text?.anchor.x).toBe(0);
    expect(text?.anchor.y).toBe(0);
    expect(text?.x).toBe(12);
    expect(text?.y).toBe(18);
    expect(text?.style.wordWrapWidth).toBe(400);
    expect(background?.y).toBe(12);
    expect(gradient.rects).toHaveLength(20);
    expect(gradient.rects[0]?.[2]).toBeCloseTo(186 / 20);
    expect(gradient.fillCalls[0]).toEqual([0x333333, 0.8]);
    expect(gradient.fillCalls.at(-1)?.[1]).toBeCloseTo(0.8 / 20);
  });
});

describe("SceneEffect layer", () => {
  const events = { emit: vi.fn() };
  const eventEmitter = events as unknown as Live2DPlayerEventEmitter;
  const logger = { log: vi.fn(), warn: vi.fn() };

  it.each([
    ["line", "Line", [0xffffff]],
    ["line_legend_02_akito", "LineLegend", ["up", 0xffffff, 0xff7722]],
    ["kirakira_01_still_an", "Kirakira", [undefined, "still"]],
    ["black_out_03", "Blackout", [0.5]],
    ["light_up_fireworks_02", "Lightup", ["235, 235, 255", "firework"]],
    ["light_up_legend_03", "LightupLegend", [undefined, "corner"]],
    ["dash_line_up", "LineLegend", ["up", 0xffffff]]
  ] as const)(
    "builds %s as the matching animation with its effect configuration",
    async (effect, kind, args) => {
      const textures = [{ identifier: "sparkle", texture: {} as Texture }];
      const layer = new SceneEffect(createLayerData({ textures, logger }));

      await layer.draw(effect, eventEmitter);

      const created = doubles.animationInstances.at(-1);
      expect(created?.kind).toBe(kind);
      if (effect === "kirakira_01_still_an" || effect === "light_up_legend_03")
        expect(created?.args).toEqual([textures, args[1]]);
      else expect(created?.args).toEqual(args);
      expect(layer.root.children).toEqual([created?.instance.root]);
      expect(created?.instance.set_style).toHaveBeenCalledWith([1280, 720]);
      expect(created?.instance.start).toHaveBeenCalledOnce();
      expect(layer.scene_effects).toEqual([{ type: effect, ani: created?.instance }]);
    }
  );

  it("warns for unknown effects and does not create an animation", async () => {
    const layer = new SceneEffect(createLayerData({ logger }));

    await layer.draw("not-a-known-effect", eventEmitter);

    expect(logger.warn).toHaveBeenCalledWith("SceneEffects", "not-a-known-effect not implemented!");
    expect(events.emit).toHaveBeenCalledWith("warn", "not-a-known-effect not implemented!");
    expect(layer.root.children).toHaveLength(0);
    expect(layer.scene_effects).toHaveLength(0);
  });

  it("updates active animation styles, removes only a matching effect, and destroys leftovers", async () => {
    const layer = new SceneEffect(createLayerData({ logger }));
    await layer.draw("line", eventEmitter);
    await layer.draw("black_out_02", eventEmitter);
    const [first, second] = doubles.animationInstances.map(({ instance }) => instance);

    layer.set_style([960, 540]);
    expect(first?.set_style).toHaveBeenLastCalledWith([960, 540]);
    expect(second?.set_style).toHaveBeenLastCalledWith([960, 540]);

    layer.remove("line");
    expect(first?.destroy).toHaveBeenCalledOnce();
    expect(layer.scene_effects.map(({ type }) => type)).toEqual(["black_out_02"]);
    layer.remove("missing");
    expect(second?.destroy).not.toHaveBeenCalled();

    layer.destroy();
    expect(second?.destroy).toHaveBeenCalledOnce();
    expect(layer.scene_effects).toEqual([]);
    expect(layer.root.children[0]?.destroyed).toBe(true);
  });
});
