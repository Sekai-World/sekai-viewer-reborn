import { json, error } from "@sveltejs/kit";
import { isStoryRouteRegion, storyRouteStoryTypes } from "$lib/live2d/story-route";
import {
  fetchStoryCollection,
  fetchStoryCollections
} from "$lib/story/master-data-client.server";
import {
  buildStoryAreaTalkPicker,
  buildStoryCardPicker,
  buildStoryCatalog,
  buildStoryCharacterPicker,
  buildUnitStoryCatalog
} from "$lib/story/story-identity";
import { createStoryRegionAssetUrls } from "$lib/story/story-urls";
import { getStoryAssetBase } from "$lib/story/story-resolver.server";
import type { RequestHandler } from "./$types";

/**
 * Story catalog for the reader's story picker. Lazy-loaded per region and
 * story type. Unit stories return a two-level shape (units → story lines →
 * episode cards with banner URLs); card/character/area-talk stories return
 * dedicated picker payloads (card art tiles / character busts / area cards
 * with world-map thumbnails) next to the generic grouped list as fallback;
 * the other types return grouped lists — card/area-talk lists run into the
 * thousands of rows, so they are never bundled into the landing page data.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const region = params.region?.trim().toLowerCase() ?? "";
  if (!isStoryRouteRegion(region)) {
    error(404, "Unsupported region");
  }
  const storyType = params.storyType?.trim() ?? "";
  if (!(storyRouteStoryTypes as readonly string[]).includes(storyType)) {
    error(404, "Unsupported story type");
  }

  const collections = await fetchStoryCollections(
    region,
    storyType === "unit"
      ? ["unitStories", "unitProfiles", "unitStoryEpisodeGroups"]
      : [
          "unitStories",
          "unitProfiles",
          "eventStories",
          "events",
          "characterProfiles",
          "cardEpisodes",
          ...(storyType === "card" ? (["cards"] as const) : []),
          ...(storyType === "character" ? (["gameCharacters"] as const) : []),
          ...(storyType === "area-talk"
            ? (["areas"] as const)
            : []),
          "actionSets",
          "specialStories"
        ],
    { fetch }
  );

  if (storyType === "unit") {
    const assetUrls = createStoryRegionAssetUrls(getStoryAssetBase, region);
    const units = buildUnitStoryCatalog(collections).map((unit) => ({
      ...unit,
      groups: unit.groups.map((group) => ({
        ...group,
        episodes: group.episodes.map((episode) => ({
          ...episode,
          bannerUrl: assetUrls.region(episode.bannerPath)
        }))
      }))
    }));
    return json({ storyType, units });
  }

  const groups = buildStoryCatalog(
    storyType as (typeof storyRouteStoryTypes)[number],
    collections
  );

  if (storyType === "character") {
    return json({
      storyType,
      groups,
      characters: buildStoryCharacterPicker(collections)
    });
  }

  if (storyType === "card") {
    const assetUrls = createStoryRegionAssetUrls(getStoryAssetBase, region);
    const cards = buildStoryCardPicker(collections).map((card) => ({
      ...card,
      thumbnailUrl: card.thumbnailPath
        ? assetUrls.region(card.thumbnailPath)
        : null
    }));
    return json({ storyType, groups, cards });
  }

  if (storyType === "area-talk") {
    // Casts on action sets are `character2ds.id` values; map them to game
    // character ids so the picker can render local bust thumbnails.
    const character2dRows = await fetchStoryCollection<
      { id: number; characterType?: string; characterId: number }[]
    >(region, "character2ds", { fetch });
    const gameCharacterIdBy2dId = new Map(
      character2dRows
        .filter((row) => row.characterType === "game_character")
        .map((row) => [row.id, row.characterId])
    );
    const assetUrls = createStoryRegionAssetUrls(getStoryAssetBase, region);
    const areas = buildStoryAreaTalkPicker(
      collections,
      gameCharacterIdBy2dId
    ).map((area) => ({
      ...area,
      thumbnailUrl: area.thumbnailPath
        ? assetUrls.region(area.thumbnailPath)
        : null
    }));
    return json({ storyType, groups, areas });
  }

  return json({ storyType, groups });
};
