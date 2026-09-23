import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createEmptyMissionListPage,
  fetchMissionListPage,
  parseMissionFamily
} from "$lib/server/mission-list";
import type { MissionFamily } from "$lib/domain/mission";
import type { PageServerLoad } from "./$types";

type MissionCatalogueQuery = {
  family: MissionFamily | null;
};

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query: MissionCatalogueQuery = {
    family: parseMissionFamily(url.searchParams)
  };
  const families = query.family ? [query.family] : undefined;
  const catalogue = fetchMissionListPage(getMasterApiBaseUrl(), region, families, 1)
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyMissionListPage(1), loadFailed: true as const }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
