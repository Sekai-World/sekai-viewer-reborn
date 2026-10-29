import { getLocalI18nMessages, loadI18nMessageBundle } from "#lib/i18n/runtime.js";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "#lib/i18n/region.js";
import { fetchGlobalNotices } from "#lib/server/notifications.js";
import { resolveI18nMessageBundle } from "@platform/i18n-runtime";
import packageJson from "../../package.json";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const namespaces = ["common", "tracker"] as const;
  const localMessages = getLocalI18nMessages(namespaces);
  const [i18nMessages, globalNotices] = await Promise.all([
    resolveI18nMessageBundle(
      () => loadI18nMessageBundle(uiLocale, namespaces, fetch),
      localMessages
    ),
    fetchGlobalNotices(fetch)
  ]);

  return {
    i18nMessages,
    uiLocale,
    globalNotices,
    siteVersion: packageJson.version
  };
};
