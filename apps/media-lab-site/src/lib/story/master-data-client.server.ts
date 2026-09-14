import { env } from "$env/dynamic/private";
import type { StoryRouteRegion } from "$lib/live2d/story-route";
import type {
  StoryActionSet,
  StoryCardEpisode,
  StoryCharacterProfile,
  StoryEvent,
  StoryEventStory,
  StoryMasterCollections,
  StorySpecialStory,
  StoryUnitStory
} from "./story-identity";

/**
 * Server-side client for raw story master data on the published
 * `sekai-master-db*diff` GitHub Pages mirrors. Collections are fetched
 * whole, parsed defensively, and cached in memory with a bounded TTL —
 * the story feature only needs a handful of small collections.
 */

const DEFAULT_MASTER_DB_BASE_URL = "https://sekai-world.github.io";

const REGION_REPO_SUFFIX: Record<StoryRouteRegion, string> = {
  jp: "sekai-master-db-diff",
  en: "sekai-master-db-en-diff",
  tw: "sekai-master-db-tc-diff",
  kr: "sekai-master-db-kr-diff",
  cn: "sekai-master-db-cn-diff"
};

/** Story master data collections, by logical name. */
export type StoryCollectionName =
  | "unitStories"
  | "eventStories"
  | "events"
  | "characterProfiles"
  | "cardEpisodes"
  | "actionSets"
  | "specialStories"
  | "character2ds"
  | "gameCharacters"
  | "mobCharacters"
  | "subGameCharacters";

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface StoryMasterDataClientOptions {
  fetch?: typeof fetch;
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
                releaseConditionId: asOptionalNumber(e.releaseConditionId)
              };
            })
          };
        })
      };
      return unitStory;
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
      const event: StoryEvent = { id: asNumber(r.id), name: asString(r.name) };
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
      const episode: StoryCardEpisode = {
        id: asNumber(r.id),
        cardId: asNumber(r.cardId),
        title: asString(r.title),
        scenarioId: asString(r.scenarioId),
        assetbundleName: asOptionalString(r.assetbundleName),
        releaseConditionId: asOptionalNumber(r.releaseConditionId)
      };
      return episode;
    }),
  actionSets: (raw) =>
    asArray(raw).map((row) => {
      const r = row as Record<string, unknown>;
      const actionSet: StoryActionSet = {
        id: asNumber(r.id),
        areaId: asNumber(r.areaId),
        scriptId: asOptionalString(r.scriptId),
        scenarioId: asOptionalString(r.scenarioId)
      };
      return actionSet;
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
  gameCharacters: (raw) => raw,
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

/**
 * Fetches one collection for a region. A collection missing on a regional
 * mirror resolves to an empty array (regional diffs roll out at different
 * times); a malformed payload throws.
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

  const base = (
    options.baseUrl ??
    env.SEKAI_MASTER_DB_BASE_URL?.trim() ??
    DEFAULT_MASTER_DB_BASE_URL
  ).replace(/\/+$/, "");
  const url = `${base}/${REGION_REPO_SUFFIX[region]}/${name}.json`;

  const response = await (options.fetch ?? fetch)(url);
  if (response.status === 404) {
    // Not (yet) published for this regional mirror.
    const empty = collectionParsers[name]([]) as T;
    evictIfNeeded(now(), ttlMs);
    cache.set(key, { value: empty, expiresAt: now() + ttlMs });
    return empty;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch story master data ${name} (${response.status})`);
  }
  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) {
    throw new Error(`Story master data ${name} is malformed`);
  }
  const parsed = collectionParsers[name](raw) as T;
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
  const [unitStories, eventStories, events, characterProfiles, cardEpisodes, actionSets, specialStories] =
    await Promise.all([
      names.includes("unitStories")
        ? fetchStoryCollection<StoryUnitStory[]>(region, "unitStories", options)
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
      names.includes("actionSets")
        ? fetchStoryCollection<StoryActionSet[]>(region, "actionSets", options)
        : Promise.resolve([]),
      names.includes("specialStories")
        ? fetchStoryCollection<StorySpecialStory[]>(region, "specialStories", options)
        : Promise.resolve([])
    ]);
  return {
    unitStories,
    eventStories,
    events,
    characterProfiles,
    cardEpisodes,
    actionSets,
    specialStories
  };
};

const requireArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("Character table is malformed");
  return value;
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
  for (const row of requireArray(gameCharacters)) {
    const r = row as Record<string, unknown>;
    const id = asNumber(r.id);
    gameCharacterNames.set(
      id,
      [asString(r.firstName), asString(r.givenName)].filter(Boolean).join(" ")
    );
  }
  const mobCharacterNames = new Map<number, string>();
  for (const row of requireArray(mobCharacters)) {
    const r = row as Record<string, unknown>;
    mobCharacterNames.set(asNumber(r.id), asString(r.name));
  }
  const subGameCharacterNames = new Map<number, string>();
  for (const row of requireArray(subGameCharacters)) {
    const r = row as Record<string, unknown>;
    subGameCharacterNames.set(asNumber(r.id), asString(r.name));
  }

  const character2dRows = requireArray(character2ds).map((row) => {
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
