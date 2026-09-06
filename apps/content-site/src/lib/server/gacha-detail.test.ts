import { describe, expect, it } from "vitest";
import { parseGachaDetail } from "./gacha-detail";

describe("parseGachaDetail", () => {
  it("normalizes numeric rarity rates from number and string payloads", () => {
    expect(
      parseGachaDetail({
        id: "gacha-1",
        gachaCardRarityRates: [
          { cardRarityType: "rarity_4", rate: "2.5", lotteryType: "normal" },
          { cardRarityType: "rarity_3", rate: 90, lotteryType: null },
          { cardRarityType: "rarity_2", rate: "not-a-number" },
          null
        ]
      })
    ).toMatchObject({
      id: "gacha-1",
      gachaCardRarityRates: [
        { cardRarityType: "rarity_4", rate: 2.5, lotteryType: "normal" },
        { cardRarityType: "rarity_3", rate: 90, lotteryType: null },
        { cardRarityType: "rarity_2", rate: null, lotteryType: null }
      ]
    });
  });

  it("rejects payloads without a gacha id", () => {
    expect(parseGachaDetail({ gachaCardRarityRates: [] })).toBeNull();
    expect(parseGachaDetail(null)).toBeNull();
  });
});
