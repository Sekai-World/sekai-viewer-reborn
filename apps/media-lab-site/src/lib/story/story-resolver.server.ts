import { env as publicEnv } from "$env/dynamic/public";
import type { StoryRouteIdentity } from "$lib/live2d/story-route";
import { parseScenarioData } from "./scenario-process";
import type { IScenarioData } from "./scenario-types";
import {
  createStoryRegionAssetUrls,
  type StoryAssetUrls
} from "./story-urls";
import {
  resolveStoryIdentity,
  type StoryResolution,
  type StoryResolutionResult
} from "./story-identity";
import {
  fetchStoryCharacterTables,
  fetchStoryCollections,
  type StoryCharacterTables
} from "./master-data-client.server";

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

/** The configured remote asset origin, without trailing slash. */
export const getStoryAssetBase = (): string =>
  (
    publicEnv.PUBLIC_REMOTE_ASSET_BASE_URL?.trim() ||
    "https://storage.sekai.best"
  ).replace(/\/+$/, "");

export interface StoryRouteResolution {
  identity: StoryRouteIdentity;
  resolution: StoryResolution;
  urls: StoryAssetUrls;
}

export type ResolveStoryRouteResult =
  | { status: "ok"; value: StoryRouteResolution }
  | { status: "not-found" }
  | { status: "unsupported"; reason: string }
  | { status: "master-data-error"; error: Error };

/**
 * Resolves a validated route identity to a scenario path using the raw
 * master-data mirrors. Never throws for data-level outcomes; only network
 * failures surface as `master-data-error`.
 */
export const resolveStoryRoute = async (
  identity: StoryRouteIdentity,
  fetchFn: typeof fetch
): Promise<ResolveStoryRouteResult> => {
  let result: StoryResolutionResult;
  try {
    const collections = await fetchStoryCollections(
      identity.region,
      COLLECTIONS_BY_STORY_TYPE[identity.storyType],
      { fetch: fetchFn }
    );
    result = resolveStoryIdentity(
      identity.storyType,
      identity.storyId,
      collections,
      identity.region
    );
  } catch (error) {
    return {
      status: "master-data-error",
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    value: {
      identity,
      resolution: result.resolution,
      urls: createStoryRegionAssetUrls(getStoryAssetBase, identity.region)
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
