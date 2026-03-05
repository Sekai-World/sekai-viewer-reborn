export const supportedUiLocales = [
  "en-US",
  "en-GB",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW"
] as const;

export type SupportedUiLocale = (typeof supportedUiLocales)[number];

export const repoLocaleByUiLocale: Record<SupportedUiLocale, string> = {
  "en-US": "en",
  "en-GB": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW"
};

export const uiLocaleNameByCode: Record<SupportedUiLocale, string> = {
  "en-US": "American English",
  "en-GB": "British English",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文"
};
