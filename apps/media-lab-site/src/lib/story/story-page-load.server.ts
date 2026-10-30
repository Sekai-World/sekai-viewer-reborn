import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "#lib/live2d/story-route.js";
import type { StoryRouteIdentity } from "#lib/live2d/story-route.js";
import { resolveStoryRoute } from "./story-resolver.server.js";
import type { StoryRouteResolution } from "./story-resolver.server.js";

type StoryPageFallback =
  | { identity: StoryRouteIdentity; readerStatus: "region-unavailable" }
  | { identity: StoryRouteIdentity; readerStatus: "unavailable" }
  | { identity: StoryRouteIdentity; readerStatus: "unsupported-story"; reason: string };

export type StoryPageResolution =
  | { ready: false; page: StoryPageFallback }
  | { ready: true; identity: StoryRouteIdentity; value: StoryRouteResolution };

/**
 * Shared front half of both StoryReader loaders: parses the route, resolves
 * the story, and maps every non-playable outcome to the page state the
 * reader shows. A bad route or unknown story throws a 404.
 */
export const resolveStoryPage = async (
  params: Record<string, string>,
  fetchFn: typeof fetch,
  origin: string
): Promise<StoryPageResolution> => {
  const parsed = parseStoryRouteParams(params);
  if (parsed.status !== "ok") {
    error(404, "Story route not found");
  }
  const identity = parsed.identity;

  const resolved = await resolveStoryRoute(identity, fetchFn, origin);
  switch (resolved.status) {
    case "not-found":
      error(404, "Story not found");
      break;
    case "region-unavailable":
      return { ready: false, page: { identity, readerStatus: "region-unavailable" } };
    case "master-data-error":
      return { ready: false, page: { identity, readerStatus: "unavailable" } };
    case "unsupported":
      return {
        ready: false,
        page: { identity, readerStatus: "unsupported-story", reason: resolved.reason }
      };
    default:
      return { ready: true, identity, value: resolved.value };
  }
};
