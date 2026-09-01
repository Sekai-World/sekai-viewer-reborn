import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "$lib/live2d/story-route";
import type { PageServerLoad } from "./$types";

/**
 * Metadata-only route shell. Scenario and story fetching stay out of this
 * loader until the player adapter work lands; the page renders stubbed route
 * metadata only.
 */
export const load: PageServerLoad = async ({ params }) => {
  const parsed = parseStoryRouteParams(params);
  if (parsed.status !== "ok") {
    error(404, "Story route not found");
  }

  return {
    identity: parsed.identity,
    readerStatus: "awaiting-player-adapter" as const
  };
};
