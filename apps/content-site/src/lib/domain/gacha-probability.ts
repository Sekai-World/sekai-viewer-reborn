import type { GachaCardRarityRate, GachaDetailSub } from "$lib/domain/gacha-detail";

export type GachaProbabilityCardMetadata = {
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
};

export type GachaProbabilityDiagnostic =
  | "none"
  | "missing-card-id"
  | "missing-card-rarity"
  | "unsupported-lottery-type"
  | "unmatched-card-semantics"
  | "invalid-weight"
  | "invalid-rate"
  | "rate-conflict"
  | "empty-pool"
  | "incomplete-metadata"
  | "invalid-rate-choice";

export type GachaProbabilitySegment = {
  lotteryType: string;
  probability: number | null;
  selectCount: number | null;
  conditional: boolean;
};

export type GachaRateChoiceWishGroup = {
  lotteryType: string | null;
  selectCount: number | null;
  cardIds: readonly string[];
};

export type GachaProbabilityCard = GachaDetailSub & GachaProbabilityCardMetadata & {
  probability: number | null;
  probabilityByLotteryType: Record<string, number | null>;
  probabilitySegments: GachaProbabilitySegment[];
  diagnostic: GachaProbabilityDiagnostic;
};

const normalize = (value: string | null): string | null => value?.trim().toLowerCase() || null;
const NORMAL_LOTTERY_TYPES = new Set(["normal", "categorized_wish"]);
const RATE_CHOICE_LOTTERY_PREFIX = "rate_choice_";

type RateSegment = {
  lotteryType: string;
  rate: number | null;
  diagnostic: "invalid-rate" | "rate-conflict" | null;
  conditional: boolean;
};

type AggregatedGachaDetail = GachaDetailSub & { hasInvalidWeight: boolean };
type NormalizedRateChoiceWishGroup = {
  lotteryType: string;
  selectCount: number;
  cardIds: Set<string>;
};

const getSegmentKey = (rarity: string, lotteryType: string): string => `${rarity}\u0000${lotteryType}`;

const isRateChoiceLotteryType = (lotteryType: string | null): lotteryType is string =>
  lotteryType?.startsWith(RATE_CHOICE_LOTTERY_PREFIX) ?? false;

const isSupportedLotteryType = (lotteryType: string | null): lotteryType is string =>
  lotteryType !== null && (NORMAL_LOTTERY_TYPES.has(lotteryType) || isRateChoiceLotteryType(lotteryType));

const getPositiveInteger = (value: number | null): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const getBaseLotteryType = (detail: GachaDetailSub): string | null =>
  detail.isWish === true ? "categorized_wish" : detail.isWish === false ? "normal" : null;

const buildRateSegments = (rates: GachaCardRarityRate[]): Map<string, RateSegment> => {
  const segments = new Map<string, RateSegment>();

  for (const row of rates) {
    const rarity = normalize(row.cardRarityType);
    const lotteryType = normalize(row.lotteryType);
    if (!rarity || !isSupportedLotteryType(lotteryType)) {
      continue;
    }

    const key = getSegmentKey(rarity, lotteryType);
    const rate = typeof row.rate === "number" && Number.isFinite(row.rate) && row.rate > 0 ? row.rate : null;
    const previous = segments.get(key);
    if (!previous) {
      segments.set(key, {
        lotteryType,
        rate,
        diagnostic: rate === null ? "invalid-rate" : null,
        conditional: isRateChoiceLotteryType(lotteryType)
      });
    } else if (previous.diagnostic || rate === null) {
      segments.set(key, { ...previous, rate: null, diagnostic: "invalid-rate" });
    } else if (previous.rate !== rate) {
      segments.set(key, { ...previous, rate: null, diagnostic: "rate-conflict" });
    }
  }

  return segments;
};

const aggregateDetails = (details: GachaDetailSub[]): AggregatedGachaDetail[] => {
  const aggregated = new Map<string, AggregatedGachaDetail>();
  let missingIdIndex = 0;

  for (const detail of details) {
    const key = detail.cardId
      ? `${detail.cardId}\u0000${String(detail.isWish)}`
      : `missing-${missingIdIndex++}\u0000${String(detail.isWish)}`;
    const validWeight = typeof detail.weight === "number" && Number.isFinite(detail.weight) && detail.weight > 0;
    const current = aggregated.get(key);

    if (!current) {
      aggregated.set(key, {
        ...detail,
        weight: validWeight ? detail.weight : null,
        hasInvalidWeight: !validWeight
      });
      continue;
    }

    current.hasInvalidWeight ||= !validWeight;
    if (validWeight) {
      current.weight = (current.weight ?? 0) + (detail.weight ?? 0);
    }
  }

  return [...aggregated.values()];
};

const validateRateChoiceWishGroups = ({
  groups,
  rates,
  wishSelectCount
}: {
  groups: readonly GachaRateChoiceWishGroup[];
  rates: ReadonlyMap<string, RateSegment>;
  wishSelectCount?: number | null;
}): { groups: NormalizedRateChoiceWishGroup[]; diagnostic: "invalid-rate-choice" | null } => {
  const activeLotteryTypes = new Set(
    [...rates.values()]
      .filter((rate) => rate.conditional)
      .map((rate) => rate.lotteryType)
  );

  if (activeLotteryTypes.size === 0) {
    return { groups: [], diagnostic: null };
  }

  const expectedSelectCount = getPositiveInteger(wishSelectCount ?? null);
  if (expectedSelectCount === null) {
    return { groups: [], diagnostic: "invalid-rate-choice" };
  }

  const byLotteryType = new Map<string, NormalizedRateChoiceWishGroup>();
  let invalid = false;

  for (const group of groups) {
    const lotteryType = normalize(group.lotteryType);
    const selectCount = getPositiveInteger(group.selectCount);
    const cardIds = new Set(group.cardIds.map((id) => id.trim()).filter((id) => id.length > 0));

    if (!isRateChoiceLotteryType(lotteryType) || selectCount === null || cardIds.size === 0) {
      invalid = true;
      continue;
    }

    if (!activeLotteryTypes.has(lotteryType)) {
      invalid = true;
      continue;
    }

    const existing = byLotteryType.get(lotteryType);
    if (existing) {
      if (existing.selectCount !== selectCount) {
        invalid = true;
        continue;
      }
      for (const cardId of cardIds) {
        existing.cardIds.add(cardId);
      }
      continue;
    }

    byLotteryType.set(lotteryType, { lotteryType, selectCount, cardIds });
  }

  for (const lotteryType of activeLotteryTypes) {
    if (!byLotteryType.has(lotteryType)) {
      invalid = true;
    }
  }

  const normalizedGroups = [...byLotteryType.values()];
  const selectCountTotal = normalizedGroups.reduce((sum, group) => sum + group.selectCount, 0);
  if (selectCountTotal !== expectedSelectCount) {
    invalid = true;
  }

  if (normalizedGroups.some((group) => group.selectCount > group.cardIds.size)) {
    invalid = true;
  }

  return invalid
    ? { groups: [], diagnostic: "invalid-rate-choice" }
    : { groups: normalizedGroups, diagnostic: null };
};

const buildRateChoiceGroupsByCardId = (
  groups: readonly NormalizedRateChoiceWishGroup[]
): Map<string, NormalizedRateChoiceWishGroup[]> => {
  const byCardId = new Map<string, NormalizedRateChoiceWishGroup[]>();

  for (const group of groups) {
    for (const cardId of group.cardIds) {
      byCardId.set(cardId, [...(byCardId.get(cardId) ?? []), group]);
    }
  }

  return byCardId;
};

export const buildGachaProbabilityCards = ({
  details,
  rates,
  metadata,
  incompleteSegments,
  rateChoiceWishGroups,
  wishSelectCount
}: {
  details: GachaDetailSub[];
  rates: GachaCardRarityRate[];
  metadata: ReadonlyMap<string, GachaProbabilityCardMetadata>;
  incompleteSegments?: ReadonlySet<string>;
  rateChoiceWishGroups?: readonly GachaRateChoiceWishGroup[];
  wishSelectCount?: number | null;
}): GachaProbabilityCard[] => {
  const segments = buildRateSegments(rates);
  const aggregated = aggregateDetails(details);
  const { groups: rateChoiceGroups, diagnostic: rateChoiceConfigDiagnostic } = validateRateChoiceWishGroups({
    groups: rateChoiceWishGroups ?? [],
    rates: segments,
    wishSelectCount
  });
  const rateChoiceGroupsByCardId = buildRateChoiceGroupsByCardId(rateChoiceGroups);

  const pools = new Map<string, number>();
  for (const detail of aggregated) {
    const rarity = normalize(detail.cardId ? metadata.get(detail.cardId)?.rarityType ?? null : null);
    const lotteryType = getBaseLotteryType(detail);
    const segment = rarity && lotteryType ? segments.get(getSegmentKey(rarity, lotteryType)) : undefined;
    if (rarity && lotteryType && segment && segment.rate !== null && detail.weight !== null) {
      const key = getSegmentKey(rarity, lotteryType);
      pools.set(key, (pools.get(key) ?? 0) + detail.weight);
    }
  }

  return aggregated.map((detail) => {
    const card = detail.cardId ? metadata.get(detail.cardId) : undefined;
    const rarity = normalize(card?.rarityType ?? null);
    const lotteryType = getBaseLotteryType(detail);
    const probabilityByLotteryType: Record<string, number | null> = {};
    const probabilitySegments: GachaProbabilitySegment[] = [];
    let probability: number | null = null;
    let unresolvedBaseSegment = false;
    let diagnostic: GachaProbabilityDiagnostic = !detail.cardId
      ? "missing-card-id" : !rarity ? "missing-card-rarity"
      : detail.hasInvalidWeight || detail.weight === null ? "invalid-weight" : "none";

    if (lotteryType && rarity) {
      probabilityByLotteryType[lotteryType] = null;
      const segmentKey = getSegmentKey(rarity, lotteryType);
      const segment = segments.get(segmentKey);
      if (incompleteSegments?.has(segmentKey) && diagnostic === "none") diagnostic = "incomplete-metadata";
      else if (segment?.diagnostic) diagnostic = diagnostic === "none" ? segment.diagnostic : diagnostic;
      else if (segment?.rate !== null && segment) {
        const denominator = pools.get(segmentKey) ?? 0;
        probability = denominator > 0 && detail.weight !== null
          ? (segment.rate * detail.weight) / denominator : null;
        probabilityByLotteryType[lotteryType] = probability;
        probabilitySegments.push({ lotteryType, probability, selectCount: null, conditional: false });
        if (probability === null && diagnostic === "none") diagnostic = "empty-pool";
      } else {
        unresolvedBaseSegment = true;
      }
    }

    if (detail.cardId && detail.isWish === true && rarity) {
      if (rateChoiceConfigDiagnostic) {
        const hasRateChoiceForRarity = rates.some((rate) =>
          normalize(rate.cardRarityType) === rarity && isRateChoiceLotteryType(normalize(rate.lotteryType))
        );
        if (hasRateChoiceForRarity && diagnostic === "none" && probabilitySegments.length === 0) {
          diagnostic = rateChoiceConfigDiagnostic;
        }
      } else {
        for (const group of rateChoiceGroupsByCardId.get(detail.cardId) ?? []) {
          const segmentKey = getSegmentKey(rarity, group.lotteryType);
          const segment = segments.get(segmentKey);
          probabilityByLotteryType[group.lotteryType] = null;
          if (incompleteSegments?.has(segmentKey)) {
            if (diagnostic === "none" && probabilitySegments.length === 0) diagnostic = "incomplete-metadata";
            continue;
          }
          if (segment?.diagnostic) {
            if (diagnostic === "none" && probabilitySegments.length === 0) diagnostic = segment.diagnostic;
            continue;
          }
          if (!segment || segment.rate === null) {
            continue;
          }

          const conditionalProbability = segment.rate / group.selectCount;
          probabilityByLotteryType[group.lotteryType] = conditionalProbability;
          probabilitySegments.push({
            lotteryType: group.lotteryType,
            probability: conditionalProbability,
            selectCount: group.selectCount,
            conditional: true
          });
        }
      }
    }

    if (diagnostic === "none" && probabilitySegments.length === 0) {
      if (rateChoiceConfigDiagnostic && detail.isWish === true && rarity && rates.some((rate) =>
        normalize(rate.cardRarityType) === rarity && isRateChoiceLotteryType(normalize(rate.lotteryType)))) {
        diagnostic = rateChoiceConfigDiagnostic;
      } else if (unresolvedBaseSegment) {
        const hasRelevantUnsupportedRate = rates.some((rate) => {
          const rateLotteryType = normalize(rate.lotteryType);
          return normalize(rate.cardRarityType) === rarity && rateLotteryType !== null && !isSupportedLotteryType(rateLotteryType);
        });
        diagnostic = hasRelevantUnsupportedRate ? "unsupported-lottery-type" : "unmatched-card-semantics";
      } else if (Object.keys(probabilityByLotteryType).length === 0) {
        diagnostic = segments.size === 0 && rates.some((rate) => rate.lotteryType)
          ? "unsupported-lottery-type" : "unmatched-card-semantics";
      }
    }

    return {
      ...detail, ...card, title: card?.title ?? null, assetBundleName: card?.assetBundleName ?? null,
      attr: card?.attr ?? null, rarityType: card?.rarityType ?? null,
      probability, probabilityByLotteryType, probabilitySegments, diagnostic
    };
  });
};
