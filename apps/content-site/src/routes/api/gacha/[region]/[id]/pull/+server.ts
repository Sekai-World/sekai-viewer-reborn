import { json } from "@sveltejs/kit";
import { getCardsByRegionBatch, getGachasByRegionById } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseGachaDetail } from "$lib/server/gacha-detail";
import { getSecureRandomUnit } from "$lib/server/secure-random";
import type { RequestHandler } from "./$types";
import {
  getGuaranteeLevel,
  isRarityAtLeast,
  parsePullRequestBody,
  resolveSelectedBehavior
} from "./pull-behavior";
import { buildRarityPools, fetchGachaCardMetadata, type PullPoolCard } from "./pull-pool";

type PulledGachaCard = {
  cardId: string;
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  initialSpecialTrainingStatus: string | null;
};

type RarityRateEntry = {
  cardRarityType: string;
  rate: number;
  pool: PullPoolCard[];
  totalWeight: number;
};

const weightedPick = <T extends { weight: number }>(pool: T[], totalWeight: number): T | null => {
  if (totalWeight <= 0 || pool.length === 0) return null;
  const rand = getSecureRandomUnit() * totalWeight;
  let cumulative = 0;
  for (const item of pool) {
    cumulative += item.weight;
    if (rand < cumulative) return item;
  }
  return pool[pool.length - 1] ?? null;
};

const appendWeightedPick = (pulledCardIds: string[], entry: RarityRateEntry): void => {
  const picked = weightedPick(entry.pool, entry.totalWeight);
  pulledCardIds.push(picked?.cardId ?? "");
};

const buildCumulativeRates = (rates: RarityRateEntry[]): number[] => {
  const cumulative: number[] = [];
  let sum = 0;
  for (const entry of rates) {
    sum += entry.rate;
    cumulative.push(sum);
  }
  return cumulative;
};

const rollRarity = (cumulativeRates: number[]): number => {
  const roll = getSecureRandomUnit() * 100;
  return cumulativeRates.findIndex((cuml) => roll < cuml);
};

export const POST: RequestHandler = async ({ params, request }) => {
  const region = normalizeRegion(params.region);
  const gachaId = params.id?.trim() ?? "";

  if (!gachaId) {
    return json({ error: "missing_gacha_id" }, { status: 400 });
  }

  let body: ReturnType<typeof parsePullRequestBody>;
  try {
    body = parsePullRequestBody(await request.json());
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
      path: { region, id: gachaId }
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

    if (pool.every((detail) => !detail.cardId?.trim())) {
      return json({ error: "empty_pool" }, { status: 422 });
    }

    const metadata = await fetchGachaCardMetadata({
      baseUrl,
      region,
      gachaDetails: pool,
      fetchBatch: getCardsByRegionBatch
    });
    const cardMetaMap = new Map<string, PulledGachaCard>(
      [...metadata.entries()].map(([cardId, card]) => [
        cardId,
        {
          ...card,
          title: card.title ?? `#${cardId}`
        }
      ])
    );
    const rarityPools = buildRarityPools(pool, metadata);

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
          totalWeight: pool_.reduce((sum, c) => sum + c.weight, 0)
        };
      })
      .filter((entry) => entry.pool.length > 0 && entry.totalWeight > 0);

    if (rarityEntries.length === 0) {
      return json({ error: "no_valid_rarity_pool" }, { status: 422 });
    }

    const selectedBehavior = resolveSelectedBehavior(
      gacha.gachaBehaviors,
      body.behaviorType,
      body.spinnableType
    );
    const guaranteeLevel = getGuaranteeLevel(selectedBehavior);
    const isGuarantee = guaranteeLevel > 0;

    // Guarantee rates: remove below-guarantee rarities, then rescale
    // remaining rates proportionally so they sum to 100.
    // E.g. for over_rarity_3_once with rates [★1:80, ★2:10, ★3:8, ★4:2],
    // guarantee rates become [0, 0, 80, 20] — ★3 and ★4 keep their
    // relative ratio 8:2, scaled to fill 100%.
    const normalCumulative = buildCumulativeRates(rarityEntries);
    let guaranteeCumulative: number[] = normalCumulative;

    if (isGuarantee && guaranteeLevel > 0) {
      const atOrAbove = rarityEntries.filter((e) =>
        isRarityAtLeast(e.cardRarityType, guaranteeLevel)
      );
      const atOrAboveSum = atOrAbove.reduce((sum, e) => sum + e.rate, 0);

      if (atOrAboveSum > 0) {
        const grs = rarityEntries.map((entry) => {
          if (!isRarityAtLeast(entry.cardRarityType, guaranteeLevel)) return 0;
          return (entry.rate / atOrAboveSum) * 100;
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
          appendWeightedPick(pulledCardIds, entry);
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
        appendWeightedPick(pulledCardIds, entry);

        if (isGuarantee) {
          if (!isRarityAtLeast(rarityEntries[rarityIdx].cardRarityType, guaranteeLevel)) {
            noGuaranteeCount++;
          }
        }
      } else {
        // Fallback: pick from first valid pool
        const entry = rarityEntries[0];
        appendWeightedPick(pulledCardIds, entry);
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
          initialSpecialTrainingStatus: meta?.initialSpecialTrainingStatus ?? null
        } satisfies PulledGachaCard;
      });

    return json({ results });
  } catch {
    return json({ error: "internal_error" }, { status: 500 });
  }
};
