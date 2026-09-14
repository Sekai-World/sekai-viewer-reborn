import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "$lib/live2d/story-route";
import {
  fetchScenarioDocument,
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase,
  resolveStoryRoute
} from "$lib/story/story-resolver.server";
import {
  buildVoiceCharacterLookup,
  flattenScenarioToRows
} from "$lib/story/scenario-rows";
import type { PageServerLoad } from "./$types";

/**
 * Text-only StoryReader route. Resolves the story against raw master data,
 * fetches the scenario document server-side, and flattens it into
 * script-style rows with fully resolved media URLs.
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

    const voiceCharacters = buildVoiceCharacterLookup(characters);
    const document_ = flattenScenarioToRows(scenarioData, characters, voiceCharacters, {
      isCardStory: resolution.isCardStory,
      isActionSet: resolution.isActionSet
    });

    const rows = document_.rows.map((row) => {
      switch (row.kind) {
        case "background":
          return { ...row, imageUrl: urls.region(row.imagePath) };
        case "bgm":
          return { ...row, url: urls.region(row.path) };
        case "se":
          return { ...row, urls: row.paths.map((path) => urls.region(path)) };
        case "talk":
          return {
            ...row,
            voiceUrls: row.voicePaths.map((path) => urls.region(path))
          };
        case "fullscreen-text":
          return {
            ...row,
            voiceUrls: row.voicePaths.map((path) => urls.region(path))
          };
        case "movie":
          return { ...row, fallbackUrl: urls.region(row.fallbackPath) };
        default:
          return row;
      }
    });

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
      assetBase: getStoryAssetBase(),
      cast: document_.cast,
      rows
    };
  } catch {
    return {
      identity,
      readerStatus: "scenario-error" as const
    };
  }
};
