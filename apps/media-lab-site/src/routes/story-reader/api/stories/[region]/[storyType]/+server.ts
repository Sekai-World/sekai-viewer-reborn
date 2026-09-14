import { json, error } from "@sveltejs/kit";
import { isStoryRouteRegion, storyRouteStoryTypes } from "$lib/live2d/story-route";
import { fetchStoryCollections } from "$lib/story/master-data-client.server";
import { buildStoryCatalog } from "$lib/story/story-identity";
import type { RequestHandler } from "./$types";

/**
 * Slim story catalog for the reader's story picker. Lazy-loaded per region
 * and story type; card/area-talk lists run into the thousands of rows, so
 * they are never bundled into the landing page data.
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

  const collections = await fetchStoryCollections(region, [
    "unitStories",
    "unitProfiles",
    "eventStories",
    "events",
    "characterProfiles",
    "cardEpisodes",
    "actionSets",
    "specialStories"
  ], { fetch });

  const groups = buildStoryCatalog(
    storyType as (typeof storyRouteStoryTypes)[number],
    collections
  );
  return json({ storyType, groups });
};
