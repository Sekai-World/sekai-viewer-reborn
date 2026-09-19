import { json, error } from "@sveltejs/kit";
import {
  isStoryRouteRegion,
  storyRouteStoryTypes,
  type StoryRouteRegion
} from "$lib/live2d/story-route";
import {
  fetchCardEpisodesByCardIds,
  fetchCardListPage,
  fetchEventListPage,
  fetchStoryCollection,
  fetchStoryCollections,
  type StoryCollectionName
} from "$lib/story/master-data-client.server";
import {
  buildStoryAreaTalkPicker,
  buildStoryCardPickerFromPage,
  buildStoryCatalog,
  buildStoryCharacterPicker,
  buildUnitStoryCatalog,
  type StoryMasterCollections
} from "$lib/story/story-identity";
import { createStoryRegionAssetUrls, eventBannerImagePath } from "$lib/story/story-urls";
import { getStoryAssetBase } from "$lib/story/story-resolver.server";
import type { RequestHandler } from "./$types";

/** Event / card rows per page in the picker's first level (mirrors content-site). */
const EVENT_PAGE_SIZE = 12;
const CARD_PAGE_SIZE = 12;

const splitParam = (value: string | null): string[] =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const regionAssetUrls = (region: StoryRouteRegion) =>
  createStoryRegionAssetUrls(getStoryAssetBase, region);

const unitOptionsOf = (unitProfiles: StoryMasterCollections["unitProfiles"]) =>
  (unitProfiles ?? [])
    .slice()
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((profile) => ({ value: profile.unit, label: profile.unitName }));

/** Collections each remaining picker type actually reads. */
const collectionsForPicker = (storyType: string): StoryCollectionName[] => {
  switch (storyType) {
    case "unit":
      return ["unitStories", "unitProfiles", "unitStoryEpisodeGroups"];
    case "character":
      return ["characterProfiles", "gameCharacters"];
    case "area-talk":
      return ["actionSets", "areas"];
    default:
      return ["specialStories"];
  }
};

const eventPickerPayload = async (
  region: StoryRouteRegion,
  fetcher: typeof fetch,
  searchParams: URLSearchParams
): Promise<Response> => {
  // Two-level event picker, first level: the event list is served
  // paginated with the content-site filter set (sort, name, event type,
  // unit) applied server-side. Episode links are loaded per event from
  // the dedicated event-stories sub-route on drill-down.
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sortBy = searchParams.get("sort_by") === "id" ? "id" : "startAt";
  const sortOrder = searchParams.get("sort_order") === "asc" ? "asc" : "desc";
  const name = searchParams.get("name")?.trim() ?? "";
  const eventTypes = splitParam(searchParams.get("event_type"));
  const units = splitParam(searchParams.get("unit"));

  const [collections, eventPage] = await Promise.all([
    fetchStoryCollections(region, ["unitProfiles"], { fetch: fetcher }),
    fetchEventListPage(
      region,
      { page, pageSize: EVENT_PAGE_SIZE, sortBy, sortOrder, name, eventTypes, units },
      { fetch: fetcher }
    )
  ]);

  const assetUrls = regionAssetUrls(region);
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

  return json({
    storyType: "event",
    events,
    pagination: eventPage.pagination,
    unitOptions: unitOptionsOf(collections.unitProfiles)
  });
};

const cardPickerPayload = async (
  region: StoryRouteRegion,
  fetcher: typeof fetch,
  searchParams: URLSearchParams
): Promise<Response> => {
  // Two-level paginated card picker, first level: the card list is served
  // paginated with the content-site filter set (sort, name, unit/
  // character/skill/type/attr/rarity/support unit, 3dmv cut-in, spoiler)
  // applied server-side. The episode links of just the returned cards
  // ride along via the cardEpisodes card_id filter.
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sortBy = searchParams.get("sort_by") === "id" ? "id" : "releaseAt";
  const sortOrder = searchParams.get("sort_order") === "asc" ? "asc" : "desc";
  const name = searchParams.get("name")?.trim() ?? "";
  const spoiler = searchParams.get("spoiler") !== "false";

  const [metaCollections, cardPage] = await Promise.all([
    fetchStoryCollections(region, ["unitProfiles", "gameCharacters"], { fetch: fetcher }),
    fetchCardListPage(
      region,
      {
        page,
        pageSize: CARD_PAGE_SIZE,
        sortBy,
        sortOrder,
        name,
        units: splitParam(searchParams.get("unit")),
        characters: splitParam(searchParams.get("character")),
        skills: splitParam(searchParams.get("skill")),
        types: splitParam(searchParams.get("type")),
        attrs: splitParam(searchParams.get("attr")),
        rarities: splitParam(searchParams.get("rarity")),
        supportUnits: splitParam(searchParams.get("support_unit")),
        has3dmvCutIn: searchParams.get("has_3dmv_cut_in") === "true",
        spoiler
      },
      { fetch: fetcher }
    )
  ]);

  const episodes = await fetchCardEpisodesByCardIds(
    region,
    cardPage.items.map((card) => card.id),
    { fetch: fetcher }
  );
  const assetUrls = regionAssetUrls(region);
  const cards = buildStoryCardPickerFromPage(cardPage.items, episodes).map((card) => ({
    ...card,
    thumbnailUrl: card.thumbnailPath
      ? assetUrls.region(card.thumbnailPath)
      : null
  }));
  const characterOptions = (metaCollections.gameCharacters ?? [])
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((character) => ({
      value: String(character.id),
      label:
        [character.firstName, character.givenName].filter(Boolean).join(" ").trim() ||
        `#${character.id}`
    }));

  return json({
    storyType: "card",
    cards,
    pagination: cardPage.pagination,
    unitOptions: unitOptionsOf(metaCollections.unitProfiles),
    characterOptions
  });
};

const unitCatalogPayload = (
  collections: StoryMasterCollections,
  region: StoryRouteRegion
): Response => {
  const assetUrls = regionAssetUrls(region);
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
  return json({ storyType: "unit", units });
};

const areaTalkPickerPayload = async (
  region: StoryRouteRegion,
  fetcher: typeof fetch,
  collections: StoryMasterCollections,
  groups: ReturnType<typeof buildStoryCatalog>
): Promise<Response> => {
  // Casts on action sets are `character2ds.id` values; map them to game
  // character ids so the picker can render local bust thumbnails.
  const character2dRows = await fetchStoryCollection<
    { id: number; characterType?: string; characterId: number }[]
  >(region, "character2ds", { fetch: fetcher });
  const gameCharacterIdBy2dId = new Map(
    character2dRows
      .filter((row) => row.characterType === "game_character")
      .map((row) => [row.id, row.characterId])
  );
  const assetUrls = regionAssetUrls(region);
  const areas = buildStoryAreaTalkPicker(
    collections,
    gameCharacterIdBy2dId
  ).map((area) => ({
    ...area,
    thumbnailUrl: area.thumbnailPath
      ? assetUrls.region(area.thumbnailPath)
      : null
  }));
  return json({ storyType: "area-talk", groups, areas });
};

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
    return eventPickerPayload(region, fetch, url.searchParams);
  }
  if (storyType === "card") {
    return cardPickerPayload(region, fetch, url.searchParams);
  }

  // Each type fetches only the collections its picker actually reads —
  // cardEpisodes/actionSets run into thousands of rows, so sharing one
  // superset list made every picker pay for collections it never uses.
  const collections = await fetchStoryCollections(
    region,
    collectionsForPicker(storyType),
    { fetch }
  );

  if (storyType === "unit") {
    return unitCatalogPayload(collections, region);
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
  if (storyType === "area-talk") {
    return areaTalkPickerPayload(region, fetch, collections, groups);
  }

  return json({ storyType, groups });
};
