import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createEmptyMissionListPage,
  fetchMissionListPage,
  fetchStoryMissions,
  parseMissionFamily
} from "$lib/server/mission-list";
import { missionFamilies, type Mission, type MissionFamily } from "$lib/domain/mission";
import type { PageServerLoad } from "./$types";

type MissionCatalogueQuery = {
  family: MissionFamily | null;
};

type MissionFamilyOverview = {
  family: MissionFamily;
  summary: Promise<{ items: Mission[]; total: number | null; loadFailed: boolean }>;
};

type StoryMissionLadder = Promise<{ items: Mission[]; loadFailed: boolean }>;

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query: MissionCatalogueQuery = {
    family: parseMissionFamily(url.searchParams)
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

    return { region, query, catalogue: null, familyOverviews, storyMissions: null };
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

  const catalogue = fetchMissionListPage(baseUrl, region, [query.family], 1)
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
