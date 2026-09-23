import { error } from "@sveltejs/kit";
import { parseStoryRouteParams } from "$lib/live2d/story-route";
import {
  fetchScenarioDocument,
  fetchStoryCharactersOrEmpty,
  getStoryAssetBase,
  resolveStoryRoute
} from "$lib/story/story-resolver.server";
import { createStoryRegionAssetUrls } from "$lib/story/story-urls";
import { buildVoiceCharacterLookup, flattenScenarioToRows } from "$lib/story/scenario-rows";
import type { PageServerLoad } from "./$types";

/**
 * Text-only StoryReader route. Resolves the story against raw master data,
 * fetches the scenario document server-side, and flattens it into
 * script-style rows. Row media URLs stay relative to the configured asset
 * base so the browser resolves them against whichever host it is on.
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

  const { resolution } = resolved.value;
  // Client-facing URLs keep the configured (possibly relative) asset base.
  const pageUrls = createStoryRegionAssetUrls(getStoryAssetBase, identity.region);

  try {
    const [scenarioData, characters] = await Promise.all([
      fetchScenarioDocument(resolved.value.urls, resolution.scenarioPath, fetch),
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
          return { ...row, imageUrl: pageUrls.region(row.imagePath) };
        case "bgm":
          return { ...row, url: pageUrls.region(row.path) };
        case "se":
          return { ...row, urls: row.paths.map((path) => pageUrls.region(path)) };
        case "talk":
        case "fullscreen-text":
          return {
            ...row,
            voiceUrls: row.voicePaths.map((path) => pageUrls.region(path))
          };
        case "movie":
          return { ...row, fallbackUrl: pageUrls.region(row.fallbackPath) };
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
        bannerUrl: resolution.bannerPath ? pageUrls.region(resolution.bannerPath) : undefined
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
