import { loadMysekaiDetail } from "#lib/domain/mysekai.js";
import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchCostumeOutfitDetail } from "#lib/server/costumes.js";
import { fetchMissionCharacterOptions } from "#lib/server/mission-characters.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const payload = loadMysekaiDetail(params.id, (id) =>
    fetchCostumeOutfitDetail(baseUrl, region, id)
  );
  // Only names the outfit's characters, so the page still works without it.
  const characters = fetchMissionCharacterOptions(baseUrl, region).catch(() => null);

  return { region, id: params.id, payload, characters };
};
