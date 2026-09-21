import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
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

const parsePage = (searchParams: URLSearchParams): number => {
  const value = searchParams.get("page");
  const normalized = value?.trim() ?? "";
  if (!/^\d+$/.test(normalized)) {
    return 1;
  }

  const page = Number(normalized);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query: MissionCatalogueQuery = {
    families: parseMissionFamilies(url.searchParams),
    page: parsePage(url.searchParams)
  };
  const catalogue = fetchMissionListPage(getMasterApiBaseUrl(), region, query.families, query.page)
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyMissionListPage(query.page), loadFailed: true as const }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
