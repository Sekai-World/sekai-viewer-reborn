import type { Handle } from "@sveltejs/kit/hooks";
import { createRootHtmlLocaleTransform } from "@platform/i18n-runtime";
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  PREFERRED_REGION_COOKIE_NAME,
  UI_LOCALE_COOKIE_NAME
} from "#lib/i18n/region.js";
import { getRegionListRedirect } from "#lib/server/region-list-redirect.js";

export const handle: Handle = async ({ event, resolve }) => {
  const regionListRedirect = getRegionListRedirect(
    event.request.method,
    event.url,
    event.cookies.get(PREFERRED_REGION_COOKIE_NAME)
  );
  if (regionListRedirect) return regionListRedirect;

  const locale = normalizeUiLocale(event.cookies.get(UI_LOCALE_COOKIE_NAME), DEFAULT_UI_LOCALE);

  return resolve(event, {
    transformPageChunk: createRootHtmlLocaleTransform(locale)
  });
};
