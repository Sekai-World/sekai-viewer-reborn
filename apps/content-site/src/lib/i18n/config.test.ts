import { describe, expect, it } from "vitest";
import { repoLocaleByUiLocale, supportedUiLocales, uiLocaleNameByCode } from "./config";

describe("content-site UI locale registry", () => {
  it("provides a non-empty native display label for every supported locale", () => {
    expect(supportedUiLocales).toHaveLength(29);
    expect(Object.keys(uiLocaleNameByCode)).toEqual(supportedUiLocales);
    expect(Object.values(uiLocaleNameByCode).every((label) => label.length > 0)).toBe(true);
  });

  it("keeps the legacy UI codes mapped to their existing repository directory names", () => {
    expect(repoLocaleByUiLocale["ja-JP"]).toBe("ja");
    expect(repoLocaleByUiLocale["ko-KR"]).toBe("ko");
    expect(repoLocaleByUiLocale["zh-CN"]).toBe("zh-CN");
    expect(repoLocaleByUiLocale["zh-TW"]).toBe("zh-TW");
  });
});
