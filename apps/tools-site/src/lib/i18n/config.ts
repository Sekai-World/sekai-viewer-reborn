export const supportedUiLocales = ["en", "ja-JP", "ko-KR", "zh-CN", "zh-TW"] as const;

export type SupportedUiLocale = (typeof supportedUiLocales)[number];

export const repoLocaleByUiLocale: Record<SupportedUiLocale, string> = {
  en: "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW"
};
