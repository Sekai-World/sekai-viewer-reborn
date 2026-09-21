import { getHonorGroupsByRegionList } from "@platform/sekai-master-api-sdk";
import type { Honor, HonorGroup, HonorGroupMetadata, HonorLevel } from "$lib/domain/honor";

const PAGE_SIZE = 12;
const MASTER_API_PATH_PREFIX = "/api/v1";

const getMasterApiV1BaseUrl = (baseUrl: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return normalizedBaseUrl.endsWith(MASTER_API_PATH_PREFIX)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}${MASTER_API_PATH_PREFIX}`;
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const getString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getPositiveInteger = (value: unknown): number | null => {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : null;

  return typeof numberValue === "number" && Number.isSafeInteger(numberValue) && numberValue > 0
    ? numberValue
    : null;
};

const getItems = (payload: unknown): unknown[] | null => {
  const root = getObject(payload);
  if (root && Array.isArray(root.items)) {
    return root.items;
  }

  const data = getObject(root?.data);
  return data && Array.isArray(data.items) ? data.items : null;
};

export type HonorListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type HonorListPage = {
  items: HonorGroup[];
  pagination: HonorListPagination;
};

const getPaginationObject = (payload: unknown): Record<string, unknown> | null => {
  const root = getObject(payload);
  const data = getObject(root?.data);
  const value = root?.pagination ?? data?.pagination;

  if (value === null || value === undefined) {
    return null;
  }

  const pagination = getObject(value);
  if (!pagination) {
    throw new Error("Honor catalogue returned invalid pagination metadata.");
  }

  return pagination;
};

const getOptionalField = (source: Record<string, unknown> | null, keys: string[]): unknown => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }

  return null;
};

const parseOptionalInteger = (value: unknown, name: string, allowZero: boolean): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  const minimum = allowZero ? 0 : 1;

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Honor catalogue returned an invalid ${name}.`);
  }

  return parsed;
};

const parseApiPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  itemCount: number
): HonorListPagination => {
  const pagination = getPaginationObject(payload);
  const reportedPage = parseOptionalInteger(getOptionalField(pagination, ["page"]), "page", false);
  const reportedPageSize = parseOptionalInteger(
    getOptionalField(pagination, ["page_size", "pageSize"]),
    "page size",
    false
  );
  const total = parseOptionalInteger(getOptionalField(pagination, ["total"]), "total", true);
  const totalPages = parseOptionalInteger(
    getOptionalField(pagination, ["total_pages", "totalPages"]),
    "total pages",
    true
  );
  const hasNextValue = getOptionalField(pagination, ["has_next", "hasNext"]);

  if (reportedPage !== null && reportedPage !== requestedPage) {
    throw new Error(
      `Honor catalogue returned page ${reportedPage} for requested page ${requestedPage}.`
    );
  }

  if (reportedPageSize !== null && reportedPageSize !== pageSize) {
    throw new Error("Honor catalogue returned a page with an unexpected page size.");
  }

  if (hasNextValue !== null && typeof hasNextValue !== "boolean") {
    throw new Error("Honor catalogue returned an invalid has-next value.");
  }

  if (itemCount > pageSize) {
    throw new Error("Honor catalogue returned more items than the requested page size.");
  }

  const hasNext =
    typeof hasNextValue === "boolean"
      ? hasNextValue
      : totalPages !== null
        ? requestedPage < totalPages
        : itemCount >= pageSize;

  if (
    typeof hasNextValue === "boolean" &&
    totalPages !== null &&
    hasNext !== requestedPage < totalPages
  ) {
    throw new Error("Honor catalogue returned inconsistent pagination metadata.");
  }

  const isFirstPageOfEmptyCatalogue =
    requestedPage === 1 && itemCount === 0 && total === 0 && totalPages === 0 && !hasNext;

  if (totalPages !== null && requestedPage > totalPages && !isFirstPageOfEmptyCatalogue) {
    throw new Error("Honor catalogue requested a page beyond its reported page count.");
  }

  if (hasNext && itemCount !== pageSize) {
    throw new Error("Honor catalogue returned an incomplete page while reporting another page.");
  }

  if (itemCount === 0 && hasNext) {
    throw new Error("Honor catalogue returned an empty page while reporting another page.");
  }

  const offset = (requestedPage - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    throw new Error("Honor catalogue page is outside the supported range.");
  }

  if (total !== null) {
    if (offset > total) {
      if (itemCount > 0 || hasNext) {
        throw new Error("Honor catalogue returned items beyond its reported total.");
      }
    } else {
      const expectedItemCount = Math.min(pageSize, total - offset);
      if (itemCount !== expectedItemCount) {
        throw new Error("Honor catalogue returned an incomplete page for its reported total.");
      }
    }
  }

  return {
    page: requestedPage,
    pageSize,
    hasNext,
    total,
    totalPages
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
  if (!root || !metadata || metadata.id === null) {
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
    throw new Error("Honor catalogue returned invalid groups.");
  }

  const items = parseHonorGroupList(response.data);

  return {
    items,
    pagination: parseApiPagination(response.data, page, PAGE_SIZE, sourceGroups.length)
  };
};
