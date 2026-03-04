import {
  supportedRegions,
  supportedUiLocales,
  type SupportedRegion,
  type SupportedUiLocale
} from "@platform/i18n-dicts";

export const PRIMARY_REGION_COOKIE_NAME = "content_site_primary_region";
export const SECONDARY_REGION_COOKIE_NAME = "content_site_secondary_region";
export const UI_LOCALE_COOKIE_NAME = "content_site_ui_locale";

export const DEFAULT_PRIMARY_REGION: SupportedRegion = "jp";
export const DEFAULT_SECONDARY_REGION: SupportedRegion = "en";
export const DEFAULT_UI_LOCALE: SupportedUiLocale = "zh-CN";

export const normalizeRegion = (
  value: string | null | undefined,
  fallback: SupportedRegion = DEFAULT_PRIMARY_REGION
): SupportedRegion => {
  if (!value) {
    return fallback;
  }

  return supportedRegions.includes(value as SupportedRegion)
    ? (value as SupportedRegion)
    : fallback;
};

export const normalizeUiLocale = (
  value: string | null | undefined,
  fallback: SupportedUiLocale = DEFAULT_UI_LOCALE
): SupportedUiLocale => {
  if (!value) {
    return fallback;
  }

  return supportedUiLocales.includes(value as SupportedUiLocale)
    ? (value as SupportedUiLocale)
    : fallback;
};
