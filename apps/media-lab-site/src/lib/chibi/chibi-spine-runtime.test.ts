import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => {
  const events: string[] = [];
  const state = {
    textureLoadError: undefined as Error | undefined,
    boundsError: undefined as Error | undefined,
    bounds: { x: -50, y: -200, width: 100, height: 200 }
  };
  class ImageResource {
    load = vi.fn(async () => {
      if (state.textureLoadError) throw state.textureLoadError;
    });
    constructor(
      public url: string,
      public options: unknown
    ) {}
  }

  class BaseTexture {
    static instances: BaseTexture[] = [];
    destroy = vi.fn(() => void events.push("baseTexture.destroy"));
    constructor(
      public resource: ImageResource,
      public options: { alphaMode: number }
    ) {
      BaseTexture.instances.push(this);
    }
  }

  class Application {
    static instances: Application[] = [];
    view = { tagName: "CANVAS" };
    screen: { width: number; height: number };
    stage = {
      addChild: vi.fn(),
      removeChildren: vi.fn(() => void events.push("stage.removeChildren"))
    };
    renderer = {
      resize: vi.fn((width: number, height: number) => {
        this.screen = { width, height };
      })
    };
    ticker = {
      deltaMS: 20,
      listeners: [] as (() => void)[],
      add: (listener: () => void) => void this.ticker.listeners.push(listener)
    };
    destroy = vi.fn(() => void events.push("app.destroy"));
    constructor(public options: { width: number; height: number }) {
      this.screen = { width: options.width, height: options.height };
      Application.instances.push(this);
    }
  }

  class TextureAtlas {
    pages: { pma: boolean; setTexture: ReturnType<typeof vi.fn> }[];
    dispose = vi.fn(() => void events.push("atlas.dispose"));
    constructor(text: string) {
      this.pages = [{ pma: text.includes("pma:true"), setTexture: vi.fn() }];
    }
  }

  class AtlasAttachmentLoader {
    constructor(public atlas: TextureAtlas) {}
  }

  class SkeletonBinary {
    constructor(public loader: AtlasAttachmentLoader) {}
    readSkeletonData(bytes: Uint8Array) {
      return { bytes, animations: [{ name: "idle" }, { name: "walk" }] };
    }
  }

  class Spine {
    static instances: Spine[] = [];
    scale = { set: vi.fn() };
    position = { set: vi.fn() };
    state = { data: { defaultMix: 1 }, setAnimation: vi.fn() };
    skeleton: { data: { animations: { name: string }[] } };
    update = vi.fn();
    destroy = vi.fn(() => void events.push("spine.destroy"));
    constructor(
      data: { animations: { name: string }[] },
      public options?: { autoUpdate?: boolean }
    ) {
      this.skeleton = { data };
      Spine.instances.push(this);
    }
    getLocalBounds() {
      if (state.boundsError) throw state.boundsError;
      return state.bounds;
    }
  }

  const spineTextureFrom = vi.fn((texture: unknown) => ({ wraps: texture }));

  return {
    events,
    state,
    BaseTexture,
    ImageResource,
    Application,
    Spine,
    spineTextureFrom,
    TextureAtlas,
    AtlasAttachmentLoader,
    SkeletonBinary
  };
});

vi.mock("pixi.js", () => ({
  ALPHA_MODES: { UNPACK: 1, PMA: 2 },
  Application: fakes.Application,
  BaseTexture: fakes.BaseTexture,
  ImageResource: fakes.ImageResource
}));

vi.mock("@esotericsoftware/spine-pixi", () => ({
  AtlasAttachmentLoader: fakes.AtlasAttachmentLoader,
  SkeletonBinary: fakes.SkeletonBinary,
  Spine: fakes.Spine,
  SpineTexture: { from: fakes.spineTextureFrom },
  TextureAtlas: fakes.TextureAtlas
}));

import { createChibiRuntimeFacade } from "./chibi-spine-runtime";

const PMA_ATLAS = "sekai_atlas.png\nsize:1024,512\npma:true\n";
const STRAIGHT_ATLAS = "sekai_atlas.png\nsize:1024,512\n";
const TEXTURE_URL = "https://assets.example/sekai_atlas.png";
const SKELETON_BYTES = new Uint8Array([4, 1]);

const createHost = (width: number, height: number) =>
  ({ clientWidth: width, clientHeight: height, appendChild: vi.fn() }) as unknown as HTMLElement & {
    appendChild: ReturnType<typeof vi.fn>;
  };

const createModel = async (atlasText = PMA_ATLAS) => {
  const spine = await createChibiRuntimeFacade().loadSpine();
  const model = await spine.createModel({
    atlasText,
    textureUrl: TEXTURE_URL,
    skeletonBytes: SKELETON_BYTES
  });
  return { spine, model, object: fakes.Spine.instances.at(-1)! };
};

beforeEach(() => {
  fakes.events.length = 0;
  fakes.state.textureLoadError = undefined;
  fakes.state.boundsError = undefined;
  fakes.BaseTexture.instances.length = 0;
  fakes.state.bounds = { x: -50, y: -200, width: 100, height: 200 };
  fakes.Application.instances.length = 0;
  fakes.Spine.instances.length = 0;
  vi.clearAllMocks();
});

describe("createChibiRuntimeFacade", () => {
  it("loads the Spine runtime once", async () => {
    const facade = createChibiRuntimeFacade();

    expect(await facade.loadSpine()).toBe(await facade.loadSpine());
  });

  it("fetches assets with the caller's abort signal", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    try {
      await createChibiRuntimeFacade().fetchAsset("https://assets.example/a.txt", signal);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetchMock).toHaveBeenCalledWith("https://assets.example/a.txt", { signal });
  });
});

describe("createModel", () => {
  it("uploads a premultiplied atlas texture as-is from a cross-origin image", async () => {
    await createModel(PMA_ATLAS);

    const baseTexture = fakes.BaseTexture.instances[0]!;
    expect(baseTexture.options).toEqual({ alphaMode: 2 });
    expect(baseTexture.resource.url).toBe(TEXTURE_URL);
    expect(baseTexture.resource.options).toEqual({
      autoLoad: false,
      createBitmap: false,
      crossorigin: "anonymous"
    });
  });

  it("lets Pixi premultiply a straight-alpha atlas texture", async () => {
    await createModel(STRAIGHT_ATLAS);

    expect(fakes.BaseTexture.instances[0]!.options).toEqual({ alphaMode: 1 });
  });

  it("gives each model its own texture, even for the same URL", async () => {
    await createModel();
    await createModel();

    const [first, second] = fakes.BaseTexture.instances;
    expect(second).not.toBe(first);
  });

  it("keeps the Spine object off Pixi's shared ticker", async () => {
    const { object } = await createModel();

    expect(object.options).toEqual({ autoUpdate: false });
  });

  it("releases everything when the first geometry update fails", async () => {
    fakes.state.boundsError = new Error("unknown blend mode");

    await expect(createModel()).rejects.toThrow("unknown blend mode");
    expect(fakes.events).toEqual(["spine.destroy", "atlas.dispose", "baseTexture.destroy"]);
  });

  it("builds the skeleton from the binary data and lists its animations", async () => {
    const { model, object } = await createModel();

    expect(fakes.spineTextureFrom).toHaveBeenCalledWith(fakes.BaseTexture.instances[0]);
    expect(object.skeleton.data).toMatchObject({ bytes: SKELETON_BYTES });
    expect(object.state.data.defaultMix).toBe(0);
    expect(model.animationNames).toEqual(["idle", "walk"]);
  });

  it("plays an animation on track 0", async () => {
    const { model, object } = await createModel();

    model.setAnimation("walk", false);

    expect(object.state.setAnimation).toHaveBeenCalledWith(0, "walk", false);
  });

  it("releases the atlas and the texture when the texture cannot be loaded", async () => {
    fakes.state.textureLoadError = new Error("texture 404");

    await expect(createModel()).rejects.toThrow("texture 404");
    expect(fakes.events).toEqual(["atlas.dispose", "baseTexture.destroy"]);
    expect(fakes.Spine.instances).toHaveLength(0);
  });

  it("destroys the Spine object before its atlas and texture", async () => {
    const { model } = await createModel();

    model.destroy();

    expect(fakes.events).toEqual(["spine.destroy", "atlas.dispose", "baseTexture.destroy"]);
  });
});

describe("createStage", () => {
  it("sizes the canvas to the host and appends it", async () => {
    const { spine } = await createModel();
    const host = createHost(400, 300);

    spine.createStage(host);

    const app = fakes.Application.instances[0]!;
    expect(app.options).toMatchObject({ width: 400, height: 300, backgroundAlpha: 0 });
    expect(host.appendChild).toHaveBeenCalledWith(app.view);
  });

  it("centers the model and fits it to 80% of the shorter side", async () => {
    const { spine, model, object } = await createModel();
    const stage = spine.createStage(createHost(400, 300));

    stage.show(model);

    // Bounds 100x200 at (-50, -200): scale = 300 * 0.8 / 200 = 1.2.
    expect(object.scale.set).toHaveBeenLastCalledWith(1.2);
    expect(object.position.set).toHaveBeenLastCalledWith(200, 270);
    expect(fakes.Application.instances[0]!.stage.addChild).toHaveBeenCalledWith(object);
  });

  it("advances the shown model from the stage's own ticker", async () => {
    const { spine, model, object } = await createModel();
    const stage = spine.createStage(createHost(400, 300));
    const [tick] = fakes.Application.instances[0]!.ticker.listeners;

    tick!();
    expect(object.update).not.toHaveBeenCalled();

    stage.show(model);
    tick!();
    expect(object.update).toHaveBeenCalledWith(0.02);

    stage.destroy();
    tick!();
    expect(object.update).toHaveBeenCalledTimes(1);
  });

  it("lays the model out again after a resize", async () => {
    const { spine, model, object } = await createModel();
    const stage = spine.createStage(createHost(400, 300));
    stage.show(model);

    stage.resize(1000, 500);

    expect(fakes.Application.instances[0]!.renderer.resize).toHaveBeenCalledWith(1000, 500);
    expect(object.scale.set).toHaveBeenLastCalledWith(2);
    expect(object.position.set).toHaveBeenLastCalledWith(500, 450);
  });

  it("resizes an empty stage without laying anything out", async () => {
    const { spine, object } = await createModel();
    const stage = spine.createStage(createHost(400, 300));

    stage.resize(200, 200);

    expect(object.scale.set).not.toHaveBeenCalled();
  });

  it("refuses a model that another runtime created", async () => {
    const { spine } = await createModel();
    const stage = spine.createStage(createHost(400, 300));
    const foreign = { animationNames: [], setAnimation: vi.fn(), destroy: vi.fn() };

    expect(() => stage.show(foreign)).toThrow("Chibi model was created by another runtime");
  });

  it("removes the canvas without destroying the model", async () => {
    const { spine, model, object } = await createModel();
    const stage = spine.createStage(createHost(400, 300));
    stage.show(model);

    stage.destroy();

    expect(fakes.events).toEqual(["stage.removeChildren", "app.destroy"]);
    expect(fakes.Application.instances[0]!.destroy).toHaveBeenCalledWith(true);
    expect(object.destroy).not.toHaveBeenCalled();
  });
});
