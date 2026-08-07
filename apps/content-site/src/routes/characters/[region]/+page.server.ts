import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchUnitProfiles } from "$lib/server/unit-profiles";
import { parseCharacterList, parseCharacterUnits } from "$lib/server/character-list";
import {
  aggregateGameCharactersByRegion,
  aggregateGameCharacterUnitsByRegion
} from "$lib/server/character-pages";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const catalogue = Promise.all([
    aggregateGameCharactersByRegion(baseUrl, region, "seq", "asc"),
    aggregateGameCharacterUnitsByRegion(baseUrl, region, "id", "asc"),
    fetchUnitProfiles(baseUrl, region).catch(() => [])
  ])
    .then(([charactersResult, unitsResult, profiles]) => {
      if (charactersResult.loadFailed || unitsResult.loadFailed) {
        return { items: [], unitProfiles: {}, loadFailed: true as const };
      }
      const units = parseCharacterUnits(unitsResult.data);
      return {
        items: parseCharacterList(charactersResult.data, units),
        unitProfiles: Object.fromEntries(
          profiles.map((profile) => [profile.unit, profile.unitName])
        ),
        loadFailed: false as const
      };
    })
    .catch(() => ({ items: [], unitProfiles: {}, loadFailed: true as const }));
  catalogue.catch(() => {});
  return { region, catalogue };
};
