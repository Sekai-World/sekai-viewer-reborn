import { afterEach, describe, expect, it, vi } from "vitest";

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

const mockEnv = (value: string | undefined) => {
  vi.doMock("$env/dynamic/public", () => ({ env: { PUBLIC_REMOTE_ASSET_BASE_URL: value } }));
};

const importClient = async () => await import("./asset-cache-client");

afterEach(() => {
  vi.doUnmock("$env/dynamic/public");
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("story asset cache registration", () => {
  it("does nothing when service workers are unavailable", async () => {
    mockEnv("https://storage.example.test");
    vi.stubGlobal("navigator", {});
    const { registerStoryAssetCache: register } = await importClient();

    await expect(register()).resolves.toBeUndefined();
  });

  it("configures the worker with the remote asset origin and the relay prefix", async () => {
    mockEnv("https://storage.example.test");
    const serviceWorker = createServiceWorkerMock();
    vi.stubGlobal("navigator", { serviceWorker });
    const { registerStoryAssetCache: register } = await importClient();

    await register();

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

  it("falls back to the public asset origin without configuration", async () => {
    mockEnv(undefined);
    const serviceWorker = createServiceWorkerMock();
    vi.stubGlobal("navigator", { serviceWorker });
    const { registerStoryAssetCache: register } = await importClient();

    await register();

    expect(serviceWorker.messages).toEqual([
      expect.objectContaining({ origins: ["https://storage.sekai.best"] })
    ]);
  });

  it("configures a relative base as a same-origin path prefix", async () => {
    mockEnv("/storage");
    const serviceWorker = createServiceWorkerMock();
    vi.stubGlobal("navigator", { serviceWorker });
    const { registerStoryAssetCache: register } = await importClient();

    await register();

    expect(serviceWorker.messages).toEqual([
      expect.objectContaining({
        origins: [],
        pathPrefixes: ["/storage", "/live2d/assets/"]
      })
    ]);
  });
});
