import {
  getCardsByRegionById,
  getGachasByRegionById,
  getGachasRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import type { GachaDetail, GachaPickup } from "$lib/domain/gacha-detail";
import { parseGachaDetail } from "$lib/server/gacha-detail";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseCardDetail } from "$lib/server/card-detail";
import type { PageServerLoad } from "./$types";

type RegionGachaLookup = {
  region: SupportedRegion;
  gacha: GachaDetail | null;
  exists: boolean;
};

type GachaPickupCard = GachaPickup & {
  title: string | null;
  assetBundleName: string | null;
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
  currentLookupPromise,
  invalidGachaIdMessage
}: {
  baseUrl: string;
  currentLookupPromise: Promise<RegionGachaLookup>;
  invalidGachaIdMessage: string | null;
}): Promise<GachaPayload> => {
  if (invalidGachaIdMessage) {
    return {
      gacha: null,
      error: invalidGachaIdMessage,
      pickupCards: []
    };
  }

  try {
    const currentLookup = await currentLookupPromise;
    const pickupCards = await Promise.all(
      currentLookup.gacha?.gachaPickups.map(async (pickup) => {
        if (!pickup.cardId) {
          return {
            ...pickup,
            title: null,
            assetBundleName: null
          };
        }

        try {
          const response = await getCardsByRegionById({
            baseUrl,
            path: { region: currentLookup.region, id: pickup.cardId }
          });

          if (response.error) {
            return {
              ...pickup,
              title: null,
              assetBundleName: null
            };
          }

          const card = parseCardDetail(response.data);
          return {
            ...pickup,
            title: card?.title ?? null,
            assetBundleName: card?.assetBundleName ?? null
          };
        } catch {
          return {
            ...pickup,
            title: null,
            assetBundleName: null
          };
        }
      }) ?? []
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
  const gachaId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [invalidGachaIdMessage, gachaUnavailableInCurrentRegionMessage, failedToLoadGachaDataMessage] =
    await Promise.all([
      getServerI18nText(uiLocale, "invalidGachaId", fetch),
      getServerI18nText(uiLocale, "gachaUnavailableInCurrentRegion", fetch),
      getServerI18nText(uiLocale, "failedToLoadGachaData", fetch)
    ]);
  const region: SupportedRegion = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const currentLookupPromise = gachaId
    ? fetchRegionGacha(baseUrl, region, gachaId)
    : Promise.resolve({ region, gacha: null, exists: false } satisfies RegionGachaLookup);

  return {
    gachaId,
    region,
    regionLabel: regionLabels[region],
    gachaUnavailableInCurrentRegionMessage,
    failedToLoadGachaDataMessage,
    availableRegions: gachaId
      ? fetchAvailableRegions({
          baseUrl,
          gachaId,
          region,
          currentLookupPromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    gachaPayload: fetchGachaPayload({
      baseUrl,
      currentLookupPromise,
      invalidGachaIdMessage: gachaId ? null : invalidGachaIdMessage
    })
  };
};
