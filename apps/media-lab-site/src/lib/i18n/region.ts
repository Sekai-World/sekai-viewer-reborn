import {
  normalizeUiLocale as normalizeSharedUiLocale,
  type SupportedUiLocale as SharedSupportedUiLocale
} from "@platform/i18n-runtime";

export const supportedUiLocales = [
  "en",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW"
] as const satisfies readonly SharedSupportedUiLocale[];
export type SupportedUiLocale = (typeof supportedUiLocales)[number];

export const DEFAULT_UI_LOCALE: SupportedUiLocale = "en";

const isSupportedUiLocale = (locale: SharedSupportedUiLocale): locale is SupportedUiLocale =>
  supportedUiLocales.some((supportedLocale) => supportedLocale === locale);

export const normalizeUiLocale = (
  value: string | null | undefined,
  fallback: SupportedUiLocale = DEFAULT_UI_LOCALE
): SupportedUiLocale => {
  const normalizedLocale = normalizeSharedUiLocale(value, fallback);
  return isSupportedUiLocale(normalizedLocale) ? normalizedLocale : fallback;
};

export const UI_LOCALE_COOKIE_NAME = "media_lab_site_ui_locale";
export const UI_LOCALE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/**
 * Builds the persisted UI-locale cookie value. The cookie is path-scoped to the
 * whole site and SameSite=Lax, so the SSR layout load observes the selection on
 * the next navigation. Writing it stays a client-side `document.cookie`
 * assignment; this builder is pure so the shape stays unit-testable.
 */
export const buildUiLocaleCookie = (locale: SupportedUiLocale): string =>
  `${UI_LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${UI_LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
