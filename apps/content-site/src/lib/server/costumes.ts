import {
  getCostume3dOutfitsByRegionById,
  getCostume3dOutfitsByRegionList,
  type GetCostume3dOutfitsByRegionListData
} from "@platform/sekai-master-api-sdk";
import type { CostumeListQuery, CostumeOutfit, CostumeOutfitDetail } from "#lib/domain/costume.js";
import type { MysekaiPagination } from "#lib/domain/mysekai.js";
import { getMasterApiV1BaseUrl } from "./catalogue-data";
import { toPagination } from "./mysekai";

// 48 fills whole rows at every costume grid width (2, 3, 4, and 6 columns).
export const COSTUME_PAGE_SIZE = 48;

export type CostumeListPage = { items: CostumeOutfit[]; pagination: MysekaiPagination };

export const createCostumeListRequestQuery = (
  query: CostumeListQuery,
  page: number
): NonNullable<GetCostume3dOutfitsByRegionListData["query"]> => ({
  page,
  page_size: COSTUME_PAGE_SIZE,
  sort_by: "id",
  sort_order: query.sortOrder,
  ...(query.name ? { name: query.name } : {}),
  ...(query.rarity ? { rarity: query.rarity } : {}),
  ...(query.characterId !== null ? { character_id: String(query.characterId) } : {})
});

export const fetchCostumeListPage = async (
  baseUrl: string,
  region: string,
  query: CostumeListQuery,
  page = 1
): Promise<CostumeListPage> => {
  const response = await getCostume3dOutfitsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createCostumeListRequestQuery(query, page)
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load costumes.");
  }
  return {
    items: response.data.items ?? [],
    pagination: toPagination(response.data.pagination, page, COSTUME_PAGE_SIZE)
  };
};

export const fetchCostumeOutfitDetail = async (
  baseUrl: string,
  region: string,
  id: number
): Promise<CostumeOutfitDetail | null> => {
  const response = await getCostume3dOutfitsByRegionById({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region, id }
  });
  if (response.response?.status === 404) return null;
  if (response.error || !response.data) {
    throw new Error("Failed to load costume.");
  }
  return response.data;
};
