import { parseCostumeListQuery } from "#lib/domain/costume.js";
import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchCostumeListPage } from "#lib/server/costumes.js";
import { fetchMissionCharacterOptions } from "#lib/server/mission-characters.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = parseCostumeListQuery(url.searchParams);
  const baseUrl = getMasterApiBaseUrl();
  // Both stream; a failed request resolves to null so the page can show its error state.
  const catalogue = fetchCostumeListPage(baseUrl, region, query).catch(() => null);
  const characters = fetchMissionCharacterOptions(baseUrl, region).catch(() => null);

  return { region, query, catalogue, characters };
};
