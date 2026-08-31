import { getLocalI18nMessages, loadI18nMessageBundle } from "$lib/i18n/runtime";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { fetchGlobalNotices } from "$lib/server/notifications";
import packageJson from "../../package.json";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const namespaces = ["common"] as const;
  const localMessages = getLocalI18nMessages(namespaces);
  let i18nMessages = localMessages;

  try {
    i18nMessages = {
      ...localMessages,
      ...(await loadI18nMessageBundle(uiLocale, namespaces))
    };
  } catch {
    // Local source messages keep the shell usable if message loading fails.
  }

  return {
    i18nMessages,
    uiLocale,
    globalNotices: await fetchGlobalNotices(fetch),
    siteVersion: packageJson.version
  };
};
