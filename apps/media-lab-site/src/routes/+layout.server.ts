import {
  getLocalI18nMessages,
  loadI18nMessageBundle,
  mediaLabI18nNamespaces
} from "$lib/i18n/runtime";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { fetchGlobalNotices } from "$lib/server/notifications";
import { resolveI18nMessageBundle } from "@platform/i18n-runtime";
import packageJson from "../../package.json";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const localMessages = getLocalI18nMessages(mediaLabI18nNamespaces);
  const i18nMessages = await resolveI18nMessageBundle(
    () => loadI18nMessageBundle(uiLocale, mediaLabI18nNamespaces),
    localMessages
  );

  return {
    i18nMessages,
    uiLocale,
    globalNotices: await fetchGlobalNotices(fetch),
    siteVersion: packageJson.version
  };
};
