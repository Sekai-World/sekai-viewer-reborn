import { PUBLIC_REMOTE_ASSET_BASE_URL } from "$app/env/public";
import type { StoryRouteIdentity } from "#lib/live2d/story-route.js";
import { parseScenarioData } from "./scenario-validation";
import type { IScenarioData } from "./scenario-types";
import { createStoryRegionAssetUrls, type StoryAssetUrls } from "./story-urls";
import {
  parseStoryId,
  resolveStoryIdentity,
  type StoryResolution,
  type StoryMasterCollections,
  type StoryResolutionResult
} from "./story-identity";
import {
  fetchStoryCardAssetbundleName,
  fetchStoryCharacterTables,
  fetchStoryCollections,
  type StoryCharacterTables
} from "./master-data-client.server";
import { resolveStoryNeighbors, type StoryNeighbors } from "./story-neighbors";

/**
 * Server-side story route resolution: master-data lookup, scenario document
 * fetch, and character identity tables for one validated route identity.
 */
const COLLECTIONS_BY_STORY_TYPE: Record<
  StoryRouteIdentity["storyType"],
  readonly (
    | "unitStories"
    | "eventStories"
    | "events"
    | "characterProfiles"
    | "cardEpisodes"
    | "actionSets"
    | "specialStories"
  )[]
> = {
  unit: ["unitStories"],
  event: ["eventStories", "events"],
  character: ["characterProfiles"],
  card: ["cardEpisodes"],
  "area-talk": ["actionSets"],
  special: ["specialStories"],
  profile: ["characterProfiles"]
};

/**
 * The collection a story type is looked up in. When the region has not synced
 * it, a missing story means "no data yet" rather than "no such story".
 */
const PRIMARY_COLLECTION_BY_STORY_TYPE: Record<StoryRouteIdentity["storyType"], string> = {
  unit: "unitStories",
  event: "eventStories",
  character: "characterProfiles",
  card: "cardEpisodes",
  "area-talk": "actionSets",
  special: "specialStories",
  profile: "characterProfiles"
};

/** Removes all trailing slashes. Equivalent to `.replace(/\/+$/, "")` but without regex backtracking. */
const stripTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
};

/** The configured remote asset origin (or same-origin dev path), without trailing slash. */
export const getStoryAssetBase = (): string =>
  stripTrailingSlashes(PUBLIC_REMOTE_ASSET_BASE_URL?.trim() || "https://storage.sekai.best");

/**
 * The asset origin for server-side `fetch` calls. A relative public base
 * (same-origin `/storage` path through the Vite dev proxy) must be qualified
 * with the request origin — Node `fetch` cannot resolve relative URLs.
 */
export const getStoryFetchBase = (requestOrigin?: string): string => {
  const base = getStoryAssetBase();
  if (!base.startsWith("/")) return base;
  return requestOrigin ? `${requestOrigin}${base}` : base;
};

export interface StoryRouteResolution {
  identity: StoryRouteIdentity;
  resolution: StoryResolution;
  urls: StoryAssetUrls;
  neighbors: StoryNeighbors;
}

export type ResolveStoryRouteResult =
  | { status: "ok"; value: StoryRouteResolution }
  | { status: "not-found" }
  /** The region has not synced the master data this story type is looked up in. */
  | { status: "region-unavailable" }
  | { status: "unsupported"; reason: string }
  | { status: "master-data-error"; error: Error };

/**
 * Card episodes of regions other than jp carry no `assetbundleName`; add the
 * episode's own card (same region) so the scenario path can be built. Returns
 * "unsynced" when the region has not synced cards yet.
 */
const withCardAssetbundle = async (
  identity: StoryRouteIdentity,
  collections: StoryMasterCollections,
  fetchFn: typeof fetch
): Promise<StoryMasterCollections | "unsynced"> => {
  if (identity.storyType !== "card") return collections;
  const parsed = parseStoryId("card", identity.storyId);
  if (parsed?.kind !== "card") return collections;
  const episode = collections.cardEpisodes.find((ce) => ce.id === parsed.cardEpisodeId);
  if (!episode || episode.assetbundleName) return collections;
  const lookup = await fetchStoryCardAssetbundleName(identity.region, episode.cardId, {
    fetch: fetchFn
  });
  if (lookup.status === "unsynced") return "unsynced";
  if (lookup.status === "not-found") return collections;
  return {
    ...collections,
    cards: [{ id: episode.cardId, name: "", assetBundleName: lookup.assetbundleName }]
  };
};

/**
 * Resolves a validated route identity to a scenario path using the raw
 * master-data mirrors. Never throws for data-level outcomes; only network
 * failures surface as `master-data-error`.
 */
export const resolveStoryRoute = async (
  identity: StoryRouteIdentity,
  fetchFn: typeof fetch,
  requestOrigin?: string
): Promise<ResolveStoryRouteResult> => {
  let result: StoryResolutionResult;
  let neighbors: StoryNeighbors;
  let regionSynced: boolean;
  try {
    const fetched = await fetchStoryCollections(
      identity.region,
      COLLECTIONS_BY_STORY_TYPE[identity.storyType],
      { fetch: fetchFn }
    );
    const collections = await withCardAssetbundle(identity, fetched, fetchFn);
    if (collections === "unsynced") return { status: "region-unavailable" };
    result = resolveStoryIdentity(
      identity.storyType,
      identity.storyId,
      collections,
      identity.region
    );
    neighbors = resolveStoryNeighbors(identity.storyType, identity.storyId, collections);
    regionSynced = !collections.unsyncedCollections?.includes(
      PRIMARY_COLLECTION_BY_STORY_TYPE[identity.storyType]
    );
  } catch (error) {
    return {
      status: "master-data-error",
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
  // Only a miss is reinterpreted: a story found in synced data stays ok.
  if (result.status === "not-found" && !regionSynced) return { status: "region-unavailable" };
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    value: {
      identity,
      resolution: result.resolution,
      urls: createStoryRegionAssetUrls(() => getStoryFetchBase(requestOrigin), identity.region),
      neighbors
    }
  };
};

/**
 * Fetches and validates a scenario JSON document from the region bucket.
 */
export const fetchScenarioDocument = async (
  urls: StoryAssetUrls,
  scenarioPath: string,
  fetchFn: typeof fetch
): Promise<IScenarioData> => {
  const response = await fetchFn(urls.region(scenarioPath));
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario document (${response.status})`);
  }
  return parseScenarioData(await response.json());
};

/**
 * Fetches the character identity tables (names, part-voice identity) for the
 * reader pages. Degrades to empty tables when the character collections are
 * unavailable so the page can still render dialogue text.
 */
export const fetchStoryCharactersOrEmpty = async (
  region: StoryRouteIdentity["region"],
  fetchFn: typeof fetch
): Promise<StoryCharacterTables> => {
  try {
    return await fetchStoryCharacterTables(region, { fetch: fetchFn });
  } catch {
    return {
      character2ds: [],
      gameCharacterNames: new Map(),
      mobCharacterNames: new Map(),
      subGameCharacterNames: new Map()
    };
  }
};
