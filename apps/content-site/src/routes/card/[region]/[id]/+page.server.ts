import { dev } from "$app/environment";
import {
  getCardsByRegionById,
  getCardsByRegionByIdEpisodes,
  getCardsByRegionByIdParams,
  getCardsRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import type { CardDetail, CardDetailEpisode, CardDetailParams } from "$lib/domain/card-detail";
import {
  parseCardDetail,
  parseCardDetailEpisodes,
  parseCardDetailParams
} from "$lib/server/card-detail";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

type RegionCardLookup = {
  region: SupportedRegion;
  card: CardDetail | null;
  exists: boolean;
  rawPayloadJson: string | null;
};

type CardPayload = {
  card: CardDetail | null;
  debugCardJson: string | null;
  error: string | null;
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const normalizeAvailableRegions = (payload: unknown): SupportedRegion[] => {
  const root = getObject(payload);

  const toSupportedRegionList = (value: unknown): SupportedRegion[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (region): region is SupportedRegion =>
        typeof region === "string" && supportedRegions.includes(region as SupportedRegion)
    );
  };

  const fromRootArray = toSupportedRegionList(payload);
  if (fromRootArray.length > 0) {
    return fromRootArray;
  }

  if (!root) {
    return [];
  }

  for (const key of ["availableRegions", "regions"]) {
    const regions = toSupportedRegionList(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  const dataNode = getObject(root.data);
  if (dataNode) {
    const nestedRegions = normalizeAvailableRegions(dataNode);
    if (nestedRegions.length > 0) {
      return nestedRegions;
    }
  }

  return [];
};

const fetchRegionCard = async (
  baseUrl: string,
  region: SupportedRegion,
  cardId: string
): Promise<RegionCardLookup> => {
  try {
    const response = await getCardsByRegionById({
      baseUrl,
      path: { region, id: cardId }
    });

    if (response.error) {
      return {
        region,
        card: null,
        exists: false,
        rawPayloadJson: null
      };
    }

    const card = parseCardDetail(response.data);
    return {
      region,
      card,
      exists: card !== null,
      rawPayloadJson: JSON.stringify(response.data, null, 2)
    };
  } catch {
    return {
      region,
      card: null,
      exists: false,
      rawPayloadJson: null
    };
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  cardId,
  region,
  currentLookupPromise
}: {
  baseUrl: string;
  cardId: string;
  region: SupportedRegion;
  currentLookupPromise: Promise<RegionCardLookup>;
}): Promise<SupportedRegion[]> => {
  try {
    const [currentLookup, availabilityResponse] = await Promise.all([
      currentLookupPromise,
      getCardsRegionsByIdAvailability({
        baseUrl,
        path: { id: cardId }
      })
    ]);
    const detectedRegions = availabilityResponse.error
      ? []
      : normalizeAvailableRegions(availabilityResponse.data);

    if (currentLookup.exists && !detectedRegions.includes(region)) {
      return [region, ...detectedRegions];
    }

    return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

const fetchCardPayload = async ({
  currentLookupPromise,
  invalidCardIdMessage
}: {
  currentLookupPromise: Promise<RegionCardLookup>;
  invalidCardIdMessage: string | null;
}): Promise<CardPayload> => {
  if (invalidCardIdMessage) {
    return {
      card: null,
      debugCardJson: null,
      error: invalidCardIdMessage
    };
  }

  try {
    const currentLookup = await currentLookupPromise;
    return {
      card: currentLookup.card,
      debugCardJson: dev ? currentLookup.rawPayloadJson : null,
      error: null
    };
  } catch {
    return {
      card: null,
      debugCardJson: null,
      error: null
    };
  }
};

const fetchCardParams = async ({
  baseUrl,
  region,
  cardId,
  invalidCardIdMessage
}: {
  baseUrl: string;
  region: SupportedRegion;
  cardId: string;
  invalidCardIdMessage: string | null;
}): Promise<CardDetailParams> => {
  if (invalidCardIdMessage) {
    return parseCardDetailParams(null);
  }

  try {
    const response = await getCardsByRegionByIdParams({
      baseUrl,
      path: { region, id: cardId }
    });

    return response.error ? parseCardDetailParams(null) : parseCardDetailParams(response.data);
  } catch {
    return parseCardDetailParams(null);
  }
};

const fetchCardEpisodes = async ({
  baseUrl,
  region,
  cardId,
  invalidCardIdMessage
}: {
  baseUrl: string;
  region: SupportedRegion;
  cardId: string;
  invalidCardIdMessage: string | null;
}): Promise<CardDetailEpisode[]> => {
  if (invalidCardIdMessage) {
    return [];
  }

  try {
    const response = await getCardsByRegionByIdEpisodes({
      baseUrl,
      path: { region, id: cardId }
    });

    return response.error ? [] : parseCardDetailEpisodes(response.data);
  } catch {
    return [];
  }
};

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const cardId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [
    invalidCardIdMessage,
    cardUnavailableInCurrentRegionMessage,
    failedToLoadCardDataMessage
  ] = await Promise.all([
    getServerI18nText(uiLocale, "invalidCardId", fetch),
    getServerI18nText(uiLocale, "cardUnavailableInCurrentRegion", fetch),
    getServerI18nText(uiLocale, "failedToLoadCardData", fetch)
  ]);
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const invalidMessage = cardId ? null : invalidCardIdMessage;
  const currentLookupPromise = cardId
    ? fetchRegionCard(baseUrl, region, cardId)
    : Promise.resolve({
        region,
        card: null,
        exists: false,
        rawPayloadJson: null
      } satisfies RegionCardLookup);

  return {
    cardId,
    region,
    regionLabel: regionLabels[region],
    cardUnavailableInCurrentRegionMessage,
    failedToLoadCardDataMessage,
    availableRegions: cardId
      ? fetchAvailableRegions({
          baseUrl,
          cardId,
          region,
          currentLookupPromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    cardPayload: fetchCardPayload({
      currentLookupPromise,
      invalidCardIdMessage: invalidMessage
    }),
    params: fetchCardParams({
      baseUrl,
      region,
      cardId,
      invalidCardIdMessage: invalidMessage
    }),
    episodes: fetchCardEpisodes({
      baseUrl,
      region,
      cardId,
      invalidCardIdMessage: invalidMessage
    }),
    unitProfiles: fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap)
  };
};
