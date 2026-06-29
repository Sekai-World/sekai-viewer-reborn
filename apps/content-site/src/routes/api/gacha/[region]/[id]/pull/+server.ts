import { json } from "@sveltejs/kit";
import {
  getGachasByRegionById,
  getCardsByRegionById,
} from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseGachaDetail } from "$lib/server/gacha-detail";
import { parseCardDetail } from "$lib/server/card-detail";
import type { RequestHandler } from "./$types";
import type { GachaDetailSub } from "$lib/domain/gacha-detail";

type PullRequest = {
  count: number;
};

type PulledGachaCard = {
  cardId: string;
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
};

type PoolCard = {
  cardId: string;
  cardRarityType: string;
  weight: number;
};

type RarityRateEntry = {
  cardRarityType: string;
  rate: number;
  pool: PoolCard[];
  totalWeight: number;
};

const RARITY_VALUE: Record<string, number> = {
  rarity_1: 1,
  rarity_2: 2,
  rarity_3: 3,
  rarity_4: 4,
  rarity_birthday: 0,
};

const weightedPick = <T extends { weight: number }>(
  pool: T[],
  totalWeight: number
): T | null => {
  if (totalWeight <= 0 || pool.length === 0) return null;
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const item of pool) {
    cumulative += item.weight;
    if (rand < cumulative) return item;
  }
  return pool[pool.length - 1] ?? null;
};

const buildRarityPools = (
  gachaDetails: GachaDetailSub[],
  poolCards: PoolCard[]
): Map<string, PoolCard[]> => {
  const pools = new Map<string, PoolCard[]>();
  for (const detail of gachaDetails) {
    if (!detail.cardId) continue;
    const poolCard = poolCards.find((c) => c.cardId === detail.cardId);
    if (!poolCard) continue;
    const existing = pools.get(poolCard.cardRarityType);
    if (existing) {
      existing.push(poolCard);
    } else {
      pools.set(poolCard.cardRarityType, [poolCard]);
    }
  }
  return pools;
};

const buildCumulativeRates = (
  rates: RarityRateEntry[]
): number[] => {
  const cumulative: number[] = [];
  let sum = 0;
  for (const entry of rates) {
    sum += entry.rate;
    cumulative.push(sum);
  }
  return cumulative;
};

const rollRarity = (cumulativeRates: number[]): number => {
  const roll = Math.random() * 100;
  return cumulativeRates.findIndex((cuml) => roll < cuml);
};

export const POST: RequestHandler = async ({ params, request }) => {
  const region = normalizeRegion(params.region);
  const gachaId = params.id?.trim() ?? "";

  if (!gachaId) {
    return json({ error: "missing_gacha_id" }, { status: 400 });
  }

  let body: PullRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const count =
    typeof body.count === "number" && Number.isFinite(body.count)
      ? Math.min(Math.max(Math.round(body.count), 1), 10)
      : 1;

  const baseUrl = getMasterApiBaseUrl();

  try {
    const gachaResponse = await getGachasByRegionById({
      baseUrl,
      path: { region, id: gachaId },
    });

    if (gachaResponse.error) {
      return json({ error: "gacha_not_found" }, { status: 404 });
    }

    const gacha = parseGachaDetail(gachaResponse.data);
    if (!gacha) {
      return json({ error: "gacha_parse_failed" }, { status: 500 });
    }

    const pool = gacha.gachaDetails;
    if (pool.length === 0) {
      return json({ error: "empty_pool" }, { status: 422 });
    }

    // Fetch all pool card details to get cardRarityType for rarity grouping
    const uniqueCardIds = [
      ...new Set(pool.map((d) => d.cardId).filter((id): id is string => !!id)),
    ];

    const poolCards: PoolCard[] = [];
    const cardMetaMap = new Map<string, PulledGachaCard>();

    if (uniqueCardIds.length > 0) {
      const settled = await Promise.allSettled(
        uniqueCardIds.map(async (cardId) => {
          const response = await getCardsByRegionById({
            baseUrl,
            path: { region, id: cardId },
          });
          if (response.error) return { cardId, cardRarityType: null, meta: null };
          const card = parseCardDetail(response.data);
          return {
            cardId,
            cardRarityType: card?.rarityType ?? null,
            meta: card
              ? {
                  cardId: card.id,
                  title: card.title,
                  assetBundleName: card.assetBundleName,
                  attr: card.attr,
                  rarityType: card.rarityType,
                }
              : null,
          };
        })
      );

      for (const result of settled) {
        if (result.status === "fulfilled" && result.value) {
          const { cardId, cardRarityType, meta } = result.value;
          if (cardRarityType) {
            const detail = pool.find((d) => d.cardId === cardId);
            const weight = detail?.weight ?? 0;
            poolCards.push({ cardId, cardRarityType, weight });
          }
          if (meta) {
            cardMetaMap.set(cardId, meta);
          }
        }
      }
    }

    const rarityPools = buildRarityPools(pool, poolCards);

    const rarityRates = gacha.gachaCardRarityRates
      .filter((r) => r.rate !== null && r.rate > 0 && r.cardRarityType)
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

    const rarityEntries: RarityRateEntry[] = rarityRates
      .map((rate) => {
        const cardRarityType = rate.cardRarityType!;
        const pool_ = rarityPools.get(cardRarityType) ?? [];
        return {
          cardRarityType,
          rate: rate.rate ?? 0,
          pool: pool_,
          totalWeight: pool_.reduce((sum, c) => sum + c.weight, 0),
        };
      })
      .filter((entry) => entry.pool.length > 0);

    if (rarityEntries.length === 0) {
      return json({ error: "no_valid_rarity_pool" }, { status: 422 });
    }

    const guaranteeBehavior = gacha.gachaBehaviors?.find((b) =>
      b.gachaBehaviorType?.startsWith("over_rarity")
    );
    const isGuarantee = !!guaranteeBehavior;
    let guaranteeLevel = 0;
    if (guaranteeBehavior?.gachaBehaviorType === "over_rarity_4_once") {
      guaranteeLevel = 4;
    } else if (guaranteeBehavior?.gachaBehaviorType === "over_rarity_3_once") {
      guaranteeLevel = 3;
    }

    // Guarantee rates: redistribute probability from below-guarantee rarities
    // into the guarantee rarity so cumulative rates sum to 100.
    // E.g. for over_rarity_3_once with rates [★1:80, ★2:10, ★3:8, ★4:2],
    // guarantee rates become [0, 0, 98, 2] — ★3 absorbs ★1+★2 probability.
    const normalCumulative = buildCumulativeRates(rarityEntries);
    let guaranteeCumulative: number[] = normalCumulative;

    if (isGuarantee && guaranteeLevel > 0) {
      const guaranteeIdx = rarityEntries.findIndex(
        (e) => (RARITY_VALUE[e.cardRarityType] ?? 0) === guaranteeLevel
      );
      if (guaranteeIdx >= 0) {
        const grs = rarityEntries.map((e) => e.rate);
        grs[guaranteeIdx] = normalCumulative[guaranteeIdx];
        rarityEntries.forEach((entry, idx) => {
          const rarityVal = RARITY_VALUE[entry.cardRarityType] ?? 0;
          if (rarityVal < guaranteeLevel) {
            grs[idx] = 0;
          }
        });
        guaranteeCumulative = grs.reduce(
          (sum, curr) => [...sum, curr + (sum.slice(-1)[0] || 0)],
          [] as number[]
        );
      }
    }

    const pulledCardIds: string[] = [];
    let noGuaranteeCount = 0;

    for (let i = 0; i < count; i++) {
      if (i % 10 === 9 && isGuarantee && noGuaranteeCount >= 9) {
        const idx = rollRarity(guaranteeCumulative);
        if (idx >= 0 && idx < rarityEntries.length) {
          const entry = rarityEntries[idx];
          const picked = weightedPick(entry.pool, entry.totalWeight);
          pulledCardIds.push(picked?.cardId ?? "");
          noGuaranteeCount = 0;
          continue;
        }
      }

      if (i % 10 === 0) {
        noGuaranteeCount = 0;
      }

      const rarityIdx = rollRarity(normalCumulative);

      if (rarityIdx >= 0 && rarityIdx < rarityEntries.length) {
        const entry = rarityEntries[rarityIdx];
        const picked = weightedPick(entry.pool, entry.totalWeight);
        pulledCardIds.push(picked?.cardId ?? "");

        if (isGuarantee) {
          const rarityVal =
            RARITY_VALUE[rarityEntries[rarityIdx].cardRarityType] ?? 0;
          if (rarityVal < guaranteeLevel) {
            noGuaranteeCount++;
          }
        }
      } else {
        // Fallback: pick from first valid pool
        const entry = rarityEntries[0];
        const picked = weightedPick(entry.pool, entry.totalWeight);
        pulledCardIds.push(picked?.cardId ?? "");
      }
    }

    const results: PulledGachaCard[] = pulledCardIds
      .filter((id): id is string => !!id)
      .map((cardId) => {
        const meta = cardMetaMap.get(cardId);
        return {
          cardId,
          title: meta?.title ?? null,
          assetBundleName: meta?.assetBundleName ?? null,
          attr: meta?.attr ?? null,
          rarityType: meta?.rarityType ?? null,
        } satisfies PulledGachaCard;
      });

    return json({ results });
  } catch {
    return json({ error: "internal_error" }, { status: 500 });
  }
};
