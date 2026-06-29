import { json } from "@sveltejs/kit";
import { getGachasByRegionById, getCardsByRegionById } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseGachaDetail } from "$lib/server/gacha-detail";
import { parseCardDetail } from "$lib/server/card-detail";
import type { RequestHandler } from "./$types";

type PullRequest = {
  count: number;
};

type PulledGachaCard = {
  cardId: string;
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  weight: number | null;
};

const weightedPull = (
  pool: { cardId: string | null; weight: number | null }[],
  totalWeight: number
): { cardId: string | null; weight: number | null } | null => {
  if (totalWeight <= 0 || pool.length === 0) return null;
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const card of pool) {
    cumulative += card.weight ?? 0;
    if (rand < cumulative) return card;
  }
  return pool[pool.length - 1] ?? null;
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

  const count = typeof body.count === "number" && Number.isFinite(body.count)
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
    const totalWeight = pool.reduce((sum, card) => sum + (card.weight ?? 0), 0);

    const pulledEntries: { cardId: string | null; weight: number | null }[] = [];
    for (let i = 0; i < count; i++) {
      const picked = weightedPull(pool, totalWeight);
      if (!picked) break;
      pulledEntries.push(picked);
    }

    const uniqueCardIds = [...new Set(pulledEntries.map((e) => e.cardId).filter((id): id is string => !!id))];

    const cardMetaMap = new Map<string, PulledGachaCard>();
    if (uniqueCardIds.length > 0) {
      const settled = await Promise.allSettled(
        uniqueCardIds.map(async (cardId) => {
          const response = await getCardsByRegionById({
            baseUrl,
            path: { region, id: cardId }
          });
          if (response.error) return { cardId, meta: null };
          const card = parseCardDetail(response.data);
          return {
            cardId,
            meta: card
              ? {
                  cardId: card.id,
                  title: card.title,
                  assetBundleName: card.assetBundleName,
                  attr: card.attr,
                  rarityType: card.rarityType,
                  weight: null
                }
              : null
          };
        })
      );

      for (const result of settled) {
        if (result.status === "fulfilled" && result.value.meta) {
          cardMetaMap.set(result.value.cardId, result.value.meta);
        }
      }
    }

    const results: PulledGachaCard[] = pulledEntries
      .map((entry) => {
        if (!entry.cardId) return null;
        const base = cardMetaMap.get(entry.cardId);
        return {
          cardId: entry.cardId,
          title: base?.title ?? null,
          assetBundleName: base?.assetBundleName ?? null,
          attr: base?.attr ?? null,
          rarityType: base?.rarityType ?? null,
          weight: entry.weight
        } satisfies PulledGachaCard;
      })
      .filter((r): r is PulledGachaCard => r !== null);

    return json({ results });
  } catch {
    return json({ error: "internal_error" }, { status: 500 });
  }
};
