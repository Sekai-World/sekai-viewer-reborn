import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DISMISSED_DEPLOYMENT_STORAGE_KEY,
  DeploymentUpdateMonitor,
  fetchDeployedVersion,
  readDismissedDeployment
} from "./deployment-update.svelte";

const versionUrl = "/_app/version.json";

const createStorage = (
  initial: Record<string, string> = {}
): Pick<Storage, "getItem" | "setItem"> => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
};

const versionResponse = (version: unknown): Response =>
  new Response(JSON.stringify({ version }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

const createMonitor = (
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
  storage = createStorage(),
  reload = vi.fn()
) => ({
  monitor: new DeploymentUpdateMonitor({
    clientVersion: "1000",
    versionUrl,
    fetch: fetcher,
    storage,
    reload
  }),
  storage,
  reload
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchDeployedVersion", () => {
  it("reads the deployed build name without using the HTTP cache", async () => {
    const fetcher = vi.fn(async () => versionResponse("2000"));

    await expect(fetchDeployedVersion(versionUrl, fetcher)).resolves.toBe("2000");
    expect(fetcher).toHaveBeenCalledWith(versionUrl, { cache: "no-store" });
  });

  it("returns null for network, HTTP, and format failures", async () => {
    const failures: (() => Promise<Response>)[] = [
      async () => {
        throw new TypeError("Failed to fetch");
      },
      async () => new Response("unavailable", { status: 503 }),
      async () => new Response("<html></html>", { status: 200 }),
      async () => versionResponse(""),
      async () => versionResponse(42),
      async () => new Response("null", { status: 200 })
    ];

    for (const failure of failures) {
      await expect(fetchDeployedVersion(versionUrl, failure)).resolves.toBeNull();
    }
  });
});

describe("DeploymentUpdateMonitor", () => {
  it("shows the prompt when the deployed version differs from this tab", async () => {
    const { monitor } = createMonitor(async () => versionResponse("2000"));

    await monitor.detect();

    expect(monitor.deployedVersion).toBe("2000");
    expect(monitor.visible).toBe(true);
  });

  it("stays hidden when the deployed version is unchanged", async () => {
    const { monitor } = createMonitor(async () => versionResponse("1000"));

    await monitor.detect();

    expect(monitor.deployedVersion).toBeNull();
    expect(monitor.visible).toBe(false);
  });

  it("shares one request between overlapping checks and stops once a version is known", async () => {
    const fetcher = vi.fn(async () => versionResponse("2000"));
    const { monitor } = createMonitor(fetcher);

    await Promise.all([monitor.detect(), monitor.detect()]);
    await monitor.detect();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("remembers a dismissal for that deployed version only", async () => {
    const storage = createStorage();
    const first = createMonitor(async () => versionResponse("2000"), storage).monitor;
    first.listen(() => true)();
    await first.detect();

    first.dismiss();

    expect(first.visible).toBe(false);
    expect(storage.getItem(DISMISSED_DEPLOYMENT_STORAGE_KEY)).toBe("2000");
    expect(readDismissedDeployment(storage)).toBe("2000");

    const sameDeployment = createMonitor(async () => versionResponse("2000"), storage).monitor;
    sameDeployment.listen(() => true)();
    await sameDeployment.detect();
    expect(sameDeployment.visible).toBe(false);

    const laterDeployment = createMonitor(async () => versionResponse("3000"), storage).monitor;
    laterDeployment.listen(() => true)();
    await laterDeployment.detect();
    expect(laterDeployment.visible).toBe(true);
  });

  it("hides the prompt when another tab dismisses the same deployment", async () => {
    const { monitor } = createMonitor(async () => versionResponse("2000"));
    const stop = monitor.listen(() => true);
    await monitor.detect();

    window.dispatchEvent(
      new StorageEvent("storage", { key: DISMISSED_DEPLOYMENT_STORAGE_KEY, newValue: "2000" })
    );

    expect(monitor.visible).toBe(false);
    stop();
  });

  it("keeps its own dismissal when another tab dismisses a different build", async () => {
    // Tab A runs build X ("1000") and has dismissed the prompt for build C ("2000").
    // Another tab then dismisses build Y ("3000").
    const { monitor, storage } = createMonitor(async () => versionResponse("2000"));
    const stop = monitor.listen(() => true);
    await monitor.detect();
    monitor.dismiss();

    storage.setItem(DISMISSED_DEPLOYMENT_STORAGE_KEY, "3000");
    window.dispatchEvent(
      new StorageEvent("storage", { key: DISMISSED_DEPLOYMENT_STORAGE_KEY, newValue: "3000" })
    );

    expect(monitor.dismissedVersion).toBe("2000");
    expect(monitor.visible).toBe(false);
    stop();
  });

  it("keeps the prompt when another tab dismisses a different build", async () => {
    const { monitor } = createMonitor(async () => versionResponse("2000"));
    const stop = monitor.listen(() => true);
    await monitor.detect();

    window.dispatchEvent(
      new StorageEvent("storage", { key: DISMISSED_DEPLOYMENT_STORAGE_KEY, newValue: "3000" })
    );

    expect(monitor.visible).toBe(true);
    stop();
  });

  it("keeps a failed check silent and retries when the tab regains focus", async () => {
    const consoleError = vi.spyOn(console, "error");
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(versionResponse("2000"));
    const { monitor } = createMonitor(fetcher);
    const stop = monitor.listen(() => true);

    await expect(monitor.detect()).resolves.toBeUndefined();
    expect(monitor.visible).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(monitor.visible).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not check from tab events until SvelteKit reports a new deployment", () => {
    const fetcher = vi.fn(async () => versionResponse("2000"));
    const { monitor } = createMonitor(fetcher);
    const stop = monitor.listen(() => false);

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));

    expect(fetcher).not.toHaveBeenCalled();
    stop();
  });

  it("reloads only when asked", async () => {
    const { monitor, reload } = createMonitor(async () => versionResponse("2000"));

    await monitor.detect();
    expect(reload).not.toHaveBeenCalled();

    monitor.reload();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
