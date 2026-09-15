import { type SupportedUiLocale } from "$lib/i18n/config";
import { normalizeUiLocale as normalizeSharedUiLocale } from "@platform/i18n-runtime";
import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";

export const UI_LOCALE_COOKIE_NAME = "content_site_ui_locale";
export const PREFERRED_REGION_STORAGE_KEY = "content_site_preferred_region";
export const PREFERRED_REGION_COOKIE_NAME = "content_site_preferred_region";
export const PREFERRED_REGION_CHANGE_EVENT = "content-site-preferred-region-change";

const LEGACY_HOME_REGION_STORAGE_KEY = "home-region";
const PREFERRED_REGION_COOKIE_MAX_AGE_SECONDS = 31_536_000;

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

const parseStoredRegion = (value: string | null): SupportedRegion | null => {
  if (value === null || !supportedRegions.includes(value as SupportedRegion)) {
    return null;
  }

  return value as SupportedRegion;
};

const readPreferredRegionCookie = (): SupportedRegion | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const cookiePrefix = `${PREFERRED_REGION_COOKIE_NAME}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix));
  if (!cookie) {
    return null;
  }

  try {
    return parseStoredRegion(decodeURIComponent(cookie.slice(cookiePrefix.length)));
  } catch {
    return null;
  }
};

const writePreferredRegionPersistence = (region: SupportedRegion): void => {
  localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, region);
  document.cookie = `${PREFERRED_REGION_COOKIE_NAME}=${encodeURIComponent(region)}; Path=/; Max-Age=${PREFERRED_REGION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

export const resolvePreferredRegion = (): SupportedRegion => {
  if (typeof window === "undefined") {
    return DEFAULT_REGION;
  }

  const cookieRegion = readPreferredRegionCookie();
  const persistedRegion = localStorage.getItem(PREFERRED_REGION_STORAGE_KEY);
  if (cookieRegion !== null) {
    if (persistedRegion !== cookieRegion) {
      localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, cookieRegion);
    }
    return cookieRegion;
  }

  if (persistedRegion !== null) {
    const normalizedRegion = normalizeRegion(persistedRegion, DEFAULT_REGION);
    writePreferredRegionPersistence(normalizedRegion);
    return normalizedRegion;
  }

  const legacyHomeRegion = localStorage.getItem(LEGACY_HOME_REGION_STORAGE_KEY);
  if (legacyHomeRegion === null) {
    return DEFAULT_REGION;
  }

  const migratedRegion = normalizeRegion(legacyHomeRegion, DEFAULT_REGION);
  writePreferredRegionPersistence(migratedRegion);
  localStorage.removeItem(LEGACY_HOME_REGION_STORAGE_KEY);
  return migratedRegion;
};

export const persistPreferredRegion = (region: SupportedRegion): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const normalizedRegion = normalizeRegion(region, DEFAULT_REGION);
  writePreferredRegionPersistence(normalizedRegion);
  window.dispatchEvent(
    new CustomEvent<SupportedRegion>(PREFERRED_REGION_CHANGE_EVENT, { detail: normalizedRegion })
  );
};
