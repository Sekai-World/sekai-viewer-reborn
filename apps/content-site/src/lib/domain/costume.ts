import type {
  SharedCostume3dOutfitDetailResponse,
  SharedCostume3dOutfitResponse
} from "@platform/sekai-master-api-sdk";

export type CostumeOutfit = SharedCostume3dOutfitResponse;
export type CostumeOutfitDetail = SharedCostume3dOutfitDetailResponse;

/** The rarities every region's outfits use. */
export const costumeRarities = ["normal", "rare"] as const;
export type CostumeRarity = (typeof costumeRarities)[number];

export type CostumeListQuery = {
  name: string;
  rarity: CostumeRarity | null;
  /** A character the outfit must have. */
  characterId: number | null;
  sortOrder: "asc" | "desc";
};

export const parseCostumeListQuery = (searchParams: URLSearchParams): CostumeListQuery => {
  const rarity = searchParams.get("rarity");
  const rawCharacter = searchParams.get("character");
  const characterId = Number(rawCharacter);
  return {
    name: searchParams.get("name")?.trim() ?? "",
    rarity: costumeRarities.find((value) => value === rarity) ?? null,
    characterId:
      rawCharacter !== null && Number.isSafeInteger(characterId) && characterId > 0
        ? characterId
        : null,
    sortOrder: searchParams.get("sort_order") === "desc" ? "desc" : "asc"
  };
};

/** The page URL's query for a costume list query, without defaults. */
export const toCostumeSearchParams = (query: CostumeListQuery, page?: number): URLSearchParams => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set("page", String(page));
  if (query.name) params.set("name", query.name);
  if (query.rarity !== null) params.set("rarity", query.rarity);
  if (query.characterId !== null) params.set("character", String(query.characterId));
  if (query.sortOrder === "desc") params.set("sort_order", "desc");
  return params;
};

export type CostumePart = { partType: string; thumbnail: string };
export type CostumeColor = { id: number; name: string | null; parts: CostumePart[] };

const partOrder = ["body", "head", "hair"];
const partRank = (partType: string): number => {
  const rank = partOrder.indexOf(partType);
  return rank < 0 ? partOrder.length : rank;
};

/**
 * Each color of the outfit with its parts. Characters usually share a part's thumbnail, so each
 * distinct thumbnail shows once, body first.
 */
export const getCostumeColors = (outfit: CostumeOutfitDetail): CostumeColor[] =>
  (outfit.colors ?? []).flatMap((color) => {
    if (color.id === undefined) return [];
    const parts: CostumePart[] = [];
    for (const costume of outfit.costumes ?? []) {
      const thumbnail = costume.thumbnailAssetbundleName;
      if (
        costume.colorId === color.id &&
        costume.partType &&
        thumbnail &&
        !parts.some((part) => part.thumbnail === thumbnail)
      ) {
        parts.push({ partType: costume.partType, thumbnail });
      }
    }
    parts.sort((left, right) => partRank(left.partType) - partRank(right.partType));
    return [{ id: color.id, name: color.name ?? null, parts }];
  });

/** The different ways to obtain the outfit, in costume order. */
export const getCostumeObtainMethods = (outfit: CostumeOutfitDetail): string[] => [
  ...new Set((outfit.costumes ?? []).flatMap((costume) => costume.howToObtain ?? []))
];
