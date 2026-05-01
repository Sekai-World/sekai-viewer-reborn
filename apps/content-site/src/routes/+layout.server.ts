import type { LayoutServerLoad } from "./$types";
import { loadI18nMessages } from "$lib/i18n";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/region";

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));

  return {
    commonMessages: await loadI18nMessages(uiLocale, "common", fetch),
    uiLocale
  };
};
