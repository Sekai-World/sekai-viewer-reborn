import { env } from "$env/dynamic/private";
import {
  getActionSetsByRegionList,
  getCardEpisodesByRegionList,
  getAreasByRegionList,
  getCardsByRegionList,
  getCharacter2DsByRegionList,
  getCharacterProfilesByRegionList,
  getEventStoriesByRegionList,
  getEventsByRegionList,
  getGameCharactersByRegionList,
  getMobCharactersByRegionList,
  getSpecialStoriesByRegionList,
  getSubGameCharactersByRegionList,
  getUnitProfilesByRegionList,
  getUnitStoriesByRegionList,
  getUnitStoryEpisodeGroupsByRegionList
} from "@platform/sekai-master-api-sdk";
import type { StoryRouteRegion } from "$lib/live2d/story-route";
import type {
  StoryActionSet,
  StoryArea,
  StoryCardEpisode,
  StoryCardSummary,
  StoryCharacterProfile,
  StoryEvent,
  StoryEventStory,
  StoryGameCharacter,
  StoryMasterCollections,
  StorySpecialStory,
  StoryUnitEpisodeGroup,
  StoryUnitProfile,
  StoryUnitStory
} from "./story-identity";

/**
 * Server-side client for story master data served by sekai-master-api.
 * Collections are read through the paginated public list endpoints, parsed
 * defensively, and cached in memory with a bounded TTL — the story feature
 * only needs a handful of small collections.
 */

/** Story master data collections, by logical name. */
export type StoryCollectionName =
  | "unitStories"
  | "unitProfiles"
  | "unitStoryEpisodeGroups"
  | "eventStories"
  | "events"
  | "characterProfiles"
  | "cardEpisodes"
  | "cards"
  | "areas"
  | "actionSets"
  | "specialStories"
  | "character2ds"
  | "gameCharacters"
  | "mobCharacters"
  | "subGameCharacters";

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface StoryMasterDataClientOptions {
  fetch?: typeof fetch;
  /** sekai-master-api origin including the `/api/v1` prefix. */
  baseUrl?: string;
  ttlMs?: number;
  now?: () => number;
}

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asOptionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Parsers keep only the fields the story feature consumes. */
const collectionParsers: Record<
  StoryCollectionName,
  (raw: unknown[]) => unknown
> = {
  unitStories: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const unitStory: StoryUnitStory = {
        unit: asString(r.unit),
        seq: asNumber(r.seq),
        chapters: asArray(r.chapters).map((ch) => {
          const c = ch as Record<string, unknown>;
          return {
            id: asNumber(c.id),
            unit: asString(c.unit),
            chapterNo: asNumber(c.chapterNo),
            title: asString(c.title),
            assetbundleName: asString(c.assetbundleName),
            episodes: asArray(c.episodes).map((ep) => {
              const e = ep as Record<string, unknown>;
              return {
                id: asNumber(e.id),
                chapterNo: asNumber(e.chapterNo),
                episodeNo: asNumber(e.episodeNo),
                episodeNoLabel: asOptionalString(e.episodeNoLabel),
                title: asString(e.title),
                assetbundleName: asString(e.assetbundleName),
                scenarioId: asString(e.scenarioId),
                unitStoryEpisodeGroupId: asOptionalNumber(e.unitStoryEpisodeGroupId),
                releaseConditionId: asOptionalNumber(e.releaseConditionId)
              };
            })
          };
        })
      };
      return unitStory;
    }),
  unitProfiles: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const unitProfile: StoryUnitProfile = {
        unit: asString(r.unit),
        unitName: asString(r.unitName),
        seq: asOptionalNumber(r.seq)
      };
      return unitProfile;
    }),
  unitStoryEpisodeGroups: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const group: StoryUnitEpisodeGroup = {
        id: asNumber(r.id),
        unit: asString(r.unit),
        unitEpisodeCategory: asString(r.unitEpisodeCategory),
        outline: asOptionalString(r.outline),
        assetbundleName: asOptionalString(r.assetbundleName)
      };
      return group;
    }),
  eventStories: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const eventStory: StoryEventStory = {
        id: asNumber(r.id),
        eventId: asNumber(r.eventId),
        assetbundleName: asString(r.assetbundleName),
        eventStoryEpisodes: asArray(r.eventStoryEpisodes).map((ep) => {
          const e = ep as Record<string, unknown>;
          return {
            id: asNumber(e.id),
            eventStoryId: asNumber(e.eventStoryId),
            episodeNo: asNumber(e.episodeNo),
            title: asString(e.title),
            assetbundleName: asString(e.assetbundleName),
            scenarioId: asString(e.scenarioId),
            releaseConditionId: asOptionalNumber(e.releaseConditionId)
          };
        })
      };
      return eventStory;
    }),
  events: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const event: StoryEvent = {
        id: asNumber(r.id),
        name: asString(r.name),
        eventType: asOptionalString(r.eventType),
        unit: asOptionalString(r.unit),
        assetBundleName: asOptionalString(r.assetbundleName),
        startAt: asOptionalNumber(r.startAt),
        endAt: asOptionalNumber(r.endAt)
      };
      return event;
    }),
  characterProfiles: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const profile: StoryCharacterProfile = {
        characterId: asNumber(r.characterId),
        scenarioId: asString(r.scenarioId)
      };
      return profile;
    }),
  cardEpisodes: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const releaseCondition = (r.releaseCondition ?? null) as Record<
        string,
        unknown
      > | null;
      const episode: StoryCardEpisode = {
        id: asNumber(r.id),
        cardId: asNumber(r.cardId),
        title: asString(r.title),
        scenarioId: asString(r.scenarioId),
        assetbundleName: asOptionalString(r.assetbundleName),
        // The API expands the top-level releaseConditionId into a full
        // releaseCondition record; recover the id for the typed shape.
        releaseConditionId: asOptionalNumber(releaseCondition?.id)
      };
      return episode;
    }),
  cards: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      // The list endpoint inlines the card's game character as a flat
      // object (`character.id` / `firstName` / `givenName`).
      const character = (r.character ?? null) as Record<string, unknown> | null;
      const id = asNumber(r.id);
      const card: StoryCardSummary = {
        id,
        name: asString(r.prefix) || `#${id}`,
        assetBundleName: asOptionalString(r.assetbundleName),
        characterId: character ? asOptionalNumber(character.id) : undefined,
        characterName: character
          ? [asString(character.firstName), asString(character.givenName)]
              .filter(Boolean)
              .join(" ") || undefined
          : undefined
      };
      return card;
    }),
  actionSets: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const actionSet: StoryActionSet = {
        id: asNumber(r.id),
        areaId: asNumber(r.areaId),
        scriptId: asOptionalString(r.scriptId),
        scenarioId: asOptionalString(r.scenarioId),
        // `character2ds.id` values; the picker maps them to game
        // character ids via the character2ds collection.
        characterIds: asArray(r.characterIds).map(asNumber)
      };
      return actionSet;
    }),
  areas: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const area: StoryArea = {
        id: asNumber(r.id),
        assetBundleName: asOptionalString(r.assetbundleName),
        areaType: asOptionalString(r.areaType),
        name: asOptionalString(r.name),
        subName: asOptionalString(r.subName),
        label: asOptionalString(r.label)
      };
      return area;
    }),
  specialStories: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const story: StorySpecialStory = {
        id: asNumber(r.id),
        title: asString(r.title),
        assetbundleName: asString(r.assetbundleName),
        episodes: asArray(r.episodes).map((ep) => {
          const e = ep as Record<string, unknown>;
          return {
            id: asNumber(e.id),
            episodeNo: asNumber(e.episodeNo),
            title: asString(e.title),
            assetbundleName: asString(e.assetbundleName),
            scenarioId: asString(e.scenarioId)
          };
        })
      };
      return story;
    }),
  character2ds: (raw) => raw,
  gameCharacters: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const gameCharacter: StoryGameCharacter = {
        id: asNumber(r.id),
        firstName: asString(r.firstName),
        givenName: asString(r.givenName)
      };
      return gameCharacter;
    }),
  mobCharacters: (raw) => raw,
  subGameCharacters: (raw) => raw
};

/**
 * Minimal runtime validation for the identity lookups. The character tables
 * are consumed as loose records; story resolution only uses the typed
 * collections above.
 */
export interface StoryCharacterTables {
  character2ds: {
    id: number;
    characterType: string;
    characterId: number;
    unit?: string;
    assetName?: string;
  }[];
  gameCharacterNames: Map<number, string>;
  mobCharacterNames: Map<number, string>;
  subGameCharacterNames: Map<number, string>;
}

interface StoryListRequest {
  baseUrl: string;
  fetch: typeof fetch;
  path: { region: string };
  query: { page: number; page_size: number; spoiler: boolean };
}

interface StoryListResponseLike {
  data?: { items?: Array<Record<string, unknown>>; pagination?: { has_next?: boolean } };
  error?: unknown;
  response?: Response;
}

const storyListEndpoints: Record<
  StoryCollectionName,
  (request: StoryListRequest) => Promise<StoryListResponseLike>
> = {
  unitStories: (request) => getUnitStoriesByRegionList(request),
  unitProfiles: (request) => getUnitProfilesByRegionList(request),
  unitStoryEpisodeGroups: (request) => getUnitStoryEpisodeGroupsByRegionList(request),
  eventStories: (request) => getEventStoriesByRegionList(request),
  events: (request) => getEventsByRegionList(request),
  characterProfiles: (request) => getCharacterProfilesByRegionList(request),
  cardEpisodes: (request) => getCardEpisodesByRegionList(request),
  cards: (request) => getCardsByRegionList(request),
  areas: (request) => getAreasByRegionList(request),
  actionSets: (request) => getActionSetsByRegionList(request),
  specialStories: (request) => getSpecialStoriesByRegionList(request),
  character2ds: (request) => getCharacter2DsByRegionList(request),
  gameCharacters: (request) => getGameCharactersByRegionList(request),
  mobCharacters: (request) => getMobCharactersByRegionList(request),
  subGameCharacters: (request) => getSubGameCharactersByRegionList(request)
};

const cacheKey = (region: StoryRouteRegion, name: StoryCollectionName): string =>
  `${region}:${name}`;

const evictIfNeeded = (now: number, ttlMs: number): void => {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  void ttlMs;
};

const resolveApiBaseUrl = (options: StoryMasterDataClientOptions): string => {
  const base = (
    options.baseUrl ??
    env.SEKAI_MASTER_API_BASE_URL?.trim() ??
    ""
  ).replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Missing required environment variable: SEKAI_MASTER_API_BASE_URL"
    );
  }
  return base;
};

/**
 * Reads one collection through its paginated list endpoint. A region whose
 * master data does not include the entity yet resolves to an empty array
 * (regional rollouts happen at different times); any other failure throws.
 */
const listCollection = async (
  region: StoryRouteRegion,
  name: StoryCollectionName,
  fetcher: typeof fetch,
  baseUrl: string
): Promise<unknown[]> => {
  const endpoint = storyListEndpoints[name];
  const rows: unknown[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await endpoint({
      baseUrl,
      fetch: fetcher,
      path: { region },
      query: { page, page_size: PAGE_SIZE, spoiler: true }
    });
    if (response.error || !response.data) {
      const status = response.response?.status ?? 0;
      // Region data not synced for this entity — mirrors the previous
      // "collection missing on a regional mirror" tolerance.
      if (status === 503) return [];
      throw new Error(
        `Failed to fetch story master data ${name} (${status || "unknown error"})`
      );
    }

    const items = Array.isArray(response.data.items) ? response.data.items : [];
    rows.push(...items);
    if (response.data.pagination?.has_next !== true) break;
  }

  return rows;
};

/**
 * Fetches one collection for a region through sekai-master-api and parses it
 * into the story feature's typed shape.
 */
export const fetchStoryCollection = async <T = unknown>(
  region: StoryRouteRegion,
  name: StoryCollectionName,
  options: StoryMasterDataClientOptions = {}
): Promise<T> => {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const key = cacheKey(region, name);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now()) return cached.value as T;

  const fetcher = options.fetch ?? fetch;
  const baseUrl = resolveApiBaseUrl(options);
  const rows = await listCollection(region, name, fetcher, baseUrl);
  const parsed = collectionParsers[name](rows) as T;
  evictIfNeeded(now(), ttlMs);
  cache.set(key, { value: parsed, expiresAt: now() + ttlMs });
  return parsed;
};

/** Fetches the typed collections needed to resolve stories for a region. */
export const fetchStoryCollections = async (
  region: StoryRouteRegion,
  names: readonly StoryCollectionName[],
  options: StoryMasterDataClientOptions = {}
): Promise<StoryMasterCollections> => {
  const [
    unitStories,
    unitProfiles,
    unitStoryEpisodeGroups,
    eventStories,
    events,
    characterProfiles,
    cardEpisodes,
    cards,
    gameCharacters,
    areas,
    actionSets,
    specialStories
  ] = await Promise.all([
    names.includes("unitStories")
      ? fetchStoryCollection<StoryUnitStory[]>(region, "unitStories", options)
      : Promise.resolve([]),
    names.includes("unitProfiles")
      ? fetchStoryCollection<StoryUnitProfile[]>(region, "unitProfiles", options)
      : Promise.resolve([]),
    names.includes("unitStoryEpisodeGroups")
      ? fetchStoryCollection<StoryUnitEpisodeGroup[]>(region, "unitStoryEpisodeGroups", options)
      : Promise.resolve([]),
    names.includes("eventStories")
      ? fetchStoryCollection<StoryEventStory[]>(region, "eventStories", options)
      : Promise.resolve([]),
    names.includes("events")
      ? fetchStoryCollection<StoryEvent[]>(region, "events", options)
      : Promise.resolve([]),
    names.includes("characterProfiles")
      ? fetchStoryCollection<StoryCharacterProfile[]>(region, "characterProfiles", options)
      : Promise.resolve([]),
    names.includes("cardEpisodes")
      ? fetchStoryCollection<StoryCardEpisode[]>(region, "cardEpisodes", options)
      : Promise.resolve([]),
    names.includes("cards")
      ? fetchStoryCollection<StoryCardSummary[]>(region, "cards", options)
      : Promise.resolve([]),
    names.includes("gameCharacters")
      ? fetchStoryCollection<StoryGameCharacter[]>(region, "gameCharacters", options)
      : Promise.resolve([]),
    names.includes("areas")
      ? fetchStoryCollection<StoryArea[]>(region, "areas", options)
      : Promise.resolve([]),
    names.includes("actionSets")
      ? fetchStoryCollection<StoryActionSet[]>(region, "actionSets", options)
      : Promise.resolve([]),
    names.includes("specialStories")
      ? fetchStoryCollection<StorySpecialStory[]>(region, "specialStories", options)
      : Promise.resolve([])
  ]);
  return {
    unitStories,
    unitProfiles,
    unitStoryEpisodeGroups,
    eventStories,
    events,
    characterProfiles,
    cardEpisodes,
    cards,
    gameCharacters,
    areas,
    actionSets,
    specialStories
  };
};

/** Server-side event-list query mirroring the content-site filter set. */
export interface StoryEventListQuery {
  page: number;
  pageSize: number;
  sortBy: "startAt" | "id";
  sortOrder: "desc" | "asc";
  name?: string;
  eventTypes?: string[];
  /** Unit slugs; `"mixed"` is sent as the backend value `"none"`. */
  units?: string[];
}

export interface StoryEventListPagination {
  page: number;
  hasNext: boolean;
  total: number | null;
}

export interface StoryEventListPage {
  items: unknown[];
  pagination: StoryEventListPagination;
}

/**
 * Fetches one page of the events collection with the picker's server-side
 * filters applied (sort, name, event types, unit affiliations). Unlike the
 * other story collections this is not cached: the paginated list must reflect
 * filter changes immediately.
 */
export const fetchEventListPage = async (
  region: StoryRouteRegion,
  query: StoryEventListQuery,
  options: StoryMasterDataClientOptions = {}
): Promise<StoryEventListPage> => {
  const fetcher = options.fetch ?? fetch;
  const baseUrl = resolveApiBaseUrl(options);
  const requestQuery: Record<string, string | number | boolean> = {
    page: query.page,
    page_size: query.pageSize,
    spoiler: true,
    sort_by: query.sortBy,
    sort_order: query.sortOrder
  };
  if (query.name) requestQuery.name = query.name;
  if (query.eventTypes?.length) requestQuery.event_type = query.eventTypes.join(",");
  if (query.units?.length) {
    requestQuery.unit = query.units.map((unit) => (unit === "mixed" ? "none" : unit)).join(",");
  }

  const response = await getEventsByRegionList({
    baseUrl,
    fetch: fetcher,
    path: { region },
    query: requestQuery
  });
  if (response.error || !response.data) {
    const status = response.response?.status ?? 0;
    // Region not synced yet — same tolerance as the other story collections.
    if (status === 503) {
      return { items: [], pagination: { page: query.page, hasNext: false, total: null } };
    }
    throw new Error(`Failed to fetch event list (${status || "unknown error"})`);
  }
  const rows = Array.isArray(response.data.items) ? response.data.items : [];
  const pagination = (response.data as { pagination?: Record<string, unknown> }).pagination ?? {};
  return {
    items: rows,
    pagination: {
      page: query.page,
      hasNext: pagination.has_next === true,
      total: typeof pagination.total === "number" ? pagination.total : null
    }
  };
};

/** Fetches the character identity tables used for names and part voices. */
export const fetchStoryCharacterTables = async (
  region: StoryRouteRegion,
  options: StoryMasterDataClientOptions = {}
): Promise<StoryCharacterTables> => {
  const [character2ds, gameCharacters, mobCharacters, subGameCharacters] =
    await Promise.all([
      fetchStoryCollection<unknown>(region, "character2ds", options),
      fetchStoryCollection<unknown>(region, "gameCharacters", options),
      fetchStoryCollection<unknown>(region, "mobCharacters", options),
      fetchStoryCollection<unknown>(region, "subGameCharacters", options)
    ]);

  const gameCharacterNames = new Map<number, string>();
  for (const row of asArray(gameCharacters)) {
    const r = row as Record<string, unknown>;
    const id = asNumber(r.id);
    gameCharacterNames.set(
      id,
      [asString(r.firstName), asString(r.givenName)].filter(Boolean).join(" ")
    );
  }
  const mobCharacterNames = new Map<number, string>();
  for (const row of asArray(mobCharacters)) {
    const r = row as Record<string, unknown>;
    mobCharacterNames.set(asNumber(r.id), asString(r.name));
  }
  const subGameCharacterNames = new Map<number, string>();
  for (const row of asArray(subGameCharacters)) {
    const r = row as Record<string, unknown>;
    subGameCharacterNames.set(asNumber(r.id), asString(r.name));
  }

  const character2dRows = asArray(character2ds).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: asNumber(r.id),
      characterType: asString(r.characterType),
      characterId: asNumber(r.characterId),
      unit: asOptionalString(r.unit),
      assetName: asOptionalString(r.assetName)
    };
  });

  return {
    character2ds: character2dRows,
    gameCharacterNames,
    mobCharacterNames,
    subGameCharacterNames
  };
};

/** Test-only: clears the in-memory collection cache. */
export const clearStoryMasterDataCacheForTests = (): void => {
  cache.clear();
};
