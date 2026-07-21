import {
  getCardsByRegionList,
  getGameCharactersByRegionById,
  getGameCharactersRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { loadI18nMessageBundle } from "$lib/i18n/runtime";
import type { SupportedRegion } from "$lib/domain/regions";
import { supportedRegions } from "$lib/domain/regions";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  normalizeCharacterAvailability,
  parseRelatedCharacterCards
} from "$lib/server/character-detail";
import { parseCharacter, parseCharacterUnits } from "$lib/server/character-list";
import { aggregateGameCharacterUnitsByRegion } from "$lib/server/character-pages";
import type { PageServerLoad } from "./$types";

type CharacterPayload = { character: unknown; loadFailed: boolean };

const supportedRegionSet = new Set<SupportedRegion>(supportedRegions);

const characterExistsInRegion = async (
  baseUrl: string,
  region: SupportedRegion,
  characterId: string
): Promise<boolean> => {
  try {
    const response = await getGameCharactersByRegionById({
      baseUrl,
      path: { region, id: characterId }
    });
    if (response.error || response.data == null) {
      return false;
    }

    const root =
      response.data !== null &&
      typeof response.data === "object" &&
      !Array.isArray(response.data)
        ? (response.data as Record<string, unknown>)
        : null;
    const id = root?.id;
    return (
      (typeof id === "number" && Number.isFinite(id)) ||
      (typeof id === "string" && id.trim().length > 0)
    );
  } catch {
    return false;
  }
};

const resolveAvailableRegions = async ({
  baseUrl,
  characterId,
  region,
  payloadPromise
}: {
  baseUrl: string;
  characterId: string;
  region: SupportedRegion;
  payloadPromise: Promise<CharacterPayload>;
}): Promise<SupportedRegion[]> => {
  try {
    const [payloadResult, availabilityResponse] = await Promise.all([
      payloadPromise,
      getGameCharactersRegionsByIdAvailability({
        baseUrl,
        path: { id: characterId }
      })
    ]);

    let detectedRegions = availabilityResponse.error
      ? []
      : normalizeCharacterAvailability(availabilityResponse.data).filter(
          (item): item is SupportedRegion => supportedRegionSet.has(item as SupportedRegion)
        );

    if (detectedRegions.length === 0) {
      const probes = await Promise.all(
        supportedRegions.map(async (candidate) =>
          (await characterExistsInRegion(baseUrl, candidate, characterId)) ? candidate : null
        )
      );
      detectedRegions = probes.filter((item): item is SupportedRegion => item !== null);
    }

    const currentExists = payloadResult.character !== null && !payloadResult.loadFailed;
    if (currentExists && !detectedRegions.includes(region)) {
      return [region, ...detectedRegions];
    }

    return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

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
            page_size: 12,
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
    ? resolveAvailableRegions({
        baseUrl,
        characterId,
        region,
        payloadPromise: payload
      })
    : Promise.resolve([region]);

  payload.catch(() => {});
  availableRegions.catch(() => {});
  return { region, characterId, i18nMessages, payload, availableRegions };
};
