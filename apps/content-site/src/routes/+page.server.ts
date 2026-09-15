import { getServerI18nText } from "$lib/i18n/runtime";
import {
  DEFAULT_REGION,
  normalizeRegion,
  normalizeUiLocale,
  PREFERRED_REGION_COOKIE_NAME,
  UI_LOCALE_COOKIE_NAME
} from "$lib/i18n/region";
import { getVersions } from "@platform/sekai-master-api-sdk";
import {
  loadHomeLatestData,
  loadHomeNews,
  loadHomeRegionEventCard,
  parseVersionsByRegion,
  type VersionsByRegion
} from "$lib/server/home-page-data";
import { getMasterApiBaseUrl } from "$lib/server/config";
import type { PageServerLoad } from "./$types";

const loadVersionsByRegion = async (baseUrl: string): Promise<VersionsByRegion> => {
  try {
    const response = await getVersions({ baseUrl });
    if (response.error) {
      return {};
    }

    return parseVersionsByRegion(response.data);
  } catch {
    return {};
  }
};

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const baseUrl = getMasterApiBaseUrl();
  const [[homeEventDataUnavailable, homeEventDataRequestFailed], versionsByRegion] =
    await Promise.all([
      Promise.all([
        getServerI18nText(uiLocale, "homeEventDataUnavailable", fetch),
        getServerI18nText(uiLocale, "homeEventDataRequestFailed", fetch)
      ]),
      loadVersionsByRegion(baseUrl)
    ]);
  const initialRegion = normalizeRegion(cookies.get(PREFERRED_REGION_COOKIE_NAME), DEFAULT_REGION);
  const initialCard = loadHomeRegionEventCard({
    baseUrl,
    region: initialRegion,
    unavailableErrorText: homeEventDataUnavailable,
    requestFailedErrorText: homeEventDataRequestFailed
  });
  const initialLatestData = loadHomeLatestData(baseUrl, initialRegion);
  const initialNews = loadHomeNews(initialRegion);

  return {
    initialRegion,
    initialCard,
    initialLatestData,
    initialNews,
    versionsByRegion,
    currentEventLoadFailedMessage: homeEventDataRequestFailed
  };
};
