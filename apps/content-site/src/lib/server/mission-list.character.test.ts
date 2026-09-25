import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCharacterRanksByRegionList, getMissionsByRegionList } = vi.hoisted(() => ({
  getCharacterRanksByRegionList: vi.fn(),
  getMissionsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCharacterRanksByRegionList,
  getMissionsByRegionList
}));

import { fetchCharacterMissions, fetchCharacterRankReferences } from "./mission-list";

const page = (items: unknown[], page: number, hasNext: boolean, total: number) => ({
  data: {
    items,
    pagination: {
      page,
      page_size: 100,
      total,
      total_pages: Math.ceil(total / 100),
      has_next: hasNext
    }
  }
});

const rank = (characterRank: number, bonus: number) => ({
  id: characterRank,
  characterId: 1,
  characterRank,
  power1BonusRate: bonus,
  power2BonusRate: bonus / 2,
  power3BonusRate: bonus / 2,
  rewardResourceBoxes: [
    { id: characterRank, details: [{ resourceType: "jewel", resourceQuantity: 100 }] }
  ]
});

describe("character lookups", () => {
  beforeEach(() => {
    getCharacterRanksByRegionList.mockReset();
    getMissionsByRegionList.mockReset();
  });

  it("loads every Character Rank page and keeps the largest power bonus rate", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => rank(index + 1, 0.1));
    getCharacterRanksByRegionList
      .mockResolvedValueOnce(page(firstPage, 1, true, 175))
      .mockResolvedValueOnce(page([rank(175, 5), rank(101, 4)], 2, false, 175));

    const ranks = await fetchCharacterRankReferences("https://master-api.test/", "jp", 1);

    expect(getCharacterRanksByRegionList.mock.calls.map(([request]) => request.query)).toEqual([
      { character_id: 1, page: 1, page_size: 100 },
      { character_id: 1, page: 2, page_size: 100 }
    ]);
    expect(ranks).toHaveLength(102);
    expect(ranks.at(-1)).toMatchObject({ characterRank: 175, powerBonusRate: 5 });
    expect(ranks.map((item) => item.characterRank)).toEqual(
      [...ranks.map((item) => item.characterRank)].sort((left, right) => left! - right!)
    );
  });

  it("fails instead of returning a partial Character Rank list", async () => {
    getCharacterRanksByRegionList
      .mockResolvedValueOnce(page([rank(1, 0.1)], 1, true, 150))
      .mockResolvedValueOnce({ error: new Error("unavailable") });

    await expect(fetchCharacterRankReferences("https://master-api.test", "jp", 1)).rejects.toThrow(
      "Failed to load Character Rank references."
    );
  });

  it("loads a character's missions in game order without duplicates", async () => {
    const mission = (id: number) => ({
      id,
      characterId: 1,
      characterMissionType: id > 1100 ? "play_live_ex" : "play_live",
      sentence: "Clear {requirement} lives",
      parameterGroup: {
        id,
        totalLevels: 140,
        previewLevels: [{ seq: 1, requirement: 10, exp: 1 }],
        lastLevel: { seq: 140, requirement: 50000, exp: 1 }
      }
    });
    getMissionsByRegionList.mockResolvedValueOnce(
      page([mission(1001), mission(1001), mission(1101)], 1, false, 3)
    );

    const missions = await fetchCharacterMissions("https://master-api.test", "tw", 1);

    expect(getMissionsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "tw" },
      query: {
        family: "characterMissionV2s",
        character_id: "1",
        page: 1,
        page_size: 100,
        sort_by: "seq",
        sort_order: "asc"
      }
    });
    expect(missions.map((item) => item.id)).toEqual([1001, 1101]);
    expect(missions[0]?.parameterGroup).toMatchObject({
      totalLevels: 140,
      levels: [{ requirement: 10 }],
      lastLevel: { requirement: 50000 }
    });
  });
});
