import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
  env: { SEKAI_MASTER_API_BASE_URL: " https://master.example.test/// " }
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
import { normalizeRegion, supportedRegions } from "$lib/regions";
import { getMasterApiBaseUrl } from "$lib/server/config";

describe("tools-site region and locale helpers", () => {
  it("normalizes supported regions and falls back for invalid values", () => {
    expect(supportedRegions).toEqual(["jp", "en", "tw", "kr", "cn"]);
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
    expect(toolsSiteI18nNamespaces).toEqual(["common", "comparison", "server"]);
    const messages = getLocalI18nMessages(["common", "comparison"]);

    expect(messages).toMatchObject({
      "navigation.home": "Home",
      "comparison.title": expect.any(String)
    });
    const translator = createI18nTranslator("en", messages);
    expect(translator("comparison.title")).toBe(messages["comparison.title"]);
    await expect(loadI18nMessageBundle("en", ["common"])).resolves.toMatchObject({
      "navigation.home": "Home"
    });
  });
});

describe("tools-site server configuration", () => {
  it("trims and removes trailing slashes from the master API URL", () => {
    expect(getMasterApiBaseUrl()).toBe("https://master.example.test");
  });
});
