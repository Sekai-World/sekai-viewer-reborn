import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_LOCALE,
  UI_LOCALE_COOKIE_MAX_AGE_SECONDS,
  UI_LOCALE_COOKIE_NAME,
  buildUiLocaleCookie,
  normalizeUiLocale,
  supportedUiLocales
} from "./region";

describe("media-lab-site ui locale region module", () => {
  it("keeps the documented cookie name and lifetime contract", () => {
    expect(UI_LOCALE_COOKIE_NAME).toBe("media_lab_site_ui_locale");
    expect(UI_LOCALE_COOKIE_MAX_AGE_SECONDS).toBe(31_536_000);
  });

  it("offers every shared UI locale with English as the default", () => {
    expect(supportedUiLocales).toHaveLength(29);
    expect(DEFAULT_UI_LOCALE).toBe("en");
  });

  it("normalizes locale values through the shared helper", () => {
    expect(normalizeUiLocale("ja-JP")).toBe("ja-JP");
    expect(normalizeUiLocale("zh")).toBe("zh-CN");
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("fr-FR")).toBe("fr");
    expect(normalizeUiLocale("ar")).toBe("ar");
    expect(normalizeUiLocale("JA_jp")).toBe("ja-JP");
    expect(normalizeUiLocale("xx")).toBe(DEFAULT_UI_LOCALE);
    expect(normalizeUiLocale(undefined)).toBe(DEFAULT_UI_LOCALE);
  });

  it("builds a path-scoped SameSite cookie for every supported locale", () => {
    for (const locale of supportedUiLocales) {
      expect(buildUiLocaleCookie(locale)).toBe(
        `${UI_LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${UI_LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
      );
    }
  });
});
