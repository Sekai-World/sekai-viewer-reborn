import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nMessages } from "@platform/i18n-runtime";
import { getLocalI18nMessages, type I18nNamespace } from "$lib/i18n/runtime";
import packageJson from "../../package.json";

const { loadI18nMessageBundle } = vi.hoisted(() => ({
  loadI18nMessageBundle: vi.fn<
    (locale: string, namespaces: readonly I18nNamespace[], fetcher?: typeof fetch) => Promise<I18nMessages>
  >()
}));

vi.mock("$lib/i18n/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("$lib/i18n/runtime")>()),
  loadI18nMessageBundle
}));

const { fetchGlobalNotices } = vi.hoisted(() => ({
  fetchGlobalNotices: vi.fn()
}));

vi.mock("$lib/server/notifications", () => ({
  fetchGlobalNotices
}));

import { load } from "../routes/+layout.server";

const createLoadEvent = (pathname: string, locale = "en") =>
  ({
    cookies: { get: vi.fn().mockReturnValue(locale) },
    fetch: vi.fn(),
    url: new URL(`https://viewer.test${pathname}`)
  }) as unknown as Parameters<typeof load>[0];

describe("content-site layout server load", () => {
  beforeEach(() => {
    fetchGlobalNotices.mockResolvedValue([]);
  });

  it("returns the remote route bundle for the selected locale", async () => {
    const messages = { eventDetailTitle: "Event details" };
    loadI18nMessageBundle.mockResolvedValueOnce(messages);

    await expect(load(createLoadEvent("/event/jp/123", "en-US"))).resolves.toEqual({
      i18nMessages: messages,
      uiLocale: "en",
      globalNotices: [],
      siteVersion: packageJson.version
    });
    expect(loadI18nMessageBundle).toHaveBeenCalledWith(
      "en",
      ["common", "event", "error"],
      expect.any(Function)
    );
  });

  it("loads the unit namespace for unit detail routes", async () => {
    loadI18nMessageBundle.mockResolvedValueOnce({ unitRosterTitle: "Members" });

    await expect(load(createLoadEvent("/unit/jp/idol"))).resolves.toEqual({
      i18nMessages: { unitRosterTitle: "Members" },
      uiLocale: "en",
      globalNotices: [],
      siteVersion: packageJson.version
    });
    expect(loadI18nMessageBundle).toHaveBeenCalledWith(
      "en",
      ["common", "unit", "error"],
      expect.any(Function)
    );
  });

  it("returns local route messages when remote bundle loading fails", async () => {
    loadI18nMessageBundle.mockRejectedValueOnce(new Error("dictionary unavailable"));

    await expect(load(createLoadEvent("/cards/jp"))).resolves.toEqual({
      i18nMessages: getLocalI18nMessages(["common", "card", "event", "error"]),
      uiLocale: "en",
      globalNotices: [],
      siteVersion: packageJson.version
    });
  });

  it("returns local route messages when remote bundle loading exceeds the deadline", async () => {
    vi.useFakeTimers();
    loadI18nMessageBundle.mockReturnValueOnce(new Promise(() => {}));

    const result = load(createLoadEvent("/musics/jp"));
    await vi.advanceTimersByTimeAsync(2_500);

    await expect(result).resolves.toEqual({
      i18nMessages: getLocalI18nMessages(["common", "music", "error"]),
      uiLocale: "en",
      globalNotices: [],
      siteVersion: packageJson.version
    });
  });

  it("includes global notices fetched from the notifications feed", async () => {
    const notices = [
      { id: "maintenance", version: 1, severity: "info" as const, title: "Watch", message: "Here" }
    ];
    fetchGlobalNotices.mockResolvedValueOnce(notices);
    loadI18nMessageBundle.mockResolvedValueOnce({});

    const event = createLoadEvent("/cards/jp");
    await expect(load(event)).resolves.toEqual({
      i18nMessages: {},
      uiLocale: "en",
      globalNotices: notices,
      siteVersion: packageJson.version
    });
    expect(fetchGlobalNotices).toHaveBeenCalledWith(event.fetch);
  });

  it("keeps rendering with empty notices when the notifications feed is unavailable", async () => {
    // fetchGlobalNotices never rejects: an unavailable feed resolves to [].
    fetchGlobalNotices.mockResolvedValueOnce([]);
    loadI18nMessageBundle.mockResolvedValueOnce({});

    await expect(load(createLoadEvent("/"))).resolves.toEqual({
      i18nMessages: {},
      uiLocale: "en",
      globalNotices: [],
      siteVersion: packageJson.version
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
