import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "$lib/live2d/story-route";
import {
  fetchScenarioDocument,
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase,
  resolveStoryRoute
} from "$lib/story/story-resolver.server";
import { processScenarioDataForPlayer } from "$lib/story/scenario-process";
import { storyRegionBuckets } from "$lib/story/story-urls";
import type { PageServerLoad } from "./$types";

/**
 * Live2D Player StoryReader route. Resolves the story, fetches the scenario
 * document server-side, and returns the playback-ready scenario (First*
 * synthesis applied) plus the identity tables the browser session needs.
 * Pixi/Howler stay client-only.
 */
export const load: PageServerLoad = async ({ params, fetch }) => {
  const parsed = parseStoryRouteParams(params);
  if (parsed.status !== "ok") {
    error(404, "Story route not found");
  }
  const identity = parsed.identity;

  const resolved = await resolveStoryRoute(identity, fetch);
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

  const { resolution, urls } = resolved.value;

  try {
    const [scenarioData, characters] = await Promise.all([
      fetchScenarioDocument(urls, resolution.scenarioPath, fetch),
      fetchStoryCharactersOrEmpty(identity.region, fetch)
    ]);

    const processed = processScenarioDataForPlayer(identity, scenarioData);

    return {
      identity,
      readerStatus: "ok" as const,
      story: {
        chapterTitle: resolution.chapterTitle ?? "",
        episodeTitle: resolution.episodeTitle ?? "",
        scenarioId: resolution.scenarioId,
        bannerUrl: resolution.bannerPath
          ? urls.region(resolution.bannerPath)
          : undefined
      },
      isCardStory: resolution.isCardStory,
      isActionSet: resolution.isActionSet,
      assetBase: getStoryAssetBase(),
      regionBucket: storyRegionBuckets[identity.region],
      scenarioData: processed,
      voiceCharacters: characters.character2ds.map((character2d) => ({
        character2dId: character2d.id,
        assetName: character2d.assetName,
        unit: character2d.unit
      }))
    };
  } catch {
    return {
      identity,
      readerStatus: "scenario-error" as const
    };
  }
};
