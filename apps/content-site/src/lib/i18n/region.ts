import { supportedUiLocales, type SupportedUiLocale } from "$lib/i18n/config";
import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";

export const UI_LOCALE_COOKIE_NAME = "content_site_ui_locale";
export const PREFERRED_REGION_STORAGE_KEY = "content_site_preferred_region";

export const DEFAULT_REGION: SupportedRegion = "jp";
export const DEFAULT_UI_LOCALE: SupportedUiLocale = "zh-CN";

export const normalizeRegion = (
  value: string | null | undefined,
  fallback: SupportedRegion = DEFAULT_REGION
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

  if (value === "en-US" || value === "en-GB") {
    return "en";
  }

  // Legacy: old locale cookie or external caller may send bare "zh"
  // instead of the correct "zh-CN". Normalize it.
  if (value === "zh") {
    return "zh-CN";
  }

  return supportedUiLocales.includes(value as SupportedUiLocale)
    ? (value as SupportedUiLocale)
    : fallback;
};

export const resolvePreferredRegion = (): SupportedRegion => {
  if (typeof window === "undefined") {
    return DEFAULT_REGION;
  }

  return normalizeRegion(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY), DEFAULT_REGION);
};

export const persistPreferredRegion = (region: SupportedRegion): void => {
  localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, region);
};
