import { describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";

vi.mock("$lib/server/notifications", () => ({
  fetchGlobalNotices: vi.fn().mockResolvedValue([])
}));

vi.mock("$lib/story/story-resolver.server", () => ({
  getStoryAssetBase: () => "https://storage.example.test"
}));

import { getLocalI18nMessages, mediaLabI18nNamespaces } from "$lib/i18n/runtime";
import { DEFAULT_UI_LOCALE, UI_LOCALE_COOKIE_NAME, supportedUiLocales } from "$lib/i18n/region";
import { load } from "../routes/+layout.server";

describe("media-lab-site layout server load", () => {
  it("passes localized messages, locale, notices, the package version, and the asset base to the site layout", async () => {
    const loadEvent = {
      cookies: { get: vi.fn().mockReturnValue(undefined) },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0];

    await expect(load(loadEvent)).resolves.toEqual({
      globalNotices: [],
      i18nMessages: getLocalI18nMessages(mediaLabI18nNamespaces),
      uiLocale: DEFAULT_UI_LOCALE,
      siteVersion: packageJson.version,
      assetBase: "https://storage.example.test"
    });
    expect(loadEvent.cookies.get).toHaveBeenCalledWith(UI_LOCALE_COOKIE_NAME);
  });

  it("normalizes the persisted UI locale cookie", async () => {
    const loadEvent = {
      cookies: { get: vi.fn().mockReturnValue("zh") },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0];

    await expect(load(loadEvent)).resolves.toMatchObject({ uiLocale: "zh-CN" });
  });

  it("passes every supported locale cookie through to the layout unchanged", async () => {
    for (const locale of supportedUiLocales) {
      const loadEvent = {
        cookies: { get: vi.fn().mockReturnValue(locale) },
        fetch: vi.fn()
      } as unknown as Parameters<typeof load>[0];

      await expect(load(loadEvent)).resolves.toMatchObject({ uiLocale: locale });
    }
  });

  it("falls back to the default locale for unsupported cookie values", async () => {
    const loadEvent = {
      cookies: { get: vi.fn().mockReturnValue("fr-FR") },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0];

    await expect(load(loadEvent)).resolves.toMatchObject({ uiLocale: DEFAULT_UI_LOCALE });
  });
});
