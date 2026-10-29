import { normalizeRegion } from "#lib/i18n/region.js";
import { parseStampListQuery } from "#lib/domain/stamp.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchMissionCharacterOptions } from "#lib/server/mission-characters.js";
import { fetchStampListPage } from "#lib/server/stamps.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = parseStampListQuery(url.searchParams);
  const baseUrl = getMasterApiBaseUrl();
  // Both stream; a failed request resolves to null so the page can show its error state.
  const catalogue = fetchStampListPage(baseUrl, region, query).catch(() => null);
  const characters = fetchMissionCharacterOptions(baseUrl, region).catch(() => null);

  return { region, query, catalogue, characters };
};
