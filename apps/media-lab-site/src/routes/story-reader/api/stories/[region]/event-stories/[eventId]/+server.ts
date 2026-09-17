import { error, json } from "@sveltejs/kit";
import { isStoryRouteRegion } from "$lib/live2d/story-route";
import { fetchEventStoriesByEvent } from "$lib/story/master-data-client.server";
import { buildEventStoryEpisodeLinks } from "$lib/story/story-identity";
import { createStoryRegionAssetUrls } from "$lib/story/story-urls";
import { getStoryAssetBase } from "$lib/story/story-resolver.server";
import type { RequestHandler } from "./$types";

/**
 * Second level of the event picker: the playable episode links of one
 * event, loaded on drill-down through the sekai-master-api eventStories
 * list endpoint's `event_id` filter instead of shipping the full
 * collection with the event list.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const region = params.region?.trim().toLowerCase() ?? "";
  if (!isStoryRouteRegion(region)) {
    error(404, "Unsupported region");
  }
  const eventId = Number(params.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    error(404, "Unsupported event id");
  }

  try {
    const stories = await fetchEventStoriesByEvent(region, eventId, { fetch });
    const assetUrls = createStoryRegionAssetUrls(getStoryAssetBase, region);
    return json({
      storyType: "event",
      eventId,
      episodes: buildEventStoryEpisodeLinks(stories).map((episode) => ({
        ...episode,
        bannerUrl: assetUrls.region(episode.bannerPath)
      }))
    });
  } catch (cause) {
    console.error("Failed to load event story episodes:", cause);
    error(502, "Failed to load event story episodes");
  }
};
