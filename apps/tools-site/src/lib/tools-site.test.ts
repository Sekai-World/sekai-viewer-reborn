import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
  env: {
    SEKAI_API_BASE_URL: " https://api.example.test/api/// ",
    SEKAI_MASTER_API_BASE_URL: " https://master.example.test/api/v1/// "
  }
}));

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_SEKAI_I18N_BASE_URL: " https://i18n.example.test/// " }
}));

vi.mock("$app/environment", () => ({ browser: false }));

import { repoLocaleByUiLocale, supportedUiLocales } from "$lib/i18n/config";
import { DEFAULT_UI_LOCALE, normalizeUiLocale } from "$lib/i18n/region";
import {
  createI18nTranslator,
  getLocalI18nMessages,
  loadI18nMessageBundle,
  toolsSiteI18nNamespaces
} from "$lib/i18n/runtime";
import {
  normalizeRegion,
  supportedRegions,
  trackerSupportedRegions
} from "$lib/regions";
import { getMasterApiBaseUrl, getSekaiApiBaseUrl } from "$lib/server/config";

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
    expect(supportedUiLocales).toContain("zh-TW");
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("en-GB")).toBe("en");
    expect(normalizeUiLocale("zh")).toBe("zh-CN");
    expect(normalizeUiLocale("ja-JP")).toBe("ja-JP");
    expect(normalizeUiLocale("unsupported", "ko-KR")).toBe("ko-KR");
    expect(normalizeUiLocale(undefined)).toBe("en");
  });

  it("maps UI locales to repository locales", () => {
    expect(repoLocaleByUiLocale).toEqual({
      en: "en",
      "ja-JP": "ja",
      "ko-KR": "ko",
      "zh-CN": "zh-CN",
      "zh-TW": "zh-TW"
    });
  });
});

describe("tools-site i18n runtime", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads local namespace messages and translates them", async () => {
    expect(toolsSiteI18nNamespaces).toEqual(["common", "server", "tracker"]);
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
});

describe("tools-site server configuration", () => {
  it("normalizes only the Sekai API legacy /api suffix", () => {
    expect(getSekaiApiBaseUrl()).toBe("https://api.example.test");
    expect(getMasterApiBaseUrl()).toBe("https://master.example.test/api/v1");
  });
});
