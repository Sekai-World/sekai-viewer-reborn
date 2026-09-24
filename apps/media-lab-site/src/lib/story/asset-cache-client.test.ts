import { afterEach, describe, expect, it, vi } from "vitest";
import { registerStoryAssetCache } from "./asset-cache-client";

const createServiceWorkerMock = () => {
  const messages: unknown[] = [];
  const active = {
    postMessage: (message: unknown) => {
      messages.push(message);
    }
  };
  return {
    messages,
    active,
    register: vi.fn().mockResolvedValue(undefined),
    ready: Promise.resolve({ active })
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("story asset cache registration", () => {
  it("does nothing when service workers are unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(registerStoryAssetCache("https://storage.example.test")).resolves.toBeUndefined();
  });

  it("configures the worker with the remote asset origin and the relay prefix", async () => {
    const serviceWorker = createServiceWorkerMock();
    vi.stubGlobal("navigator", { serviceWorker });

    await registerStoryAssetCache("https://storage.example.test");

    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(serviceWorker.messages).toEqual([
      {
        type: "configure-story-asset-cache",
        origins: ["https://storage.example.test"],
        pathPrefixes: ["/live2d/assets/"],
        maxTotalBytes: 512 * 1024 * 1024
      }
    ]);
  });

  it("configures a relative proxy base as a same-origin path prefix", async () => {
    const serviceWorker = createServiceWorkerMock();
    vi.stubGlobal("navigator", { serviceWorker });

    await registerStoryAssetCache("/storage");

    expect(serviceWorker.messages).toEqual([
      expect.objectContaining({
        origins: [],
        pathPrefixes: ["/storage", "/live2d/assets/"]
      })
    ]);
  });

  it("ignores an empty asset base instead of caching same-origin paths", async () => {
    const serviceWorker = createServiceWorkerMock();
    vi.stubGlobal("navigator", { serviceWorker });

    await registerStoryAssetCache("   ");

    expect(serviceWorker.register).not.toHaveBeenCalled();
  });
});
