import type { SupportedUiLocale } from "#lib/i18n/config.js";

export { DEFAULT_UI_LOCALE, normalizeUiLocale, type SupportedUiLocale } from "#lib/i18n/config.js";

export const UI_LOCALE_COOKIE_NAME = "tools_site_ui_locale";
export const UI_LOCALE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/** Builds the site-wide, SameSite=Lax UI-locale cookie written by the language selector. */
export const buildUiLocaleCookie = (locale: SupportedUiLocale): string =>
  `${UI_LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${UI_LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
