import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/env/private", () => ({
  SEKAI_API_BASE_URL: " https://api.example.test/api/// ",
  SEKAI_MASTER_API_BASE_URL: " https://master.example.test/api/v1/// "
}));

vi.mock("$app/env/public", () => ({
  PUBLIC_SEKAI_I18N_BASE_URL: " https://i18n.example.test/// "
}));

vi.mock("$app/env", () => ({ browser: false, dev: false }));

import { repoLocaleByUiLocale, supportedUiLocales } from "#lib/i18n/config.js";
import { buildUiLocaleCookie, DEFAULT_UI_LOCALE, normalizeUiLocale } from "#lib/i18n/region.js";
import {
  createI18nTranslator,
  getLocalI18nMessages,
  loadI18nMessageBundle,
  toolsSiteI18nNamespaces
} from "#lib/i18n/runtime.js";
import { normalizeRegion, supportedRegions, trackerSupportedRegions } from "#lib/regions.js";
import { getMasterApiBaseUrl, getSekaiApiBaseUrl } from "#lib/server/config.js";

describe("tools-site region and locale helpers", () => {
  it("normalizes supported regions and falls back for invalid values", () => {
    expect(supportedRegions).toEqual(["jp", "en", "tw", "kr", "cn"]);
    expect(trackerSupportedRegions).toEqual(["jp", "tw", "en", "kr"]);
    expect(normalizeRegion(" EN ", "jp")).toBe("en");
    expect(normalizeRegion("unknown", "jp")).toBe("jp");
    expect(normalizeRegion(null, "en")).toBe("en");
  });

  it("normalizes browser locale aliases and preserves supported locales", () => {
    expect(DEFAULT_UI_LOCALE).toBe("en");
    expect(supportedUiLocales).toHaveLength(29);
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("en-GB")).toBe("en");
    expect(normalizeUiLocale("zh")).toBe("zh-CN");
    expect(normalizeUiLocale("ja-JP")).toBe("ja-JP");
    expect(normalizeUiLocale("unsupported", "ko-KR")).toBe("ko-KR");
    expect(normalizeUiLocale("fr-FR")).toBe("fr");
    expect(normalizeUiLocale("ar")).toBe("ar");
    expect(normalizeUiLocale("pt_br")).toBe("pt-BR");
    expect(normalizeUiLocale(undefined)).toBe("en");
  });

  it("maps UI locales to repository locales", () => {
    expect(Object.keys(repoLocaleByUiLocale)).toEqual(supportedUiLocales);
    expect(repoLocaleByUiLocale).toMatchObject({
      en: "en",
      fr: "fr",
      "ja-JP": "ja",
      "ko-KR": "ko",
      "zh-CN": "zh-CN",
      "zh-TW": "zh-TW"
    });
  });

  it("builds a site-wide SameSite cookie for the selected locale", () => {
    expect(buildUiLocaleCookie("ar")).toBe(
      "tools_site_ui_locale=ar; Path=/; Max-Age=31536000; SameSite=Lax"
    );
  });
});

describe("tools-site i18n runtime", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads local namespace messages and translates them", async () => {
    expect(toolsSiteI18nNamespaces).toEqual(["common", "server", "tracker", "music-recommender"]);
    const messages = getLocalI18nMessages(["common", "tracker"]);

    expect(messages).toMatchObject({
      "navigation.home": "Home",
      "navigation.eventTracker": expect.any(String),
      "home.title": expect.any(String),
      "region.jp": expect.any(String),
      "region.en": expect.any(String),
      "region.tw": expect.any(String),
      "region.kr": expect.any(String),
      "region.cn": expect.any(String),
      "tracker.title": expect.any(String)
    });
    const translator = createI18nTranslator("en", messages);
    expect(translator("home.title")).toBe(messages["home.title"]);
    await expect(loadI18nMessageBundle("en", ["common"])).resolves.toMatchObject({
      "navigation.home": "Home"
    });
  });

  it("requests the tools-site dictionary path and layers it over the English fallback", async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input.includes("/ja/tools-site/common.json")) {
        return Response.json({ "navigation.home": "ホーム" });
      }
      return new Response("Not found", { status: 404 });
    });

    const messages = await loadI18nMessageBundle("ja-JP", ["common"], fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "https://i18n.example.test/ja/tools-site/common.json",
      expect.anything()
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://i18n.example.test/en/tools-site/common.json",
      expect.anything()
    );
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/ja/common.json"))).toBe(false);
    expect(messages["navigation.home"]).toBe("ホーム");
    expect(messages["navigation.eventTracker"]).toBe(
      getLocalI18nMessages(["common"])["navigation.eventTracker"]
    );
  });

  it("falls back to local English when the remote dictionaries are unavailable", async () => {
    const fetcher = vi.fn(async () => new Response("Not found", { status: 404 }));

    await expect(loadI18nMessageBundle("fr", ["tracker"], fetcher)).resolves.toEqual(
      getLocalI18nMessages(["tracker"])
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://i18n.example.test/fr/tools-site/tracker.json",
      expect.anything()
    );
  });
});

describe("tools-site server configuration", () => {
  it("normalizes only the Sekai API legacy /api suffix", () => {
    expect(getSekaiApiBaseUrl()).toBe("https://api.example.test");
    expect(getMasterApiBaseUrl()).toBe("https://master.example.test/api/v1");
  });
});
