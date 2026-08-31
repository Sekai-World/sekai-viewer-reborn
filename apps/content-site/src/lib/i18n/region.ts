import { type SupportedUiLocale } from "$lib/i18n/config";
import { normalizeUiLocale as normalizeSharedUiLocale } from "@platform/i18n-runtime";
import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";

export const UI_LOCALE_COOKIE_NAME = "content_site_ui_locale";
export const PREFERRED_REGION_STORAGE_KEY = "content_site_preferred_region";
export const PREFERRED_REGION_CHANGE_EVENT = "content-site-preferred-region-change";

const LEGACY_HOME_REGION_STORAGE_KEY = "home-region";

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
): SupportedUiLocale => normalizeSharedUiLocale(value, fallback);

export const resolvePreferredRegion = (): SupportedRegion => {
  if (typeof window === "undefined") {
    return DEFAULT_REGION;
  }

  const persistedRegion = localStorage.getItem(PREFERRED_REGION_STORAGE_KEY);
  if (persistedRegion !== null) {
    return normalizeRegion(persistedRegion, DEFAULT_REGION);
  }

  const legacyHomeRegion = localStorage.getItem(LEGACY_HOME_REGION_STORAGE_KEY);
  if (legacyHomeRegion === null) {
    return DEFAULT_REGION;
  }

  const migratedRegion = normalizeRegion(legacyHomeRegion, DEFAULT_REGION);
  persistPreferredRegion(migratedRegion);
  localStorage.removeItem(LEGACY_HOME_REGION_STORAGE_KEY);
  return migratedRegion;
};

export const persistPreferredRegion = (region: SupportedRegion): void => {
  localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, region);
  window.dispatchEvent(
    new CustomEvent<SupportedRegion>(PREFERRED_REGION_CHANGE_EVENT, { detail: region })
  );
};
