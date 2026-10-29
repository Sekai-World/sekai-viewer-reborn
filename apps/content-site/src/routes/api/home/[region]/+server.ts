import { getServerI18nText } from "#lib/i18n/runtime.js";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { loadHomeRegionData } from "#lib/server/home-page-data.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies, fetch, params }) => {
  const region = normalizeRegion(params.region);
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [homeEventDataUnavailable, homeEventDataRequestFailed] = await Promise.all([
    getServerI18nText(uiLocale, "homeEventDataUnavailable", fetch),
    getServerI18nText(uiLocale, "homeEventDataRequestFailed", fetch)
  ]);

  const regionData = await loadHomeRegionData({
    baseUrl: getMasterApiBaseUrl(),
    region,
    unavailableErrorText: homeEventDataUnavailable,
    requestFailedErrorText: homeEventDataRequestFailed
  });

  return Response.json(regionData);
};
