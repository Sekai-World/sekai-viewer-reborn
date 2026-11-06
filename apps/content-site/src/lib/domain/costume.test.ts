import { describe, expect, it } from "vitest";
import {
  getCostumeColors,
  getCostumeObtainMethods,
  parseCostumeListQuery,
  toCostumeSearchParams,
  type CostumeOutfitDetail
} from "./costume";

describe("parseCostumeListQuery", () => {
  it("reads every filter", () => {
    expect(
      parseCostumeListQuery(
        new URLSearchParams("name=+star+&rarity=rare&character=21&sort_order=desc")
      )
    ).toEqual({ name: "star", rarity: "rare", characterId: 21, sortOrder: "desc" });
  });

  it("falls back to defaults for missing or invalid values", () => {
    const defaults = { name: "", rarity: null, characterId: null, sortOrder: "asc" };

    expect(parseCostumeListQuery(new URLSearchParams())).toEqual(defaults);
    expect(
      parseCostumeListQuery(new URLSearchParams("rarity=mythic&character=0&sort_order=up"))
    ).toEqual(defaults);
    expect(parseCostumeListQuery(new URLSearchParams("character=abc")).characterId).toBeNull();
  });
});

describe("toCostumeSearchParams", () => {
  it("leaves defaults out", () => {
    const query = { name: "", rarity: null, characterId: null, sortOrder: "asc" } as const;

    expect(toCostumeSearchParams(query).toString()).toBe("");
  });

  it("round-trips a query and adds the page", () => {
    const query = { name: "star", rarity: "rare", characterId: 21, sortOrder: "desc" } as const;

    const params = toCostumeSearchParams(query, 2);

    expect(params.get("page")).toBe("2");
    expect(parseCostumeListQuery(params)).toEqual(query);
  });
});

const outfit: CostumeOutfitDetail = {
  id: 1,
  characterIds: [1, 2],
  colorIds: [1, 2],
  partTypes: ["body", "head"],
  colors: [{ id: 1, name: "Original" }, { id: 2 }, {}],
  costumes: [
    {
      id: 1,
      colorId: 1,
      partType: "head",
      thumbnailAssetbundleName: "cos_head",
      howToObtain: "Shop"
    },
    {
      id: 2,
      colorId: 1,
      partType: "body",
      thumbnailAssetbundleName: "cos_body",
      howToObtain: "Shop"
    },
    { id: 3, colorId: 1, partType: "body", thumbnailAssetbundleName: "cos_body" },
    {
      id: 4,
      colorId: 1,
      partType: "cape",
      thumbnailAssetbundleName: "cos_cape",
      howToObtain: "Gacha"
    },
    { id: 5, colorId: 2, partType: "body", thumbnailAssetbundleName: "cos_body_01" },
    { id: 6, colorId: 2, partType: "head" }
  ]
};

describe("getCostumeColors", () => {
  it("lists each color's distinct parts, known parts first", () => {
    expect(getCostumeColors(outfit)).toEqual([
      {
        id: 1,
        name: "Original",
        parts: [
          { partType: "body", thumbnail: "cos_body" },
          { partType: "head", thumbnail: "cos_head" },
          { partType: "cape", thumbnail: "cos_cape" }
        ]
      },
      { id: 2, name: null, parts: [{ partType: "body", thumbnail: "cos_body_01" }] }
    ]);
  });

  it("handles an outfit without colors", () => {
    expect(getCostumeColors({ id: 1 } as CostumeOutfitDetail)).toEqual([]);
  });
});

describe("getCostumeObtainMethods", () => {
  it("lists each method once, in order", () => {
    expect(getCostumeObtainMethods(outfit)).toEqual(["Shop", "Gacha"]);
    expect(getCostumeObtainMethods({ id: 1 } as CostumeOutfitDetail)).toEqual([]);
  });
});
