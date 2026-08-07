import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("loads the selected regions and parses current events", async () => {
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
            closed_at: "2026-01-03"
          }
        }
      })
      .mockResolvedValueOnce({ error: true, response: { status: 404 } });

    const result = await runPageLoad(request("https://tools.test/?primary= EN &secondary=kr"));

    expect(result.primaryRegion).toBe("en");
    expect(result.secondaryRegion).toBe("kr");
    const comparison = result.comparison as { primary: unknown; secondary: unknown };
    expect(comparison.primary).toMatchObject({
      region: "en",
      status: "available",
      event: { id: "123", name: "Primary event", eventType: "marathon", unit: "Leo/need" }
    });
    expect(comparison.secondary).toEqual({ region: "kr", status: "unavailable", event: null });
  });

  it("keeps malformed and failed API responses distinct", async () => {
    mocks.getEventsByRegionCurrent
      .mockResolvedValueOnce({ data: { title: "missing id" } })
      .mockRejectedValueOnce(new Error("network"));

    const result = await runPageLoad(request("https://tools.test/?primary=jp&secondary=en"));

    const comparison = result.comparison as { primary: { status: string }; secondary: { status: string } };
    expect(comparison.primary.status).toBe("unavailable");
    expect(comparison.secondary.status).toBe("failed");
  });

  it("uses local messages when the remote i18n bundle fails", async () => {
    mocks.loadI18nMessageBundle.mockRejectedValueOnce(new Error("offline"));

    const result = await runLayoutLoad(request("https://tools.test/"));

    expect(result.uiLocale).toBe("ja-JP");
    expect(result.i18nMessages).toEqual({ namespaces: ["common", "comparison"] });
  });
});
