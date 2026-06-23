import type { LayoutServerLoad } from "./$types";
import { loadI18nMessageBundle, type I18nNamespace } from "$lib/i18n";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/region";

const getRouteI18nNamespaces = (pathname: string): readonly I18nNamespace[] => {
  if (pathname.startsWith("/card/") || pathname.startsWith("/cards/")) {
    return ["common", "card"];
  }

  if (pathname.startsWith("/musics/")) {
    return ["common", "music"];
  }

  if (pathname.startsWith("/event/") || pathname.startsWith("/events/")) {
    return ["common", "event"];
  }

  return pathname === "/" ? ["common", "home"] : ["common", "error"];
};

export const load: LayoutServerLoad = async ({ cookies, fetch, url }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));

  return {
    i18nMessages: await loadI18nMessageBundle(
      uiLocale,
      getRouteI18nNamespaces(url.pathname),
      fetch
    ),
    uiLocale
  };
};
