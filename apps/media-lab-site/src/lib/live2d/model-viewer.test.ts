import { describe, expect, it, vi } from "vitest";
import {
  createLive2dModelViewer,
  getLive2dPreloadUrls,
  parseLive2dModelDescriptor,
  type Live2dModelDescriptor,
  type Live2dModelLoader,
  type Live2dModelResource
} from "./model-viewer";

const descriptor: Live2dModelDescriptor = {
  modelId: "sample-model",
  region: "jp",
  modelUrl: "https://assets.example.test/models/sample.model3.json",
  motions: [
    { id: "idle", url: "https://assets.example.test/motions/idle.motion3.json" },
    { id: "wave", url: "https://assets.example.test/motions/wave.motion3.json" }
  ],
  expressions: [
    { id: "smile", url: "https://assets.example.test/motions/wave.motion3.json" },
    { id: "sad", url: "https://assets.example.test/expressions/sad.exp3.json" }
  ]
};

const createResource = (): Live2dModelResource => ({
  playMotion: vi.fn(async () => undefined),
  playExpression: vi.fn(async () => undefined),
  setIdle: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
  resize: vi.fn(async () => undefined),
  destroy: vi.fn(async () => undefined)
});

const createLoader = (resource = createResource()): Live2dModelLoader => ({
  load: vi.fn(async (_descriptor, _signal, onProgress) => {
    onProgress(0.25);
    onProgress(2);
    return resource;
  }),
  preload: vi.fn(async () => undefined)
});

describe("Live2D model descriptor", () => {
  it("normalizes valid resolved catalog data", () => {
    expect(parseLive2dModelDescriptor({ ...descriptor, region: " JP " })).toEqual({
      status: "ok",
      descriptor
    });
  });

  it("rejects untrusted, ambiguous, and malformed asset data", () => {
    expect(parseLive2dModelDescriptor({ ...descriptor, region: "global" }).status).toBe("invalid");
    expect(parseLive2dModelDescriptor({ ...descriptor, modelUrl: "/model3.json" }).status).toBe(
      "invalid"
    );
    expect(
      parseLive2dModelDescriptor({
        ...descriptor,
        expressions: [{ id: "idle", url: "https://assets.example.test/duplicate.exp3.json" }]
      }).status
    ).toBe("invalid");
    expect(
      parseLive2dModelDescriptor({
        ...descriptor,
        motions: [{ id: "../escape", url: "https://assets.example.test/escape.motion3.json" }]
      }).status
    ).toBe("invalid");
  });

  it("limits preloads to unique asset URLs in descriptor order", () => {
    expect(getLive2dPreloadUrls(descriptor, 3)).toEqual([
      "https://assets.example.test/motions/idle.motion3.json",
      "https://assets.example.test/motions/wave.motion3.json",
      "https://assets.example.test/expressions/sad.exp3.json"
    ]);
    expect(getLive2dPreloadUrls(descriptor, 0)).toEqual([]);
    expect(getLive2dPreloadUrls(descriptor, Number.NaN)).toEqual([]);
    expect(getLive2dPreloadUrls(descriptor, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe("Live2D model viewer controller", () => {
  it("reports unavailable without calling a loader when no descriptor exists", async () => {
    const loader = createLoader();
    const viewer = createLive2dModelViewer(loader);

    await expect(viewer.load(null)).resolves.toEqual({
      status: "unavailable",
      reason: "No model descriptor is available"
    });
    expect(loader.load).not.toHaveBeenCalled();
  });

  it("loads one resource, bounds preload work, and forwards ready commands", async () => {
    const resource = createResource();
    const loader = createLoader(resource);
    const viewer = createLive2dModelViewer(loader, { maxPreload: 2 });
    const states: string[] = [];
    const unsubscribe = viewer.subscribe((state) => states.push(state.status));

    await expect(viewer.load(descriptor)).resolves.toEqual({ status: "ready", descriptor });
    expect(loader.preload).toHaveBeenCalledTimes(2);
    expect(loader.preload).toHaveBeenNthCalledWith(
      1,
      "https://assets.example.test/motions/idle.motion3.json",
      expect.any(AbortSignal)
    );
    expect(loader.preload).toHaveBeenNthCalledWith(
      2,
      "https://assets.example.test/motions/wave.motion3.json",
      expect.any(AbortSignal)
    );

    expect(viewer.setPlaybackOptions({ loop: true, speed: 1.5 })).toBe(true);
    await expect(viewer.playMotion("wave")).resolves.toBe(true);
    await expect(viewer.playExpression("smile")).resolves.toBe(true);
    await expect(viewer.setIdle(false)).resolves.toBe(true);
    await expect(viewer.pause()).resolves.toBe(true);
    await expect(viewer.reset()).resolves.toBe(true);
    await expect(viewer.resize(1280, 720)).resolves.toBe(true);

    expect(resource.playMotion).toHaveBeenCalledWith("wave", { loop: true, speed: 1.5 });
    expect(resource.playExpression).toHaveBeenCalledWith("smile");
    expect(resource.setIdle).toHaveBeenCalledWith(false);
    expect(resource.resize).toHaveBeenCalledWith(1280, 720);
    expect(viewer.playMotion("unknown")).resolves.toBe(false);
    expect(states).toEqual(["idle", "loading", "loading", "loading", "ready"]);
    unsubscribe();
  });

  it("destroys a ready model before replacing it", async () => {
    const firstResource = createResource();
    const secondResource = createResource();
    const loader: Live2dModelLoader = {
      load: vi.fn().mockResolvedValueOnce(firstResource).mockResolvedValueOnce(secondResource)
    };
    const viewer = createLive2dModelViewer(loader);
    const nextDescriptor = { ...descriptor, modelId: "next-model" };

    await viewer.load(descriptor);
    await viewer.load(nextDescriptor);

    expect(firstResource.destroy).toHaveBeenCalledTimes(1);
    expect(secondResource.destroy).not.toHaveBeenCalled();
    expect(viewer.getState()).toEqual({ status: "ready", descriptor: nextDescriptor });
  });

  it("does not let a stale load resume after asynchronous resource cleanup", async () => {
    let releaseDestroy: (() => void) | undefined;
    const firstResource = {
      ...createResource(),
      destroy: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseDestroy = resolve;
          })
      )
    };
    const thirdResource = createResource();
    const loader: Live2dModelLoader = {
      load: vi.fn().mockResolvedValueOnce(firstResource).mockResolvedValueOnce(thirdResource)
    };
    const viewer = createLive2dModelViewer(loader);
    const secondDescriptor = { ...descriptor, modelId: "second-model" };
    const thirdDescriptor = { ...descriptor, modelId: "third-model" };

    await viewer.load(descriptor);
    const staleLoad = viewer.load(secondDescriptor);
    const currentLoad = viewer.load(thirdDescriptor);
    releaseDestroy?.();
    await Promise.all([staleLoad, currentLoad]);

    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(viewer.getState()).toEqual({ status: "ready", descriptor: thirdDescriptor });
  });

  it("ignores and cleans up stale completion after abort", async () => {
    let resolveLoad: ((resource: Live2dModelResource) => void) | undefined;
    const lateResource = createResource();
    const loader: Live2dModelLoader = {
      load: vi.fn(
        () =>
          new Promise<Live2dModelResource>((resolve) => {
            resolveLoad = resolve;
          })
      )
    };
    const viewer = createLive2dModelViewer(loader);

    const pendingLoad = viewer.load(descriptor);
    viewer.abort();
    resolveLoad?.(lateResource);
    await pendingLoad;

    expect(viewer.getState()).toEqual({ status: "idle" });
    expect(lateResource.destroy).toHaveBeenCalledTimes(1);
  });

  it("waits for a pending loader to resolve and destroys its stale resource", async () => {
    let resolveLoad: ((resource: Live2dModelResource) => void) | undefined;
    const lateResource = createResource();
    const loader: Live2dModelLoader = {
      load: vi.fn(
        () =>
          new Promise<Live2dModelResource>((resolve) => {
            resolveLoad = resolve;
          })
      )
    };
    const viewer = createLive2dModelViewer(loader);

    void viewer.load(descriptor);
    let destroyFinished = false;
    const destroying = viewer.destroy().then(() => {
      destroyFinished = true;
    });
    await Promise.resolve();
    expect(destroyFinished).toBe(false);

    resolveLoad?.(lateResource);
    await destroying;
    expect(destroyFinished).toBe(true);
    expect(lateResource.destroy).toHaveBeenCalledTimes(1);
    expect(viewer.getState()).toEqual({ status: "destroyed" });
  });

  it("exposes load failures and destroys exactly once", async () => {
    const loader: Live2dModelLoader = {
      load: vi.fn(async () => {
        throw new Error("asset unavailable");
      })
    };
    const viewer = createLive2dModelViewer(loader);

    await viewer.load(descriptor);
    expect(viewer.getState()).toMatchObject({ status: "error", descriptor });

    await viewer.destroy();
    await viewer.destroy();
    expect(viewer.getState()).toEqual({ status: "destroyed" });
    await expect(viewer.reload()).resolves.toEqual({ status: "destroyed" });
  });

  it("waits for an in-flight abort cleanup when it is destroyed", async () => {
    let releaseDestroy: (() => void) | undefined;
    const resource = {
      ...createResource(),
      destroy: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseDestroy = resolve;
          })
      )
    };
    const viewer = createLive2dModelViewer({
      load: vi.fn(async () => resource)
    });

    await viewer.load(descriptor);
    viewer.abort();
    let destroyFinished = false;
    const destroying = viewer.destroy().then(() => {
      destroyFinished = true;
    });
    await Promise.resolve();
    expect(destroyFinished).toBe(false);

    releaseDestroy?.();
    await destroying;
    expect(resource.destroy).toHaveBeenCalledTimes(1);
  });
});
