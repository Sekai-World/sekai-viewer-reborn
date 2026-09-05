import type { GachaDetailSub } from "$lib/domain/gacha-detail";

export const GACHA_CARD_METADATA_BATCH_SIZE = 100;

export type PullCardMetadata = {
  cardId: string;
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
};

export type PullPoolCard = {
  cardId: string;
  cardRarityType: string;
  weight: number;
  isWish: boolean | null;
};

export type CardBatchRequest = {
  baseUrl: string;
  path: { region: string };
  query: { ids: string };
};

export type CardBatchResponse = {
  data?: unknown;
  error?: unknown;
};

export type FetchCardBatch = (options: CardBatchRequest) => Promise<CardBatchResponse>;

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const normalizeCardId = (cardId: string | null): string | null => cardId?.trim() || null;

const parseCardMetadataItem = (value: unknown): PullCardMetadata | null => {
  const card = getObject(value);
  if (!card) {
    return null;
  }

  const cardId = getStringLike(card.id);
  if (!cardId) {
    return null;
  }

  const cardRarity = getObject(card.cardRarity);

  return {
    cardId,
    title: pickFirstString(card, ["prefix"]),
    assetBundleName: pickFirstString(card, ["assetbundleName", "assetBundleName"]),
    attr: pickFirstString(card, ["attr", "attribute"]),
    rarityType:
      (cardRarity ? pickFirstString(cardRarity, ["cardRarityType"]) : null) ??
      pickFirstString(card, ["rarityType", "cardRarityType", "card_rarity_type"])
  };
};

const getItems = (value: unknown): unknown[] => {
  let current = getObject(value);

  for (let depth = 0; current && depth < 3; depth += 1) {
    if (Array.isArray(current.items)) {
      return current.items;
    }
    current = getObject(current.data);
  }

  return [];
};

export const parseCardMetadataResponse = (payload: unknown): PullCardMetadata[] =>
  getItems(payload)
    .map(parseCardMetadataItem)
    .filter((card): card is PullCardMetadata => card !== null);

export const getGachaCardIds = (gachaDetails: readonly GachaDetailSub[]): string[] => [
  ...new Set(
    gachaDetails
      .map((detail) => normalizeCardId(detail.cardId))
      .filter((cardId): cardId is string => cardId !== null)
  )
];

export const chunkCardIds = (
  cardIds: readonly string[],
  chunkSize = GACHA_CARD_METADATA_BATCH_SIZE
): string[][] => {
  const chunks: string[][] = [];

  for (let index = 0; index < cardIds.length; index += chunkSize) {
    chunks.push(cardIds.slice(index, index + chunkSize));
  }

  return chunks;
};

const getResponsePayload = (response: CardBatchResponse): unknown => {
  const root = getObject(response);
  return root?.data ?? response;
};

export const fetchGachaCardMetadata = async ({
  baseUrl,
  region,
  gachaDetails,
  fetchBatch
}: {
  baseUrl: string;
  region: string;
  gachaDetails: readonly GachaDetailSub[];
  fetchBatch: FetchCardBatch;
}): Promise<Map<string, PullCardMetadata>> => {
  const cardIds = getGachaCardIds(gachaDetails);
  const requestedCardIds = new Set(cardIds);
  const metadata = new Map<string, PullCardMetadata>();

  await Promise.all(
    chunkCardIds(cardIds).map(async (ids) => {
      try {
        const response = await fetchBatch({
          baseUrl,
          path: { region },
          query: { ids: ids.join(",") }
        });

        if (response.error) {
          return;
        }

        for (const card of parseCardMetadataResponse(getResponsePayload(response))) {
          if (requestedCardIds.has(card.cardId)) {
            metadata.set(card.cardId, card);
          }
        }
      } catch {
        // A failed batch must not discard metadata returned by other batches.
      }
    })
  );

  return metadata;
};

export const buildRarityPools = (
  gachaDetails: readonly GachaDetailSub[],
  metadata: ReadonlyMap<string, PullCardMetadata>
): Map<string, PullPoolCard[]> => {
  const pools = new Map<string, PullPoolCard[]>();

  for (const detail of gachaDetails) {
    const cardId = normalizeCardId(detail.cardId);
    const rarityType = cardId ? metadata.get(cardId)?.rarityType : null;
    if (!cardId || !rarityType) {
      continue;
    }

    const poolCard: PullPoolCard = {
      cardId,
      cardRarityType: rarityType,
      weight: detail.weight ?? 0,
      isWish: detail.isWish
    };
    const pool = pools.get(rarityType);
    if (pool) {
      pool.push(poolCard);
    } else {
      pools.set(rarityType, [poolCard]);
    }
  }

  return pools;
};
