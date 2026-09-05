import { describe, expect, it, vi } from "vitest";
import type { GachaDetailSub } from "$lib/domain/gacha-detail";
import {
  buildRarityPools,
  fetchGachaCardMetadata,
  getGachaCardIds,
  parseCardMetadataResponse
} from "./pull-pool";

const createDetails = (count: number): GachaDetailSub[] =>
  Array.from({ length: count }, (_, index) => ({
    cardId: String(index + 1),
    weight: index + 1,
    isWish: index % 2 === 0
  }));

const createBatchResponse = (ids: string): { data: { items: Record<string, unknown>[] } } => ({
  data: {
    items: ids.split(",").map((id) => ({
      id,
      prefix: `Card ${id}`,
      assetBundleName: `asset_${id}`,
      attribute: "cute",
      cardRarity: { cardRarityType: "rarity_3" }
    }))
  }
});

describe("pull card metadata", () => {
  it("parses supported batch response wrappers and field aliases", () => {
    expect(
      parseCardMetadataResponse({
        data: {
          items: [
            {
              id: 7,
              prefix: " Birthday card ",
              assetBundleName: "birthday_asset",
              attribute: "happy",
              cardRarity: { cardRarityType: "rarity_birthday" }
            }
          ]
        }
      })
    ).toEqual([
      {
        cardId: "7",
        title: "Birthday card",
        assetBundleName: "birthday_asset",
        attr: "happy",
        rarityType: "rarity_birthday"
      }
    ]);
  });

  it("requests gacha card ids in batches of at most 100", async () => {
    const details = createDetails(496);
    const fetchBatch = vi.fn(async ({ query }: { query: { ids: string } }) =>
      createBatchResponse(query.ids)
    );

    const metadata = await fetchGachaCardMetadata({
      baseUrl: "https://master-api.test",
      region: "jp",
      gachaDetails: details,
      fetchBatch
    });

    expect(fetchBatch).toHaveBeenCalledTimes(5);
    expect(
      fetchBatch.mock.calls
        .map(([request]) => request.query.ids.split(",").length)
        .sort((a, b) => a - b)
    ).toEqual([96, 100, 100, 100, 100]);
    expect(metadata.size).toBe(496);
    expect(getGachaCardIds(details)).toHaveLength(496);
  });

  it("keeps successful batches when another batch fails", async () => {
    const details = createDetails(201);
    const fetchBatch = vi.fn(async ({ query }: { query: { ids: string } }) => {
      if (query.ids.split(",")[0] === "101") {
        throw new Error("batch unavailable");
      }

      return createBatchResponse(query.ids);
    });

    const metadata = await fetchGachaCardMetadata({
      baseUrl: "https://master-api.test",
      region: "jp",
      gachaDetails: details,
      fetchBatch
    });

    expect(fetchBatch).toHaveBeenCalledTimes(3);
    expect(metadata.size).toBe(101);
    expect(metadata.has("1")).toBe(true);
    expect(metadata.has("101")).toBe(false);
    expect(metadata.has("201")).toBe(true);
  });

  it("builds a complete gacha393-like rarity pool without list pagination", async () => {
    const details = createDetails(496);
    const metadata = await fetchGachaCardMetadata({
      baseUrl: "https://master-api.test",
      region: "jp",
      gachaDetails: details,
      fetchBatch: async ({ query }) => createBatchResponse(query.ids)
    });

    const pools = buildRarityPools(details, metadata);
    const rarityPool = pools.get("rarity_3");

    expect(rarityPool).toHaveLength(496);
    expect(rarityPool?.[0]).toMatchObject({ cardId: "1", weight: 1, isWish: true });
    expect(rarityPool?.[495]).toMatchObject({ cardId: "496", weight: 496, isWish: false });
  });
});
