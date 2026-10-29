import { parseMysekaiSoundtrackListQuery } from "#lib/domain/mysekai.js";
import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import {
  fetchMysekaiSoundtrackFilters,
  fetchMysekaiSoundtrackListPage
} from "#lib/server/mysekai.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = parseMysekaiSoundtrackListQuery(url.searchParams);
  const baseUrl = getMasterApiBaseUrl();
  // Both stream; a failed request resolves to null so the page can show its error state.
  const catalogue = fetchMysekaiSoundtrackListPage(baseUrl, region, query).catch(() => null);
  const filters = fetchMysekaiSoundtrackFilters(baseUrl, region).catch(() => null);

  return { region, query, catalogue, filters };
};
