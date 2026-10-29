import type {
  StoryDocumentReference,
  StoryVoiceCharacterReference
} from "$lib/live2d/story-document";
import type { StoryRouteIdentity } from "$lib/live2d/story-route";
import { createStoryAssetResolver } from "./story-urls";
import type { StoryResolution } from "./story-identity";

export interface CreateStoryDocumentReferenceOptions {
  identity: StoryRouteIdentity;
  resolution: StoryResolution;
  assetBase: string;
  voiceCharacters: StoryVoiceCharacterReference[];
}

/**
 * Produces the serializable route descriptor. Large scenario/model/media data
 * stays on the browser path; server load never imports the player runtime.
 */
export const createStoryDocumentReference = ({
  identity,
  resolution,
  assetBase,
  voiceCharacters
}: CreateStoryDocumentReferenceOptions): StoryDocumentReference => {
  const assets = createStoryAssetResolver(() => assetBase, identity.region);

  return {
    identity,
    story: {
      scenarioId: resolution.scenarioId,
      ...(resolution.chapterTitle ? { chapterTitle: resolution.chapterTitle } : {}),
      ...(resolution.episodeTitle ? { episodeTitle: resolution.episodeTitle } : {}),
      ...(resolution.bannerPath ? { bannerUrl: assets.image(resolution.bannerPath) } : {})
    },
    scenario: {
      scenarioId: resolution.scenarioId,
      path: resolution.scenarioPath,
      url: assets.scenario(resolution.scenarioPath)
    },
    assetBase,
    isCardStory: resolution.isCardStory,
    isActionSet: resolution.isActionSet,
    voiceCharacters
  };
};
