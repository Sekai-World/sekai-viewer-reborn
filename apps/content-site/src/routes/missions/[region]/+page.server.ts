import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createEmptyMissionListPage,
  fetchCharacterMissions,
  fetchMissionListPage,
  fetchNormalMissions,
  fetchStoryMissions,
  parseMissionCharacterId,
  parseMissionFamily
} from "$lib/server/mission-list";
import { missionFamilies, type Mission, type MissionFamily } from "$lib/domain/mission";
import type { PageServerLoad } from "./$types";

type MissionCatalogueQuery = {
  family: MissionFamily | null;
  /** Only set for Character Missions. */
  character: number | null;
};

type MissionFamilyOverview = {
  family: MissionFamily;
  summary: Promise<{ items: Mission[]; total: number | null; loadFailed: boolean }>;
};

type StoryMissionLadder = Promise<{ items: Mission[]; loadFailed: boolean }>;

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const requestedFamily = parseMissionFamily(url.searchParams);
  const query: MissionCatalogueQuery = {
    family: requestedFamily,
    character:
      requestedFamily === "characterMissionV2s" ? parseMissionCharacterId(url.searchParams) : null
  };
  const baseUrl = getMasterApiBaseUrl();

  if (query.family === null) {
    // Stream each family separately so a slow family does not hold back the others.
    const familyOverviews: MissionFamilyOverview[] = missionFamilies.map((family) => ({
      family,
      summary: fetchMissionListPage(baseUrl, region, [family], 1)
        .then((page) => ({
          items: page.items,
          total: page.pagination.total,
          loadFailed: false
        }))
        .catch(() => ({ items: [], total: null, loadFailed: true }))
    }));

    return {
      region,
      query,
      catalogue: null,
      familyOverviews,
      storyMissions: null
    };
  }

  if (query.family === "storyMissions") {
    // Story missions have no text; the page shows the whole target ladder instead of paging it.
    const storyMissions: StoryMissionLadder = fetchStoryMissions(baseUrl, region)
      .then((items) => ({ items, loadFailed: false }))
      .catch(() => ({ items: [], loadFailed: true }));
    return {
      region,
      query,
      catalogue: null,
      familyOverviews: [] as MissionFamilyOverview[],
      storyMissions
    };
  }

  // Character Missions list nothing until a character is picked; the page fetches the
  // picker's character list itself, once per region.
  const character = query.character;
  if (query.family === "characterMissionV2s" && character === null) {
    return {
      region,
      query,
      catalogue: null,
      familyOverviews: [] as MissionFamilyOverview[],
      storyMissions: null
    };
  }

  // Normal missions and one character's missions are short, so they load whole instead of paging.
  const firstPage = (
    query.family === "characterMissionV2s" && character !== null
      ? fetchCharacterMissions(baseUrl, region, character)
      : fetchNormalMissions(baseUrl, region)
  ).then((items) => ({ ...createEmptyMissionListPage(1), items }));
  const catalogue = firstPage
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyMissionListPage(1), loadFailed: true as const }));

  return {
    region,
    query,
    catalogue,
    familyOverviews: [] as MissionFamilyOverview[],
    storyMissions: null
  };
};
