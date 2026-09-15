import { json, error } from "@sveltejs/kit";
import { isStoryRouteRegion, storyRouteStoryTypes } from "$lib/live2d/story-route";
import { fetchStoryCollections } from "$lib/story/master-data-client.server";
import { buildStoryCatalog, buildUnitStoryCatalog } from "$lib/story/story-identity";
import { createStoryRegionAssetUrls } from "$lib/story/story-urls";
import { getStoryAssetBase } from "$lib/story/story-resolver.server";
import type { RequestHandler } from "./$types";

/**
 * Story catalog for the reader's story picker. Lazy-loaded per region and
 * story type. Unit stories return a two-level shape (units → story lines →
 * episode cards with banner URLs); the other types return grouped lists —
 * card/area-talk lists run into the thousands of rows, so they are never
 * bundled into the landing page data.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const region = params.region?.trim().toLowerCase() ?? "";
  if (!isStoryRouteRegion(region)) {
    error(404, "Unsupported region");
  }
  const storyType = params.storyType?.trim() ?? "";
  if (!(storyRouteStoryTypes as readonly string[]).includes(storyType)) {
    error(404, "Unsupported story type");
  }

  const collections = await fetchStoryCollections(
    region,
    storyType === "unit"
      ? ["unitStories", "unitProfiles", "unitStoryEpisodeGroups"]
      : [
          "unitStories",
          "unitProfiles",
          "eventStories",
          "events",
          "characterProfiles",
          "cardEpisodes",
          "actionSets",
          "specialStories"
        ],
    { fetch }
  );

  if (storyType === "unit") {
    const assetUrls = createStoryRegionAssetUrls(getStoryAssetBase, region);
    const units = buildUnitStoryCatalog(collections).map((unit) => ({
      ...unit,
      groups: unit.groups.map((group) => ({
        ...group,
        episodes: group.episodes.map((episode) => ({
          ...episode,
          bannerUrl: assetUrls.region(episode.bannerPath)
        }))
      }))
    }));
    return json({ storyType, units });
  }

  const groups = buildStoryCatalog(
    storyType as (typeof storyRouteStoryTypes)[number],
    collections
  );
  return json({ storyType, groups });
};
