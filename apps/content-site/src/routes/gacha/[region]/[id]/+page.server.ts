import { error } from "@sveltejs/kit";
import {
  getCardsByRegionById,
  getGachasByRegionById,
  getGachasRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "#lib/i18n/runtime.js";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "#lib/i18n/region.js";
import { regionLabels, supportedRegions, type SupportedRegion } from "#lib/domain/regions.js";
import type { GachaDetail, GachaPickup } from "#lib/domain/gacha-detail.js";
import { parseGachaDetail } from "#lib/server/gacha-detail.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { parseRouteId } from "#lib/route-id.js";
import { parseCardDetail } from "#lib/server/card-detail.js";
import type { PageServerLoad } from "./$types";

type RegionGachaLookup = {
  region: SupportedRegion;
  gacha: GachaDetail | null;
  exists: boolean;
};

type GachaPickupCard = GachaPickup & {
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  initialSpecialTrainingStatus: string | null;
};

type GachaPayload = {
  gacha: GachaDetail | null;
  error: string | null;
  pickupCards: GachaPickupCard[];
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

const fetchRegionGacha = async (
  baseUrl: string,
  region: SupportedRegion,
  gachaId: string
): Promise<RegionGachaLookup> => {
  try {
    const response = await getGachasByRegionById({
      baseUrl,
      path: { region, id: gachaId }
    });

    if (response.error) {
      return {
        region,
        gacha: null,
        exists: false
      };
    }

    const gacha = parseGachaDetail(response.data);
    return {
      region,
      gacha,
      exists: gacha !== null
    };
  } catch {
    return {
      region,
      gacha: null,
      exists: false
    };
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  gachaId,
  region,
  currentLookupPromise
}: {
  baseUrl: string;
  gachaId: string;
  region: SupportedRegion;
  currentLookupPromise: Promise<RegionGachaLookup>;
}): Promise<SupportedRegion[]> => {
  try {
    const [currentLookup, availabilityResponse] = await Promise.all([
      currentLookupPromise,
      getGachasRegionsByIdAvailability({
        baseUrl,
        path: { id: gachaId }
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

const fetchGachaPayload = async ({
  baseUrl,
  currentLookupPromise
}: {
  baseUrl: string;
  currentLookupPromise: Promise<RegionGachaLookup>;
}): Promise<GachaPayload> => {
  try {
    const enrichCard = async (
      cardId: string | null,
      region: SupportedRegion
    ): Promise<{
      title: string | null;
      assetBundleName: string | null;
      attr: string | null;
      rarityType: string | null;
      initialSpecialTrainingStatus: string | null;
    }> => {
      const empty = {
        title: null,
        assetBundleName: null,
        attr: null,
        rarityType: null,
        initialSpecialTrainingStatus: null
      } as const;
      if (!cardId) return { ...empty };

      try {
        const response = await getCardsByRegionById({
          baseUrl,
          path: { region, id: cardId }
        });
        if (response.error) return { ...empty };

        const card = parseCardDetail(response.data);
        return {
          title: card?.title ?? null,
          assetBundleName: card?.assetBundleName ?? null,
          attr: card?.attr ?? null,
          rarityType: card?.rarityType ?? null,
          initialSpecialTrainingStatus: card?.initialSpecialTrainingStatus ?? null
        };
      } catch {
        return { ...empty };
      }
    };

    const currentLookup = await currentLookupPromise;

    const pickupCards = await Promise.all(
      currentLookup.gacha?.gachaPickups.map(async (pickup) => ({
        ...pickup,
        ...(await enrichCard(pickup.cardId, currentLookup.region))
      })) ?? []
    );

    return {
      gacha: currentLookup.gacha,
      error: null,
      pickupCards
    };
  } catch {
    return {
      gacha: null,
      error: null,
      pickupCards: []
    };
  }
};

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  if (parseRouteId(params.id) === null) error(404, "Not found");
  const gachaId = params.id;
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [gachaUnavailableInCurrentRegionMessage, failedToLoadGachaDataMessage] = await Promise.all([
    getServerI18nText(uiLocale, "gachaUnavailableInCurrentRegion", fetch),
    getServerI18nText(uiLocale, "failedToLoadGachaData", fetch)
  ]);
  const region: SupportedRegion = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const currentLookupPromise = fetchRegionGacha(baseUrl, region, gachaId);

  return {
    gachaId,
    region,
    regionLabel: regionLabels[region],
    gachaUnavailableInCurrentRegionMessage,
    failedToLoadGachaDataMessage,
    availableRegions: fetchAvailableRegions({
      baseUrl,
      gachaId,
      region,
      currentLookupPromise
    }),
    gachaPayload: fetchGachaPayload({
      baseUrl,
      currentLookupPromise
    })
  };
};
