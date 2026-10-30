import {
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase
} from "#lib/story/story-resolver.server.js";
import { resolveStoryPage } from "#lib/story/story-page-load.server.js";
import { createStoryDocumentReference } from "#lib/story/story-document.server.js";
import type { PageServerLoad } from "./$types";

/**
 * Live2D Player StoryReader route. Resolves metadata and returns a
 * serializable scenario reference. Large scenario/model/media payloads are
 * loaded by the browser adapter after the user starts playback.
 */
export const load: PageServerLoad = async ({ params, fetch, url }) => {
  const page = await resolveStoryPage(params, fetch, url.origin);
  if (!page.ready) return page.page;
  const { identity } = page;

  const characters = await fetchStoryCharactersOrEmpty(identity.region, fetch);
  const voiceCharacters = characters.character2ds.map((character2d) => ({
    character2dId: character2d.id,
    assetName: character2d.assetName,
    unit: character2d.unit
  }));
  const storyDocument = createStoryDocumentReference({
    identity,
    resolution: page.value.resolution,
    assetBase: getStoryAssetBase(),
    voiceCharacters
  });

  return {
    identity,
    readerStatus: "ok" as const,
    story: storyDocument.story,
    storyDocument,
    neighbors: page.value.neighbors
  };
};
