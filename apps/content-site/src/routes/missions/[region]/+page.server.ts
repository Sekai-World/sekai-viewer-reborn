import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parsePositivePage } from "$lib/server/catalogue-data";
import {
  createEmptyMissionListPage,
  fetchMissionListPage,
  parseMissionFamilies
} from "$lib/server/mission-list";
import type { MissionFamily } from "$lib/domain/mission";
import type { PageServerLoad } from "./$types";

type MissionCatalogueQuery = {
  families: MissionFamily[];
  page: number;
};

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query: MissionCatalogueQuery = {
    families: parseMissionFamilies(url.searchParams),
    page: parsePositivePage(url.searchParams.get("page"))
  };
  const catalogue = fetchMissionListPage(getMasterApiBaseUrl(), region, query.families, query.page)
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyMissionListPage(query.page), loadFailed: true as const }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
