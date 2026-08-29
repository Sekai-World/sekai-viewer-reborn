import { dev } from "$app/environment";
import { getMusicsByRegionList } from "@platform/sekai-master-api-sdk";
import { musicTagByUnitCode } from "$lib/server/unit-profiles";

export type MusicListItem = {
  id: string;
  title: string;
  assetBundleName: string | null;
  categories: string[];
  composer: string | null;
  arranger: string | null;
  lyricist: string | null;
  vocalCharacters: string[];
  tags: string[];
  difficulties: string[];
  difficultyLevels: { difficulty: string; level: string }[];
  levels: string[];
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
  vocalCharacters: string[];
  tags: string[];
  difficulties: string[];
  levels: string[];
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
  vocalCharacter: string[];
  tags: string[];
  hasAppend: boolean;
  level: string;
  spoiler: boolean;
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

const getStringList = (
  value: unknown,
  objectKeys: readonly string[] = ["id", "characterId", "gameCharacterId", "unit", "name", "tag"]
): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string" || typeof entry === "number") {
          return String(entry).trim();
        }

        const object = getObject(entry);
        if (!object) {
          return "";
        }

        return pickStringLike(object, objectKeys) ?? "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const object = getObject(value);
  if (object) {
    const result = pickStringLike(object, objectKeys);
    return result ? [result] : [];
  }

  return [];
};

const pickString = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickStringList = (
  source: Record<string, unknown>,
  keys: readonly string[],
  objectKeys?: readonly string[]
): string[] => {
  for (const key of keys) {
    const values = getStringList(source[key], objectKeys);
    if (values.length > 0) {
      return [...new Set(values)];
    }
  }

  return [];
};

const pickMusicDifficultyLevels = (
  source: Record<string, unknown>
): { difficulty: string; level: string }[] => {
  for (const key of ["musicDifficulties", "difficulties", "difficulty"]) {
    const value = source[key];
    if (!Array.isArray(value)) {
      continue;
    }

    return value
      .map((entry) => {
        const object = getObject(entry);
        if (!object) {
          return null;
        }

        const difficulty = pickStringLike(object, ["difficulty", "musicDifficulty", "name"]);
        const level = pickStringLike(object, ["level", "playLevel", "musicLevel"]);
        return difficulty && level ? { difficulty: difficulty.toLocaleLowerCase(), level } : null;
      })
      .filter((entry): entry is { difficulty: string; level: string } => entry !== null);
  }

  return [];
};

/**
 * Normalizes the future master-api canonical `categories` field (a `string[]`)
 * into a stable `string[]`. Missing, non-array, or malformed input (null,
 * numbers, objects, empty strings) is collapsed to `[]` so downstream UI code
 * can always rely on an array of non-empty category strings.
 */
export const parseMusicCategories = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((entry) => getString(entry))
    .filter((entry): entry is string => entry !== null);

  return [...new Set(normalized)];
};

export const parseMusicListItem = (payload: unknown): MusicListItem | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const id = getStringLike(root.id ?? root.musicId);
  const title = pickString(root, ["title", "name"]);
  if (!id || !title) {
    return null;
  }

  const categories = parseMusicCategories(root.categories);
  const difficultyLevels = pickMusicDifficultyLevels(root);

  return {
    id,
    title,
    assetBundleName: pickString(root, ["assetbundleName", "assetBundleName"]),
    categories: [...new Set(categories)],
    composer: pickString(root, ["composer"]),
    arranger: pickString(root, ["arranger"]),
    lyricist: pickString(root, ["lyricist"]),
    vocalCharacters: pickStringList(root, [
      "vocalCharacters",
      "vocalCharacterIds",
      "vocal_character",
      "vocalCharactersIds"
    ]),
    tags: pickStringList(root, ["tags", "musicTags", "music_tag"]),
    difficulties: pickStringList(
      root,
      ["musicDifficulties", "difficulties", "difficulty"],
      ["difficulty", "musicDifficulty", "name", "id"]
    ).map((value) => value.toLocaleLowerCase()),
    difficultyLevels,
    levels: pickStringList(
      root,
      ["musicDifficulties", "difficulties", "levels", "level"],
      ["level", "playLevel", "musicLevel", "name"]
    ),
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

const normalizeMusicTagFilters = (values: string[]): string[] =>
  values.includes("all") ? [] : values;

const normalizeLegacyVocalUnitFilters = (values: string[]): string[] =>
  values.map((value) => musicTagByUnitCode[value] ?? value);

export const parseMusicListQueryState = (searchParams: URLSearchParams): MusicListQueryState => {
  const legacyVocalUnitTags = normalizeLegacyVocalUnitFilters(
    parseMultiValueParam(searchParams, "vocal_unit")
  );

  return {
    sortBy: parseSortBy(searchParams.get("sort_by")),
    sortOrder: parseSortOrder(searchParams.get("sort_order")),
    name: searchParams.get("name")?.trim() ?? "",
    categories: parseMultiValueParam(searchParams, "category"),
    composer: searchParams.get("composer")?.trim() ?? "",
    arranger: searchParams.get("arranger")?.trim() ?? "",
    lyricist: searchParams.get("lyricist")?.trim() ?? "",
    vocalCharacter: parseMultiValueParam(searchParams, "vocal_character"),
    tags: normalizeMusicTagFilters([
      ...parseMultiValueParam(searchParams, "music_tag"),
      ...legacyVocalUnitTags
    ]),
    hasAppend:
      searchParams.get("hasAppend") === "true" ||
      searchParams.get("has_append") === "true" ||
      parseMultiValueParam(searchParams, "difficulty").includes("append"),
    level: (searchParams.get("playLevel") ?? searchParams.get("level"))?.trim() ?? "",
    spoiler: searchParams.get("spoiler") === "true"
  };
};

export const hasMusicListFilters = (queryState: MusicListQueryState): boolean =>
  queryState.name.length > 0 ||
  queryState.categories.length > 0 ||
  queryState.composer.length > 0 ||
  queryState.arranger.length > 0 ||
  queryState.lyricist.length > 0 ||
  queryState.vocalCharacter.length > 0 ||
  queryState.tags.length > 0 ||
  queryState.hasAppend ||
  queryState.level.length > 0;

export const logMusicListFilterDebug = (label: string, details: Record<string, unknown>): void => {
  if (!dev) {
    return;
  }

  console.debug("[content-site:music-filter]", label, details);
};

const normalizeCategories = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export const fetchMusicCatalog = async (
  baseUrl: string,
  region: string,
  includeSpoilerContent: boolean,
  hasAppend: boolean,
  categories: string[],
  tags: string[],
  playLevel: string
): Promise<MusicListItem[]> => {
  const normalizedCategories = normalizeCategories(categories);
  const categoryQuery = normalizedCategories.join(",");
  const normalizedTags = normalizeMusicTagFilters(tags);
  const tagQuery = normalizedTags.join(",");
  const normalizedPlayLevel = playLevel.trim();
  const key = `${baseUrl}|${region}|${includeSpoilerContent ? "spoiler" : "public"}|${hasAppend ? "append" : "all"}|${categoryQuery}|${tagQuery}|${normalizedPlayLevel}`;
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
        category: categoryQuery || undefined,
        tag: tagQuery || undefined,
        playLevel: normalizedPlayLevel || undefined,
        hasAppend: hasAppend || undefined,
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
  ].sort(),
  vocalCharacters: [...new Set(items.flatMap((item) => item.vocalCharacters))].sort(),
  tags: [...new Set(items.flatMap((item) => item.tags))].sort(),
  difficulties: [...new Set(items.flatMap((item) => item.difficulties))].sort(),
  levels: [...new Set(items.flatMap((item) => item.levels))].sort((left, right) => {
    const numericCompare = Number(left) - Number(right);
    return Number.isFinite(numericCompare) && numericCompare !== 0
      ? numericCompare
      : left.localeCompare(right);
  })
});

type LevelCondition =
  | { type: "exact"; value: number }
  | { type: "range"; min: number; max: number }
  | { type: "gt" | "gte" | "lt" | "lte"; value: number }
  | { type: "raw"; value: string }
  | null;

const parseLevelCondition = (value: string): LevelCondition => {
  const input = value.trim();
  if (!input) {
    return null;
  }

  const range = input.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { type: "range", min: Math.min(min, max), max: Math.max(min, max) };
  }

  const comparison = input.match(/^(>=|>|<=|<)\s*(\d+)$/);
  if (comparison) {
    const valueNumber = Number(comparison[2]);
    const typeByOperator = {
      ">": "gt",
      ">=": "gte",
      "<": "lt",
      "<=": "lte"
    } as const;
    return {
      type: typeByOperator[comparison[1] as keyof typeof typeByOperator],
      value: valueNumber
    };
  }

  if (/^\d+$/.test(input)) {
    return { type: "exact", value: Number(input) };
  }

  return { type: "raw", value: input };
};

const matchesLevelCondition = (level: string, condition: LevelCondition): boolean => {
  if (!condition) {
    return true;
  }

  if (condition.type === "raw") {
    return level === condition.value;
  }

  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel)) {
    return false;
  }

  if (condition.type === "exact") {
    return numericLevel === condition.value;
  }

  if (condition.type === "range") {
    return numericLevel >= condition.min && numericLevel <= condition.max;
  }

  if (condition.type === "gt") {
    return numericLevel > condition.value;
  }

  if (condition.type === "gte") {
    return numericLevel >= condition.value;
  }

  if (condition.type === "lt") {
    return numericLevel < condition.value;
  }

  return numericLevel <= condition.value;
};

export const createMusicListPage = (
  catalog: MusicListItem[],
  queryState: MusicListQueryState,
  page: number,
  pageSize = DEFAULT_MUSIC_LIST_PAGE_SIZE
): MusicListPage => {
  const needle = queryState.name.toLocaleLowerCase();
  const levelCondition = parseLevelCondition(queryState.level);
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
      (!queryState.lyricist || item.lyricist === queryState.lyricist) &&
      (queryState.vocalCharacter.length === 0 ||
        queryState.vocalCharacter.some((value) => item.vocalCharacters.includes(value))) &&
      (!queryState.level ||
        item.levels.some((value) => matchesLevelCondition(value, levelCondition)))
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
