import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "$lib/live2d/story-route";
import type { PageServerLoad } from "./$types";

/**
 * Text-only StoryReader route shell. Reuses the shared story-route param
 * validation; scenario text fetching stays out of this loader until the text
 * reader work lands, so the page renders stubbed route metadata only.
 */
export const load: PageServerLoad = async ({ params }) => {
  const parsed = parseStoryRouteParams(params);
  if (parsed.status !== "ok") {
    error(404, "Story route not found");
  }

  return {
    identity: parsed.identity,
    readerStatus: "awaiting-text-reader" as const
  };
};
