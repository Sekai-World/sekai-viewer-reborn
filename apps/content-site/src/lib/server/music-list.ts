import { dev } from "$app/environment";
import { getMusicsByRegionList } from "@platform/sekai-master-api-sdk";

export type MusicListItem = {
  id: string;
  title: string;
  assetBundleName: string | null;
  categories: string[];
  composer: string | null;
  arranger: string | null;
  lyricist: string | null;
  publishedAt: string | number | null;
};

export type MusicListPage = {
  items: MusicListItem[];
  pagination: {
    page: number;
    pageSize: number;
    hasNext: boolean;
    total: number;
    totalPages: number;
  };
};

export type MusicListFilterMeta = {
  categories: string[];
  composers: string[];
  arrangers: string[];
  lyricists: string[];
};

export type MusicListSortBy = "publishedAt" | "id";
export type MusicListSortOrder = "asc" | "desc";

export type MusicListQueryState = {
  sortBy: MusicListSortBy;
  sortOrder: MusicListSortOrder;
  name: string;
  categories: string[];
  composer: string;
  arranger: string;
  lyricist: string;
};

export const DEFAULT_MUSIC_LIST_PAGE_SIZE = 24;
const MUSIC_CATALOG_REQUEST_PAGE_SIZE = 1000;
const MUSIC_CATALOG_CACHE_DURATION_MS = 60_000;

const catalogCache = new Map<string, { expiresAt: number; items: MusicListItem[] }>();

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return getString(value);
};

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const pickString = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const parseMusicListItem = (payload: unknown): MusicListItem | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const id = getStringLike(root.id ?? root.musicId);
  const title = pickString(root, ["title", "name"]);
  if (!id || !title) {
    return null;
  }

  const categories = Array.isArray(root.categories)
    ? root.categories.map(getString).filter((value): value is string => value !== null)
    : [];

  return {
    id,
    title,
    assetBundleName: pickString(root, ["assetbundleName", "assetBundleName"]),
    categories: [...new Set(categories)],
    composer: pickString(root, ["composer"]),
    arranger: pickString(root, ["arranger"]),
    lyricist: pickString(root, ["lyricist"]),
    publishedAt: getDateValue(root.publishedAt ?? root.published_at)
  };
};

const parseSortBy = (value: string | null): MusicListSortBy =>
  value === "id" ? "id" : "publishedAt";

const parseSortOrder = (value: string | null): MusicListSortOrder =>
  value === "asc" ? "asc" : "desc";

const parseMultiValueParam = (searchParams: URLSearchParams, key: string): string[] => [
  ...new Set(
    searchParams
      .getAll(key)
      .map((value) => value.trim())
      .filter(Boolean)
  )
];

export const parseMusicListQueryState = (searchParams: URLSearchParams): MusicListQueryState => ({
  sortBy: parseSortBy(searchParams.get("sort_by")),
  sortOrder: parseSortOrder(searchParams.get("sort_order")),
  name: searchParams.get("name")?.trim() ?? "",
  categories: parseMultiValueParam(searchParams, "category"),
  composer: searchParams.get("composer")?.trim() ?? "",
  arranger: searchParams.get("arranger")?.trim() ?? "",
  lyricist: searchParams.get("lyricist")?.trim() ?? ""
});

export const hasMusicListFilters = (queryState: MusicListQueryState): boolean =>
  queryState.name.length > 0 ||
  queryState.categories.length > 0 ||
  queryState.composer.length > 0 ||
  queryState.arranger.length > 0 ||
  queryState.lyricist.length > 0;

export const logMusicListFilterDebug = (label: string, details: Record<string, unknown>): void => {
  if (!dev) {
    return;
  }

  console.debug("[content-site:music-filter]", label, details);
};

export const fetchMusicCatalog = async (
  baseUrl: string,
  region: string,
  includeSpoilerContent: boolean
): Promise<MusicListItem[]> => {
  const key = `${baseUrl}|${region}|${includeSpoilerContent ? "spoiler" : "public"}`;
  const now = Date.now();
  const cached = catalogCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.items;
  }

  const items: MusicListItem[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await getMusicsByRegionList({
      baseUrl,
      path: { region },
      query: {
        page,
        page_size: MUSIC_CATALOG_REQUEST_PAGE_SIZE,
        spoiler: includeSpoilerContent,
        sort_by: "publishedAt",
        sort_order: "desc"
      }
    });

    if (response.error) {
      throw new Error("Failed to load music catalog.");
    }

    const nextItems = (response.data?.items ?? [])
      .map(parseMusicListItem)
      .filter((item): item is MusicListItem => item !== null);
    items.push(...nextItems);

    hasNext = response.data?.pagination?.has_next === true;
    page += 1;
  }

  catalogCache.set(key, {
    expiresAt: now + MUSIC_CATALOG_CACHE_DURATION_MS,
    items
  });

  return items;
};

export const buildMusicListFilterMeta = (items: MusicListItem[]): MusicListFilterMeta => ({
  categories: [...new Set(items.flatMap((item) => item.categories))].sort(),
  composers: [
    ...new Set(
      items.map((item) => item.composer).filter((value): value is string => Boolean(value))
    )
  ].sort(),
  arrangers: [
    ...new Set(
      items.map((item) => item.arranger).filter((value): value is string => Boolean(value))
    )
  ].sort(),
  lyricists: [
    ...new Set(
      items.map((item) => item.lyricist).filter((value): value is string => Boolean(value))
    )
  ].sort()
});

export const createMusicListPage = (
  catalog: MusicListItem[],
  queryState: MusicListQueryState,
  page: number,
  pageSize = DEFAULT_MUSIC_LIST_PAGE_SIZE
): MusicListPage => {
  const needle = queryState.name.toLocaleLowerCase();
  const filtered = catalog.filter((item) => {
    if (needle && !item.title.toLocaleLowerCase().includes(needle)) {
      return false;
    }

    if (
      queryState.categories.length > 0 &&
      !queryState.categories.every((category) => item.categories.includes(category))
    ) {
      return false;
    }

    return (
      (!queryState.composer || item.composer === queryState.composer) &&
      (!queryState.arranger || item.arranger === queryState.arranger) &&
      (!queryState.lyricist || item.lyricist === queryState.lyricist)
    );
  });

  filtered.sort((left, right) => {
    const compare =
      queryState.sortBy === "id"
        ? Number(left.id) - Number(right.id)
        : Number(left.publishedAt ?? 0) - Number(right.publishedAt ?? 0);

    return queryState.sortOrder === "asc" ? compare : -compare;
  });

  const offset = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return {
    items: filtered.slice(offset, offset + pageSize),
    pagination: {
      page,
      pageSize,
      hasNext: page < totalPages,
      total: filtered.length,
      totalPages
    }
  };
};
