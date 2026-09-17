import { json, error } from "@sveltejs/kit";
import { isStoryRouteRegion, storyRouteStoryTypes } from "$lib/live2d/story-route";
import {
  fetchEventListPage,
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
import { createStoryRegionAssetUrls, eventBannerImagePath } from "$lib/story/story-urls";
import { getStoryAssetBase } from "$lib/story/story-resolver.server";
import type { RequestHandler } from "./$types";

/** Event cards per page in the picker's first level (mirrors content-site). */
const EVENT_PAGE_SIZE = 12;

const splitParam = (value: string | null): string[] =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Story catalog for the reader's story picker. Lazy-loaded per region and
 * story type. Unit stories return a two-level shape (units → story lines →
 * episode cards with banner URLs); card/character/area-talk stories return
 * dedicated picker payloads (card art tiles / character busts / area cards
 * with world-map thumbnails) next to the generic grouped list as fallback;
 * the other types return grouped lists — card/area-talk lists run into the
 * thousands of rows, so they are never bundled into the landing page data.
 */
export const GET: RequestHandler = async ({ params, fetch, url }) => {
  const region = params.region?.trim().toLowerCase() ?? "";
  if (!isStoryRouteRegion(region)) {
    error(404, "Unsupported region");
  }
  const storyType = params.storyType?.trim() ?? "";
  if (!(storyRouteStoryTypes as readonly string[]).includes(storyType)) {
    error(404, "Unsupported story type");
  }

  if (storyType === "event") {
    // Two-level event picker, first level: the event list is served
    // paginated with the content-site filter set (sort, name, event type,
    // unit) applied server-side. Episode links are loaded per event from
    // the dedicated event-stories sub-route on drill-down.
    const searchParams = url.searchParams;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const sortBy = searchParams.get("sort_by") === "id" ? "id" : "startAt";
    const sortOrder = searchParams.get("sort_order") === "asc" ? "asc" : "desc";
    const name = searchParams.get("name")?.trim() ?? "";
    const eventTypes = splitParam(searchParams.get("event_type"));
    const units = splitParam(searchParams.get("unit"));

    const [collections, eventPage] = await Promise.all([
      fetchStoryCollections(region, ["unitProfiles"], { fetch }),
      fetchEventListPage(
        region,
        { page, pageSize: EVENT_PAGE_SIZE, sortBy, sortOrder, name, eventTypes, units },
        { fetch }
      )
    ]);

    const assetUrls = createStoryRegionAssetUrls(getStoryAssetBase, region);
    const events = eventPage.items.map((row) => {
      const r = row as Record<string, unknown>;
      const assetBundleName =
        typeof r.assetbundleName === "string" && r.assetbundleName.length > 0
          ? r.assetbundleName
          : null;
      return {
        eventId: Number(r.id),
        name: typeof r.name === "string" ? r.name : `#${String(r.id)}`,
        eventType:
          typeof r.eventType === "string" && r.eventType.length > 0 ? r.eventType : null,
        unit: typeof r.unit === "string" && r.unit.length > 0 ? r.unit : null,
        startAt: typeof r.startAt === "number" ? r.startAt : null,
        endAt: typeof r.endAt === "number" ? r.endAt : null,
        bannerUrl: assetBundleName
          ? assetUrls.region(eventBannerImagePath(assetBundleName))
          : null
      };
    });
    const unitOptions = (collections.unitProfiles ?? [])
      .slice()
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
      .map((profile) => ({ value: profile.unit, label: profile.unitName }));

    return json({
      storyType,
      events,
      pagination: eventPage.pagination,
      unitOptions
    });
  }

  const collections = await fetchStoryCollections(
    region,
    storyType === "unit"
      ? ["unitStories", "unitProfiles", "unitStoryEpisodeGroups"]
      : [
          "unitStories",
          "unitProfiles",
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
