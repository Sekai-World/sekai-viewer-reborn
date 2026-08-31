import { describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";

vi.mock("$lib/server/notifications", () => ({
  fetchGlobalNotices: vi.fn().mockResolvedValue([])
}));

import { getLocalI18nMessages, mediaLabI18nNamespaces } from "$lib/i18n/runtime";
import { DEFAULT_UI_LOCALE } from "$lib/i18n/region";
import { load } from "../routes/+layout.server";

describe("media-lab-site layout server load", () => {
  it("passes localized messages, locale, notices, and the package version to the site layout", async () => {
    const loadEvent = {
      cookies: { get: vi.fn().mockReturnValue(undefined) },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0];

    await expect(load(loadEvent)).resolves.toEqual({
      globalNotices: [],
      i18nMessages: getLocalI18nMessages(mediaLabI18nNamespaces),
      uiLocale: DEFAULT_UI_LOCALE,
      siteVersion: packageJson.version
    });
  });

  it("normalizes the persisted UI locale cookie", async () => {
    const loadEvent = {
      cookies: { get: vi.fn().mockReturnValue("zh") },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0];

    await expect(load(loadEvent)).resolves.toMatchObject({ uiLocale: "zh-CN" });
  });
});
