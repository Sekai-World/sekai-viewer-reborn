import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "#lib/live2d/story-route.js";
import {
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase,
  resolveStoryRoute
} from "#lib/story/story-resolver.server.js";
import { createStoryDocumentReference } from "#lib/story/story-document.server.js";
import type { PageServerLoad } from "./$types";

/**
 * Live2D Player StoryReader route. Resolves metadata and returns a
 * serializable scenario reference. Large scenario/model/media payloads are
 * loaded by the browser adapter after the user starts playback.
 */
export const load: PageServerLoad = async ({ params, fetch, url }) => {
  const parsed = parseStoryRouteParams(params);
  if (parsed.status !== "ok") {
    error(404, "Story route not found");
  }
  const identity = parsed.identity;

  const resolved = await resolveStoryRoute(identity, fetch, url.origin);
  if (resolved.status === "not-found") {
    error(404, "Story not found");
  }
  if (resolved.status === "master-data-error") {
    return {
      identity,
      readerStatus: "unavailable" as const
    };
  }
  if (resolved.status === "unsupported") {
    return {
      identity,
      readerStatus: "unsupported-story" as const,
      reason: resolved.reason
    };
  }

  const characters = await fetchStoryCharactersOrEmpty(identity.region, fetch);
  const voiceCharacters = characters.character2ds.map((character2d) => ({
    character2dId: character2d.id,
    assetName: character2d.assetName,
    unit: character2d.unit
  }));
  const storyDocument = createStoryDocumentReference({
    identity,
    resolution: resolved.value.resolution,
    assetBase: getStoryAssetBase(),
    voiceCharacters
  });

  return {
    identity,
    readerStatus: "ok" as const,
    story: storyDocument.story,
    storyDocument
  };
};
