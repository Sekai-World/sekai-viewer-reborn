import { supportedUiLocales, type SupportedUiLocale } from "$lib/i18n/config";

export const UI_LOCALE_COOKIE_NAME = "tools_site_ui_locale";
export const DEFAULT_UI_LOCALE: SupportedUiLocale = "en";

export const normalizeUiLocale = (
  value: string | null | undefined,
  fallback: SupportedUiLocale = DEFAULT_UI_LOCALE
): SupportedUiLocale => {
  if (value === "en-US" || value === "en-GB") {
    return "en";
  }

  if (value === "zh") {
    return "zh-CN";
  }

  return value && supportedUiLocales.includes(value as SupportedUiLocale)
    ? (value as SupportedUiLocale)
    : fallback;
};
