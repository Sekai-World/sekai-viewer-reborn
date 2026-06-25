import type { GetGachasByRegionListData } from "@platform/sekai-master-api-sdk";
import { dev } from "$app/environment";

export type GachaListItem = {
  id: string;
  title: string;
  gachaType: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

export type GachaListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type GachaListPage = {
  items: GachaListItem[];
  pagination: GachaListPagination;
};

export type GachaListQueryState = {
  sortBy: "id" | "startAt";
  sortOrder: "asc" | "desc";
  spoiler: boolean;
};

export const DEFAULT_GACHA_LIST_PAGE_SIZE = 20;

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const pickFirstString = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickFirstStringLike = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickFirstNumber = (source: Record<string, unknown>, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = getNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const pickFirstDateValue = (source: Record<string, unknown>, keys: readonly string[]): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const parseSortBy = (value: string | null): "id" | "startAt" => (value === "id" ? "id" : "startAt");

const parseSortOrder = (value: string | null): "asc" | "desc" =>
  value === "asc" ? "asc" : "desc";

export const parseGachaListQueryState = (searchParams: URLSearchParams): GachaListQueryState => ({
  sortBy: parseSortBy(searchParams.get("sort_by")),
  sortOrder: parseSortOrder(searchParams.get("sort_order")),
  spoiler: searchParams.get("spoiler") === "true"
});

export const createGachaListRequestQuery = (
  queryState: GachaListQueryState,
  page: number,
  pageSize: number
): GetGachasByRegionListData["query"] => {
  const query: NonNullable<GetGachasByRegionListData["query"]> = {
    page,
    page_size: pageSize,
    spoiler: queryState.spoiler,
    sort_by: queryState.sortBy,
    sort_order: queryState.sortOrder
  };
  return query;
};

export const logGachaListFilterDebug = (label: string, details: Record<string, unknown>): void => {
  if (!dev) {
    return;
  }

  console.debug("[content-site:gacha-filter]", label, details);
};

const parseGachaListItem = (payload: unknown): GachaListItem | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const id = pickFirstStringLike(root, ["id"]);
  const title = pickFirstString(root, ["name", "title"]);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    gachaType: pickFirstString(root, ["gachaType", "gacha_type"]),
    assetBundleName: pickFirstString(root, ["assetbundleName", "assetBundleName"]),
    startAt: pickFirstDateValue(root, ["startAt", "start_at"]),
    endAt: pickFirstDateValue(root, ["endAt", "end_at"])
  };
};

const parsePagination = (
  payload: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
  itemCount: number
): GachaListPagination => {
  const root = getObject(payload);
  const paginationNode = (root && getObject(root["pagination"])) ?? null;
  const page = pickFirstNumber(paginationNode ?? {}, ["page"]) ?? fallbackPage;
  const pageSize = pickFirstNumber(paginationNode ?? {}, ["page_size", "pageSize"]) ?? fallbackPageSize;
  const total = pickFirstNumber(paginationNode ?? {}, ["total"]);
  const totalPages = pickFirstNumber(paginationNode ?? {}, ["total_pages", "totalPages"]);
  const hasNextFlag = paginationNode?.["has_next"];
  const hasNext =
    typeof hasNextFlag === "boolean"
      ? hasNextFlag
      : totalPages !== null
        ? page < totalPages
        : pageSize > 0 && itemCount >= pageSize;

  return { page, pageSize, hasNext, total, totalPages };
};

export const parseGachaListPage = (
  payload: unknown,
  page: number,
  pageSize: number
): GachaListPage => {
  const root = getObject(payload);
  const itemsSource = (root && Array.isArray(root["items"]) ? root["items"] : []) as unknown[];
  const items = itemsSource
    .map(parseGachaListItem)
    .filter((item): item is GachaListItem => item !== null);

  return {
    items,
    pagination: parsePagination(payload, page, pageSize, items.length)
  };
};
