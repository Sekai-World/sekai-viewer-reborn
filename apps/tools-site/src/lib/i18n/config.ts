import {
  normalizeUiLocale as normalizeSharedUiLocale,
  repoLocaleByUiLocale as sharedRepoLocaleByUiLocale,
  type SupportedUiLocale as SharedSupportedUiLocale
} from "@platform/i18n-runtime";

export const supportedUiLocales = ["en", "ja-JP", "ko-KR", "zh-CN", "zh-TW"] as const;
export type SupportedUiLocale = (typeof supportedUiLocales)[number];

export const DEFAULT_UI_LOCALE: SupportedUiLocale = "en";

export const repoLocaleByUiLocale = {
  en: sharedRepoLocaleByUiLocale.en,
  "ja-JP": sharedRepoLocaleByUiLocale["ja-JP"],
  "ko-KR": sharedRepoLocaleByUiLocale["ko-KR"],
  "zh-CN": sharedRepoLocaleByUiLocale["zh-CN"],
  "zh-TW": sharedRepoLocaleByUiLocale["zh-TW"]
} satisfies Record<SupportedUiLocale, string>;

const isSupportedUiLocale = (locale: SharedSupportedUiLocale): locale is SupportedUiLocale =>
  (supportedUiLocales as readonly SharedSupportedUiLocale[]).includes(locale);

export const normalizeUiLocale = (
  value: string | null | undefined,
  fallback: SupportedUiLocale = DEFAULT_UI_LOCALE
): SupportedUiLocale => {
  const normalizedLocale = normalizeSharedUiLocale(value, fallback);
  return isSupportedUiLocale(normalizedLocale) ? normalizedLocale : fallback;
};
