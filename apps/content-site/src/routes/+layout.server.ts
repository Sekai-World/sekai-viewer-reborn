import type { LayoutServerLoad } from "./$types";
import { loadI18nMessageBundle, type I18nNamespace } from "$lib/i18n/runtime";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";

const getRouteI18nNamespaces = (pathname: string): readonly I18nNamespace[] => {
  if (pathname.startsWith("/card/") || pathname.startsWith("/cards/")) {
    return ["common", "card", "event"];
  }

  if (pathname.startsWith("/musics/")) {
    return ["common", "music"];
  }

  if (pathname.startsWith("/event/") || pathname.startsWith("/events/")) {
    return ["common", "event"];
  }

  if (pathname.startsWith("/gacha/") || pathname.startsWith("/gachas/")) {
    return ["common", "gacha"];
  }

  return pathname === "/" ? ["common", "home"] : ["common", "error"];
};

export const load: LayoutServerLoad = async ({ cookies, fetch, url }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const i18nMessages = loadI18nMessageBundle(
    uiLocale,
    getRouteI18nNamespaces(url.pathname),
    fetch
  );
  // Prevent unhandled rejection if the stream is aborted before rendering
  i18nMessages.catch(() => {});

  return {
    i18nMessages,
    uiLocale
  };
};
