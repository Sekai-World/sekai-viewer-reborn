import {
  repoLocaleByUiLocale,
  supportedUiLocales,
  type SupportedUiLocale
} from "@platform/i18n-runtime";

export { repoLocaleByUiLocale, supportedUiLocales };
export type { SupportedUiLocale };

export const uiLocaleNameByCode: Record<SupportedUiLocale, string> = {
  en: "English",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文"
};
