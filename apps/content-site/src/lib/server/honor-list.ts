import { getHonorGroupsByRegionList } from "@platform/sekai-master-api-sdk";
import type { Honor, HonorGroup, HonorGroupMetadata, HonorLevel } from "$lib/domain/honor";
import type { CataloguePagination } from "./catalogue-data";
import {
  getArray,
  getCatalogueHasNext,
  getItems,
  getMasterApiV1BaseUrl,
  getNumber,
  getObject,
  getPositiveInteger,
  getString,
  parseCataloguePaginationMetadata,
  validateCataloguePageContent,
  validateCataloguePageRequest
} from "./catalogue-data";

const PAGE_SIZE = 12;
export type HonorListPagination = CataloguePagination;

export type HonorListPage = {
  items: HonorGroup[];
  pagination: HonorListPagination;
};

const parseApiPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  itemCount: number
): HonorListPagination => {
  const metadata = parseCataloguePaginationMetadata(payload, "Honor");
  validateCataloguePageRequest(metadata, requestedPage, pageSize, itemCount, "Honor");
  const hasNext = getCatalogueHasNext(metadata, requestedPage, pageSize, itemCount, "Honor");
  const isFirstPageOfEmptyCatalogue =
    requestedPage === 1 &&
    itemCount === 0 &&
    metadata.total === 0 &&
    metadata.totalPages === 0 &&
    !hasNext;

  if (
    metadata.totalPages !== null &&
    requestedPage > metadata.totalPages &&
    !isFirstPageOfEmptyCatalogue
  ) {
    throw new Error("Honor catalogue requested a page beyond its reported page count.");
  }

  validateCataloguePageContent(
    metadata.total,
    requestedPage,
    pageSize,
    itemCount,
    hasNext,
    "Honor"
  );

  return {
    page: requestedPage,
    pageSize,
    hasNext,
    total: metadata.total,
    totalPages: metadata.totalPages
  };
};

const parseHonorGroupMetadata = (payload: unknown): HonorGroupMetadata | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    id: getPositiveInteger(root.id),
    name: getString(root.name),
    honorType: getString(root.honorType),
    backgroundAssetBundleName: getString(
      root.backgroundAssetbundleName ?? root.backgroundAssetBundleName
    ),
    frameName: getString(root.frameName)
  };
};

const parseHonorLevel = (payload: unknown): HonorLevel | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    assetBundleName: getString(root.assetbundleName ?? root.assetBundleName),
    bonus: getNumber(root.bonus),
    description: getString(root.description),
    honorId: getPositiveInteger(root.honorId),
    honorRarity: getString(root.honorRarity),
    level: getNumber(root.level)
  };
};

export const parseHonor = (
  payload: unknown,
  fallbackGroup: HonorGroupMetadata | null = null
): Honor | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  if (!root || id === null) {
    return null;
  }

  const group = parseHonorGroupMetadata(root.group) ?? fallbackGroup;

  return {
    id,
    assetBundleName: getString(root.assetbundleName ?? root.assetBundleName),
    group,
    groupId: getPositiveInteger(root.groupId) ?? group?.id ?? null,
    honorMissionType: getString(root.honorMissionType),
    honorRarity: getString(root.honorRarity),
    honorType: getString(root.honorType),
    honorTypeId: getPositiveInteger(root.honorTypeId),
    levels: getArray(root.levels).flatMap((item) => {
      const level = parseHonorLevel(item);
      return level ? [level] : [];
    }),
    name: getString(root.name),
    seq: getNumber(root.seq)
  };
};

const parseHonorGroup = (payload: unknown): HonorGroup | null => {
  const root = getObject(payload);
  const metadata = parseHonorGroupMetadata(root);
  if (!root || !metadata || metadata?.id === null) {
    return null;
  }

  return {
    ...metadata,
    id: metadata.id,
    honors: getArray(root.honors).flatMap((item) => {
      const honor = parseHonor(item, metadata);
      return honor ? [honor] : [];
    })
  };
};

export const parseHonorGroupList = (payload: unknown): HonorGroup[] =>
  (getItems(payload) ?? []).flatMap((item) => {
    const group = parseHonorGroup(item);
    return group ? [group] : [];
  });

export const createEmptyHonorListPage = (page: number): HonorListPage => ({
  items: [],
  pagination: {
    page,
    pageSize: PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const fetchHonorListPage = async (
  baseUrl: string,
  region: string,
  page = 1
): Promise<HonorListPage> => {
  const response = await getHonorGroupsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: { page, page_size: PAGE_SIZE }
  });

  if (response.error || !response.data) {
    throw new Error("Failed to load honor catalogue.");
  }

  const sourceGroups = getItems(response.data);
  if (sourceGroups === null) {
    throw new TypeError("Honor catalogue returned invalid groups.");
  }

  const items = parseHonorGroupList(response.data);

  return {
    items,
    pagination: parseApiPagination(response.data, page, PAGE_SIZE, sourceGroups.length)
  };
};
