import { loadI18nMessageBundle } from "$lib/i18n/runtime";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const i18nMessages = loadI18nMessageBundle(uiLocale, ["common", "comparison"], fetch);
  i18nMessages.catch(() => {});

  return { i18nMessages, uiLocale };
};
