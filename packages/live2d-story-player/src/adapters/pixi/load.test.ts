import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("howler", () => ({
  Howl: class {
    private readonly listeners = new Map<string, (() => void)[]>();

    once(event: string, listener: () => void) {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    off(event: string, listener?: () => void) {
      if (!listener) this.listeners.delete(event);
      else
        this.listeners.set(
          event,
          (this.listeners.get(event) ?? []).filter((item) => item !== listener)
        );
      return this;
    }

    load() {
      queueMicrotask(() => {
        for (const listener of this.listeners.get("load") ?? []) listener();
      });
      return this;
    }

    stop() {
      return this;
    }

    unload() {
      return this;
    }
  }
}));

const rateLimiterCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../core/rate-limited-fetch.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../core/rate-limited-fetch.js")>();
  return {
    ...actual,
    live2dRequest: async <T>(request: () => Promise<T>): Promise<T> => {
      rateLimiterCalls.count++;
      return actual.live2dRequest(request);
    }
  };
});

import {
  getLive2DControllerData,
  getLive2DModelData,
  preloadMedia,
  preloadModelMotion,
  preloadModels
} from "./load.js";
import { Live2DAssetType, Live2DLoadProgressType } from "./player-types.js";
import type {
  ILive2DAssetUrl,
  ILive2DControllerData,
  ILive2DModelDataCollection
} from "./player-types.js";
import type { Live2DLoadOptions, Live2DResourceAdapter } from "./adapter-types.js";

const modelData = (costume: string): ILive2DModelDataCollection =>
  ({
    cid: 1,
    costume,
    data: {
      url: `https://assets.example.com/${costume}/`,
      FileReferences: {
        Textures: ["texture_00.png"],
        Moc: "model.moc3",
        Physics: "physics.json3",
        Motions: { Motion: [], Expression: [] }
      }
    }
  }) as unknown as ILive2DModelDataCollection;

const controllerData = (costumes: string[]): ILive2DControllerData =>
  ({
    scenarioData: {},
    scenarioResource: { image: [], video: [], audio: [] },
    modelData: costumes.map(modelData)
  }) as unknown as ILive2DControllerData;

const directRequest: NonNullable<Live2DLoadOptions["request"]> = <T>(
  request: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> => request(signal);

const createAdapter = <T>(
  create: (url: string) => T | Promise<T>,
  load: (resource: T, url: string, signal: AbortSignal) => Promise<void> = async () => {},
  release: (resource: T) => void = () => {}
): Live2DResourceAdapter<T> => ({
  create: vi.fn(create),
  load: vi.fn(load),
  release: vi.fn(release)
});

const createLoadOptions = (
  media: NonNullable<Live2DLoadOptions["media"]>,
  signal?: AbortSignal
): Live2DLoadOptions => ({
  media,
  signal,
  request: directRequest,
  logger: { log: vi.fn(), warn: vi.fn() }
});

const mediaUrls = (): ILive2DAssetUrl[] => [
  {
    type: Live2DAssetType.UI,
    identifier: "ui-image",
    url: "https://assets.example.com/ui.png"
  },
  {
    type: Live2DAssetType.Video,
    identifier: "scene-video",
    url: "https://assets.example.com/scene.mp4"
  },
  {
    type: Live2DAssetType.Talk,
    identifier: "voice",
    url: "https://assets.example.com/voice.ogg"
  }
];

describe("preloadModels progress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the completed file count, ending at total", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    );
    const calls: {
      type: Live2DLoadProgressType;
      count: number;
      total: number;
    }[] = [];

    await preloadModels(controllerData(["costume_a", "costume_b"]), (type, count, total) => {
      calls.push({ type, count, total });
    });

    // two models x (texture + moc + physics)
    expect(calls).toHaveLength(6);
    expect(calls.map((call) => call.type)).toEqual(
      Array(6).fill(Live2DLoadProgressType.ModelAssets)
    );
    expect(calls.map((call) => call.total)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(calls.map((call) => call.count)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(calls.at(-1)).toEqual({
      type: Live2DLoadProgressType.ModelAssets,
      count: 6,
      total: 6
    });
  });
});

describe("preloadMedia progress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("routes image and sound loads through the shared rate limiter", async () => {
    class FakeImage {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      crossOrigin = "";
      set src(_value: string) {
        queueMicrotask(() => this.onload());
      }
    }
    vi.stubGlobal("Image", FakeImage);

    const urls: ILive2DAssetUrl[] = [
      {
        type: Live2DAssetType.UI,
        identifier: "ui-image",
        url: "https://assets.example.com/ui.png"
      },
      {
        type: Live2DAssetType.BackgroundMusic,
        identifier: "bgm",
        url: "https://assets.example.com/bgm.mp3"
      }
    ];
    rateLimiterCalls.count = 0;

    const resource = await preloadMedia(urls, () => {}, vi.fn());

    expect(rateLimiterCalls.count).toBe(2);
    expect(resource.image).toHaveLength(1);
    expect(resource.image[0]?.identifier).toBe("ui-image");
    expect(resource.audio).toHaveLength(1);
    expect(resource.audio[0]?.identifier).toBe("bgm");
  });
});

describe("abortable media loading", () => {
  it("releases every acquired media resource exactly once when any load fails", async () => {
    const released: string[] = [];
    const image = { name: "image" } as unknown as HTMLImageElement;
    const video = { name: "video" } as unknown as HTMLVideoElement;
    const audio = { name: "audio" } as unknown as import("howler").Howl;
    const failure = new Error("audio decoder failed");
    const media = {
      image: createAdapter(
        () => image,
        async () => {},
        () => released.push("image")
      ),
      video: createAdapter(
        () => video,
        async () => {},
        () => released.push("video")
      ),
      audio: createAdapter(
        () => audio,
        async () => {
          throw failure;
        },
        () => released.push("audio")
      )
    };

    await expect(
      preloadMedia(mediaUrls(), () => {}, vi.fn(), createLoadOptions(media))
    ).rejects.toBe(failure);
    expect(released).toHaveLength(3);
    expect([...released].sort()).toEqual(["audio", "image", "video"]);
  });

  it("aborts active media loads and releases each resource once", async () => {
    const controller = new AbortController();
    const released: string[] = [];
    const started = deferred<void>();
    let loadingCount = 0;
    const waitForAbort = (_resource: unknown, _url: string, signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        loadingCount++;
        if (loadingCount === 3) started.resolve();
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    const media = {
      image: createAdapter(
        () => ({}) as HTMLImageElement,
        waitForAbort,
        () => released.push("image")
      ),
      video: createAdapter(
        () => ({}) as HTMLVideoElement,
        waitForAbort,
        () => released.push("video")
      ),
      audio: createAdapter(
        () => ({}) as import("howler").Howl,
        waitForAbort,
        () => released.push("audio")
      )
    };
    const run = preloadMedia(
      mediaUrls(),
      () => {},
      vi.fn(),
      createLoadOptions(media, controller.signal)
    );

    await started.promise;
    controller.abort(new Error("cancel media"));
    await expect(run).rejects.toThrow("cancel media");

    expect(released).toHaveLength(3);
    expect([...released].sort()).toEqual(["audio", "image", "video"]);
  });

  it("disposes a resource that is acquired after cancellation cleanup", async () => {
    const lateImage = { name: "late-image" } as unknown as HTMLImageElement;
    const released: string[] = [];
    const failure = new Error("video load failed");
    const lateCreate = deferred<HTMLImageElement>();
    const media = {
      image: createAdapter(
        () => lateCreate.promise,
        async () => {},
        () => released.push("image")
      ),
      video: createAdapter(
        () => ({}) as HTMLVideoElement,
        async () => {
          throw failure;
        },
        () => released.push("video")
      )
    };
    const run = preloadMedia(mediaUrls().slice(0, 2), () => {}, vi.fn(), createLoadOptions(media));

    await expect(run).rejects.toBe(failure);
    expect(released).toEqual(["video"]);
    lateCreate.resolve(lateImage);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(released).toEqual(["video", "image"]);
  });

  it("exposes an idempotent per-run cleanup handle after success", async () => {
    const released: string[] = [];
    const image = { name: "image" } as unknown as HTMLImageElement;
    const media = {
      image: createAdapter(
        () => image,
        async () => {},
        () => released.push("image")
      )
    };
    const resource = await preloadMedia(
      mediaUrls().slice(0, 1),
      () => {},
      vi.fn(),
      createLoadOptions(media)
    );

    resource.dispose();
    resource.dispose();
    expect(released).toEqual(["image"]);
  });

  it("preserves the cleanup handle on controller data for runtime ownership transfer", async () => {
    const image = { name: "image" } as unknown as HTMLImageElement;
    const released = vi.fn();
    const media = {
      image: createAdapter(
        () => image,
        async () => {},
        released
      )
    };
    const controller = await getLive2DControllerData(
      {} as Parameters<typeof getLive2DControllerData>[0],
      [],
      Promise.resolve([]),
      () => {},
      vi.fn(),
      mediaUrls().slice(0, 1),
      createLoadOptions(media)
    );

    expect(typeof controller.scenarioResource.dispose).toBe("function");
    controller.scenarioResource.dispose();
    expect(released).toHaveBeenCalledOnce();
  });

  it("does not mutate caller media URLs when the same list is reused for a retry", async () => {
    const callerUrls: ILive2DAssetUrl[] = [
      {
        type: Live2DAssetType.Video,
        identifier: "scene-video",
        url: "https://assets.example.com/scene.mp4"
      },
      {
        type: Live2DAssetType.Talk,
        identifier: "voice",
        url: "https://assets.example.com/voice.ogg"
      }
    ];
    const uiAssets: ILive2DAssetUrl[] = [
      {
        type: Live2DAssetType.UI,
        identifier: "ui-image",
        url: "https://assets.example.com/ui.png"
      }
    ];
    const originalCallerUrls = [...callerUrls];
    const originalUiAssets = [...uiAssets];
    const released: string[] = [];
    const media = {
      image: createAdapter(
        () => ({}) as unknown as HTMLImageElement,
        async () => {},
        () => released.push("image")
      ),
      video: createAdapter(
        () => ({}) as unknown as HTMLVideoElement,
        async () => {},
        () => released.push("video")
      ),
      audio: createAdapter(
        () => ({}) as unknown as import("howler").Howl,
        async () => {},
        () => released.push("audio")
      )
    };
    const load = () =>
      getLive2DControllerData(
        {} as Parameters<typeof getLive2DControllerData>[0],
        callerUrls,
        Promise.resolve([]),
        () => {},
        vi.fn(),
        uiAssets,
        createLoadOptions(media)
      );

    const firstAttempt = await load();
    firstAttempt.scenarioResource.dispose();
    const retry = await load();
    retry.scenarioResource.dispose();

    expect(callerUrls).toEqual(originalCallerUrls);
    expect(uiAssets).toEqual(originalUiAssets);
    expect(media.image.create).toHaveBeenCalledTimes(2);
    expect(media.video.create).toHaveBeenCalledTimes(2);
    expect(media.audio.create).toHaveBeenCalledTimes(2);
    expect(released.sort()).toEqual(["audio", "audio", "image", "image", "video", "video"]);
  });

  it("releases loaded media if model data fails in the combined controller loader", async () => {
    const modelDataPromise = deferred<ILive2DModelDataCollection[]>();
    const loaded = deferred<void>();
    const released = vi.fn();
    const image = { name: "image" } as unknown as HTMLImageElement;
    const media = {
      image: createAdapter(
        () => image,
        async () => {
          loaded.resolve();
        },
        released
      )
    };
    const uiAssets = mediaUrls().slice(0, 1);
    const run = getLive2DControllerData(
      {} as Parameters<typeof getLive2DControllerData>[0],
      [],
      modelDataPromise.promise,
      () => {},
      vi.fn(),
      uiAssets,
      createLoadOptions(media)
    );
    const modelFailure = new Error("model metadata unavailable");

    await loaded.promise;
    await Promise.resolve();
    modelDataPromise.reject(modelFailure);

    await expect(run).rejects.toBe(modelFailure);
    expect(released).toHaveBeenCalledOnce();
  });
});

describe("abortable model loading", () => {
  it("passes fetch signals and propagates model asset failures", async () => {
    const response = new Response(null, { status: 503 });
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      if (String(input).endsWith("texture_00.png")) return response;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true
        });
      });
    });
    const warning = vi.fn();

    await expect(
      preloadModels(controllerData(["costume_a"]), () => {}, warning, {
        fetch: fetcher,
        request: directRequest,
        logger: { log: vi.fn(), warn: vi.fn() }
      })
    ).rejects.toBe(response);
    expect(fetcher).toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
  });

  it("propagates motion request failures instead of returning success", async () => {
    const model = modelData("costume_a");
    model.data.FileReferences.Motions.Motion.push({
      Name: "wave",
      File: "https://assets.example.com/wave.motion3.json",
      FadeInTime: 0,
      FadeOutTime: 0
    });
    const response = new Response(null, { status: 404 });
    const fetcher = vi.fn(async () => response);
    const warning = vi.fn();

    await expect(
      preloadModelMotion([model], () => {}, warning, {
        fetch: fetcher,
        request: directRequest,
        logger: { log: vi.fn(), warn: vi.fn() }
      })
    ).rejects.toBe(response);
    expect(warning).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(model.data.FileReferences.Motions.Motion[0]?.File, {
      signal: expect.any(AbortSignal)
    });
  });

  it("passes the caller signal to model source lookups and propagates cancellation", async () => {
    const controller = new AbortController();
    const abortReason = new Error("stop model lookup");
    const lateFailure = new Error("late model source failure");
    const lookupStarted = deferred<void>();
    let modelSignal: AbortSignal | undefined;
    let rejectLookup!: (reason: unknown) => void;
    const modelSource = {
      getModelDataForCostume: vi.fn(
        (_costume: string, _character2dId: number, signal?: AbortSignal) => {
          modelSignal = signal;
          lookupStarted.resolve();
          return new Promise<ILive2DModelDataCollection | null>((_resolve, reject) => {
            rejectLookup = reject;
          });
        }
      )
    };
    const scenario = {
      AppearCharacters: [{ Character2dId: 1, CostumeType: "costume_a" }]
    } as unknown as Parameters<typeof getLive2DModelData>[0];
    const run = getLive2DModelData(scenario, modelSource, () => {}, vi.fn(), {
      signal: controller.signal
    });
    await lookupStarted.promise;
    controller.abort(abortReason);

    await expect(run).rejects.toBe(abortReason);
    expect(modelSignal).toBe(controller.signal);
    rejectLookup(lateFailure);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
