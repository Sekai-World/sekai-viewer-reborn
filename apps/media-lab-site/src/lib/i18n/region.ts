export {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  supportedUiLocales,
  type SupportedUiLocale
} from "@platform/i18n-runtime";

import type { SupportedUiLocale } from "@platform/i18n-runtime";

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
