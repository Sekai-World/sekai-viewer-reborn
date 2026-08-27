import { beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";

const mocks = vi.hoisted(() => ({
  loadI18nMessageBundle: vi.fn(),
  getEventsByRegionCurrent: vi.fn()
}));

vi.mock("$lib/i18n/runtime", () => ({
  getLocalI18nMessages: (namespaces: readonly string[]) => ({ namespaces }),
  loadI18nMessageBundle: mocks.loadI18nMessageBundle
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionCurrent: mocks.getEventsByRegionCurrent
}));
vi.mock("$env/dynamic/private", () => ({
  env: { SEKAI_MASTER_API_BASE_URL: "https://master.example.test///" }
}));

import { load as loadLayout } from "./+layout.server";
import { load as loadPage } from "./+page.server";

const request = (url: string) => ({
  url: new URL(url),
  cookies: { get: () => "ja-JP" },
  fetch: vi.fn()
});

const runPageLoad = (event: ReturnType<typeof request>) =>
  (loadPage as unknown as (value: ReturnType<typeof request>) => Promise<Record<string, unknown>>)(
    event
  );

const runLayoutLoad = (event: ReturnType<typeof request>) =>
  (loadLayout as unknown as (value: ReturnType<typeof request>) => Promise<Record<string, unknown>>)(
    event
  );

describe("tools-site server loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadI18nMessageBundle.mockResolvedValue({ "navigation.home": "Home" });
  });

  it("loads every tracker-supported region and parses current events", async () => {
    mocks.getEventsByRegionCurrent
      .mockResolvedValueOnce({
        data: {
          event: {
            eventId: 123,
            title: "Primary event",
            event_type: "marathon",
            unit: { unitName: "Leo/need" },
            start_at: "2026-01-01",
            aggregate_at: 456,
            closed_at: "2026-01-03",
            assetbundleName: "event_123",
            assetBundleName: "wrong-camel-case"
          }
        }
      })
      .mockResolvedValueOnce({ error: true, response: { status: 404 } })
      .mockResolvedValue({ error: true, response: { status: 404 } });

    const result = await runPageLoad(request("https://tools.test/"));

    const events = await (result.events as Promise<unknown[]>);
    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({
      region: "jp",
      status: "available",
      event: {
        id: "123",
        name: "Primary event",
        eventType: "marathon",
        unit: "Leo/need",
        assetBundleName: "event_123"
      }
    });
    expect(events[1]).toEqual({ region: "tw", status: "unavailable", event: null });
    expect(mocks.getEventsByRegionCurrent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: { region: "jp" }, signal: expect.any(AbortSignal) })
    );
    expect(mocks.getEventsByRegionCurrent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: { region: "tw" }, signal: expect.any(AbortSignal) })
    );
    expect(mocks.getEventsByRegionCurrent).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: { region: "cn" } })
    );
  });

  it("keeps malformed and failed API responses distinct", async () => {
    mocks.getEventsByRegionCurrent
      .mockResolvedValueOnce({ data: { title: "missing id" } })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ error: true, response: { status: 404 } });

    const result = await runPageLoad(request("https://tools.test/"));

    const events = await (result.events as Promise<{ status: string }[]>);
    expect(events[0].status).toBe("unavailable");
    expect(events[1].status).toBe("failed");
  });

  it("returns the current-event collection as an unresolved stream", async () => {
    const resolveRequests: Array<(value: unknown) => void> = [];
    mocks.getEventsByRegionCurrent.mockImplementation(
      () => new Promise((resolve) => resolveRequests.push(resolve))
    );

    const loaded = await runPageLoad(request("https://tools.test/"));
    expect(loaded.events).toBeInstanceOf(Promise);

    for (const resolveRequest of resolveRequests) {
      resolveRequest({ error: true, response: { status: 404 } });
    }
    await expect(loaded.events as Promise<unknown[]>).resolves.toHaveLength(4);
  });

  it("aborts a stalled regional request at the bounded deadline", async () => {
    vi.useFakeTimers();
    mocks.getEventsByRegionCurrent.mockImplementation(
      ({ path, signal }: { path: { region: string }; signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error(`${path.region} timed out`)));
        })
    );

    const result = runPageLoad(request("https://tools.test/"));
    await vi.advanceTimersByTimeAsync(5_000);

    const loaded = await result;
    expect((await (loaded.events as Promise<{ status: string }[]>)).every((event) => event.status === "failed")).toBe(true);
    vi.useRealTimers();
  });

  it("uses local messages when the remote i18n bundle fails", async () => {
    mocks.loadI18nMessageBundle.mockRejectedValueOnce(new Error("offline"));

    const result = await runLayoutLoad(request("https://tools.test/"));

    expect(result.uiLocale).toBe("ja-JP");
    expect(result.i18nMessages).toEqual({ namespaces: ["common", "tracker"] });
    expect(result.siteVersion).toBe(packageJson.version);
  });
});
