import {
  getCardsByRegionList,
  getGachasByRegionById,
  getGachasByRegionByIdRateChoiceWishes
} from "@platform/sekai-master-api-sdk";
import type { GachaRateChoiceWishGroup, GachaProbabilityCardMetadata } from "$lib/domain/gacha-probability";
import type { GachaDetail } from "$lib/domain/gacha-detail";
import { buildGachaProbabilityCards } from "$lib/domain/gacha-probability";
import { parseCardListPage, type CardListItem } from "$lib/server/card-list";
import { parseGachaDetail } from "$lib/server/gacha-detail";

const GACHA_CARD_METADATA_MAX_PAGES = 100;
const GACHA_PROBABILITY_CACHE_TTL_MS = 5 * 60 * 1000;
const GACHA_PROBABILITY_CACHE_MAX_ENTRIES = 32;

type ProbabilityCardMetadataResult = {
  metadata: Map<string, GachaProbabilityCardMetadata>;
  incompleteSegments: Set<string>;
};

type GachaProbabilityPayload = {
  cards: ReturnType<typeof buildGachaProbabilityCards>;
};

type CachedProbabilityPayload = {
  expiresAt: number;
  payload: GachaProbabilityPayload;
};

const probabilityCache = new Map<string, CachedProbabilityPayload>();
const probabilityInFlight = new Map<string, Promise<GachaProbabilityPayload | null>>();

const normalize = (value: string | null): string | null => value?.trim().toLowerCase() || null;

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
};

const pickFirstString = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstNumber = (source: Record<string, unknown>, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = getNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const getRateChoiceWishGroups = (
  payload: unknown,
  wishCardIds: readonly string[],
  gacha: GachaDetail
): GachaRateChoiceWishGroup[] => {
  const root = getObject(payload);
  const response = getObject(root?.data) ?? root;
  const responseGachaId = getStringLike(response?.gachaId);
  const responseGroupId = getStringLike(response?.rateChoiceGachaWishGroupId);
  const expectedGachaId = getStringLike(gacha.id);
  const source = response?.items;
  const normalizedWishCardIds = [...new Set(wishCardIds.map((id) => id.trim()).filter(Boolean))];
  const configuredLotteryTypes = new Set(
    source && Array.isArray(source)
      ? source
          .map((item) => getObject(item))
          .map((item) => item && pickFirstString(item, ["lotteryType"]))
          .filter((lotteryType): lotteryType is string => lotteryType !== null)
          .map((lotteryType) => normalize(lotteryType))
          .filter((lotteryType): lotteryType is string => lotteryType !== null)
      : []
  );

  // The endpoint identifies the configured group and its selection segments,
  // while gachaDetails.isWish identifies the cards in that group. It does not
  // assign cards to first/second slots, so every wish card remains eligible for
  // each configured conditional segment; never infer membership from ordering.
  if (
    !expectedGachaId ||
    responseGachaId !== expectedGachaId ||
    !responseGroupId ||
    !Array.isArray(source) ||
    normalizedWishCardIds.length === 0 ||
    configuredLotteryTypes.size === 0
  ) {
    return [];
  }

  return source.flatMap((item): GachaRateChoiceWishGroup[] => {
    const object = getObject(item);
    if (!object) {
      return [];
    }

    if (getStringLike(object.groupId) !== responseGroupId) {
      return [];
    }

    return [{
      lotteryType: pickFirstString(object, ["lotteryType"]),
      selectCount: pickFirstNumber(object, ["selectCount"]),
      cardIds: normalizedWishCardIds
    }];
  });
};

const getCardMetadata = (item: CardListItem): GachaProbabilityCardMetadata => ({
  title: item.prefix || null,
  assetBundleName: item.assetBundleName,
  attr: item.attr,
  rarityType: item.rarityType
});

const fetchCardMetadata = async ({
  baseUrl,
  region,
  gacha
}: {
  baseUrl: string;
  region: string;
  gacha: GachaDetail;
}): Promise<ProbabilityCardMetadataResult> => {
  const rarityTypes = [...new Set(gacha.gachaCardRarityRates
    .map((rate) => normalize(rate.cardRarityType))
    .filter((rarity): rarity is string => rarity !== null))];
  const metadataEntries = await Promise.all(
    rarityTypes.map(async (rarity) => {
      let complete = true;
      try {
        const items: CardListItem[] = [];
        let page = 1;
        let hasNext = true;
        const observedCards = new Set<string>();

        while (hasNext && page <= GACHA_CARD_METADATA_MAX_PAGES) {
          const response = await getCardsByRegionList({
            baseUrl,
            path: { region },
            query: { page, page_size: 100, rarity, spoiler: true, sort_by: "id", sort_order: "asc" }
          });
          if (response.error) {
            complete = false;
            break;
          }

          const parsed = parseCardListPage(response.data, page, 100);
          const newItems = parsed.items.filter((item) => !observedCards.has(item.id));
          if (newItems.length === 0) {
            complete = false;
            break;
          }

          newItems.forEach((item) => observedCards.add(item.id));
          items.push(...newItems);
          hasNext = parsed.pagination.hasNext;
          page += 1;
        }

        if (hasNext) {
          complete = false;
        }

        return { rarity, items, complete };
      } catch {
        return { rarity, items: [], complete: false };
      }
    })
  );

  const metadata = new Map<string, GachaProbabilityCardMetadata>();
  for (const item of metadataEntries.flatMap((entry) => entry.items)) {
    metadata.set(item.id, getCardMetadata(item));
  }

  const incompleteSegments = new Set<string>();
  for (const entry of metadataEntries) {
    const lotteryTypes = [...new Set(
      gacha.gachaCardRarityRates
        .filter((rate) => normalize(rate.cardRarityType) === entry.rarity)
        .map((rate) => normalize(rate.lotteryType))
        .filter((lotteryType): lotteryType is string => lotteryType !== null)
    )];

    for (const lotteryType of lotteryTypes) {
      const isWishSegment = lotteryType === "categorized_wish" || lotteryType.startsWith("rate_choice_");
      const key = `${entry.rarity}\u0000${lotteryType}`;
      const missingCardMetadata = gacha.gachaDetails.some(
        (detail) => detail.isWish === isWishSegment &&
          (!detail.cardId || !metadata.has(detail.cardId))
      );
      if (!entry.complete || missingCardMetadata) {
        incompleteSegments.add(key);
      }
    }
  }

  return { metadata, incompleteSegments };
};

export const buildGachaProbabilityPayload = async ({
  baseUrl,
  region,
  gacha,
  rateChoiceWishes
}: {
  baseUrl: string;
  region: string;
  gacha: GachaDetail;
  rateChoiceWishes: unknown;
}): Promise<GachaProbabilityPayload> => {
  const { metadata, incompleteSegments } = await fetchCardMetadata({ baseUrl, region, gacha });
  const wishCardIds = gacha.gachaDetails
    .filter((detail) => detail.isWish === true && detail.cardId)
    .map((detail) => detail.cardId as string);
  const rateChoiceWishGroups = getRateChoiceWishGroups(rateChoiceWishes, wishCardIds, gacha);

  return {
    cards: buildGachaProbabilityCards({
      details: gacha.gachaDetails,
      rates: gacha.gachaCardRarityRates,
      metadata,
      incompleteSegments,
      rateChoiceWishGroups,
      wishSelectCount: gacha.wishSelectCount
    })
  };
};

const fetchRateChoiceWishes = async ({
  baseUrl,
  region,
  gachaId
}: {
  baseUrl: string;
  region: string;
  gachaId: string;
}): Promise<unknown> => {
  const response = await getGachasByRegionByIdRateChoiceWishes({
    baseUrl,
    path: { region, id: gachaId }
  });
  if (response.error) {
    throw new Error("Failed to load rate-choice gacha wishes.");
  }

  // A successful but malformed response is intentionally passed to the
  // domain validator, which reports invalid-rate-choice without inventing
  // card membership or probabilities.
  return response.data;
};

const loadGachaProbabilityPayloadUncached = async ({
  baseUrl,
  region,
  gachaId
}: {
  baseUrl: string;
  region: string;
  gachaId: string;
}): Promise<GachaProbabilityPayload | null> => {
  const gachaResponse = await getGachasByRegionById({
    baseUrl,
    path: { region, id: gachaId }
  });
  if (gachaResponse.error) {
    return null;
  }

  const gacha = parseGachaDetail(gachaResponse.data);
  if (!gacha) {
    return null;
  }

  const hasRateChoiceRates = gacha.gachaCardRarityRates.some((rate) =>
    normalize(rate.lotteryType)?.startsWith("rate_choice_")
  );
  const rateChoiceWishes = hasRateChoiceRates
    ? await fetchRateChoiceWishes({ baseUrl, region, gachaId })
    : null;
  return buildGachaProbabilityPayload({ baseUrl, region, gacha, rateChoiceWishes });
};

const getProbabilityCacheKey = ({ baseUrl, region, gachaId }: {
  baseUrl: string;
  region: string;
  gachaId: string;
}): string => `${baseUrl}\u0000${region}\u0000${gachaId}`;

const pruneProbabilityCache = (now: number): void => {
  for (const [key, entry] of probabilityCache) {
    if (entry.expiresAt <= now) {
      probabilityCache.delete(key);
    }
  }

  while (probabilityCache.size > GACHA_PROBABILITY_CACHE_MAX_ENTRIES) {
    const oldestKey = probabilityCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    probabilityCache.delete(oldestKey);
  }
};

export const loadGachaProbabilityPayload = async (args: {
  baseUrl: string;
  region: string;
  gachaId: string;
}): Promise<GachaProbabilityPayload | null> => {
  const key = getProbabilityCacheKey(args);
  const now = Date.now();
  pruneProbabilityCache(now);

  const cached = probabilityCache.get(key);
  if (cached) {
    // Refresh insertion order so active entries are less likely to be evicted
    // when the bounded cache reaches its capacity.
    probabilityCache.delete(key);
    probabilityCache.set(key, cached);
    return cached.payload;
  }

  const existingRequest = probabilityInFlight.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  // Keep in-flight state bounded too. Requests beyond this small cap still
  // complete normally, but are deliberately not retained for coalescing.
  if (probabilityInFlight.size >= GACHA_PROBABILITY_CACHE_MAX_ENTRIES) {
    return loadGachaProbabilityPayloadUncached(args);
  }

  const request = loadGachaProbabilityPayloadUncached(args);
  probabilityInFlight.set(key, request);

  try {
    const payload = await request;
    if (payload) {
      probabilityCache.set(key, {
        expiresAt: Date.now() + GACHA_PROBABILITY_CACHE_TTL_MS,
        payload
      });
      pruneProbabilityCache(Date.now());
    }
    return payload;
  } finally {
    if (probabilityInFlight.get(key) === request) {
      probabilityInFlight.delete(key);
    }
  }
};
