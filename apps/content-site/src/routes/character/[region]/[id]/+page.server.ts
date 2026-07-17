import {
  getCardsByRegionList,
  getGameCharactersByRegionById,
  getGameCharactersRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { loadI18nMessageBundle } from "$lib/i18n/runtime";
import type { SupportedRegion } from "$lib/domain/regions";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  normalizeCharacterAvailability,
  parseRelatedCharacterCards
} from "$lib/server/character-detail";
import { parseCharacter, parseCharacterUnits } from "$lib/server/character-list";
import { aggregateGameCharacterUnitsByRegion } from "$lib/server/character-pages";
import type { PageServerLoad } from "./$types";

const supportedRegionSet = new Set<SupportedRegion>(["jp", "en", "tw", "kr", "cn"]);

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const region = normalizeRegion(params.region);
  const characterId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const i18nMessages = loadI18nMessageBundle(uiLocale, ["common", "character", "card"], fetch);
  i18nMessages.catch(() => {});
  const baseUrl = getMasterApiBaseUrl();

  const payload = characterId
    ? Promise.all([
        getGameCharactersByRegionById({ baseUrl, path: { region, id: characterId } }),
        aggregateGameCharacterUnitsByRegion(baseUrl, region, "id", "asc"),
        getCardsByRegionList({
          baseUrl,
          path: { region },
          query: {
            page: 1,
            page_size: 8,
            character: characterId,
            spoiler: true,
            sort_by: "releaseAt",
            sort_order: "desc"
          }
        })
      ])
        .then(([characterResponse, unitsResult, cardsResponse]) => {
          if (characterResponse.error) return { character: null, loadFailed: false as const };
          const units = unitsResult.loadFailed ? [] : parseCharacterUnits(unitsResult.data);
          const character = parseCharacter(characterResponse.data, units);
          return {
            character: character
              ? {
                  ...character,
                  relatedCards: cardsResponse.error
                    ? []
                    : parseRelatedCharacterCards(cardsResponse.data)
                }
              : null,
            loadFailed: false as const
          };
        })
        .catch(() => ({ character: null, loadFailed: true as const }))
    : Promise.resolve({ character: null, loadFailed: false as const });

  const availableRegions = characterId
    ? getGameCharactersRegionsByIdAvailability({ baseUrl, path: { id: characterId } })
        .then((response) => {
          const regions = response.error ? [] : normalizeCharacterAvailability(response.data);
          const normalized = regions.filter((item): item is SupportedRegion =>
            supportedRegionSet.has(item as SupportedRegion)
          );
          return normalized.includes(region) ? normalized : [region, ...normalized];
        })
        .catch(() => [region])
    : Promise.resolve([region]);

  payload.catch(() => {});
  availableRegions.catch(() => {});
  return { region, characterId, i18nMessages, payload, availableRegions };
};
