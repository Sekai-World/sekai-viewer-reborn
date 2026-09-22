import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createEmptyHonorListPage,
  fetchHonorListPage,
  parseHonorListQueryState
} from "$lib/server/honor-list";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = parseHonorListQueryState(url.searchParams);
  const catalogue = fetchHonorListPage(getMasterApiBaseUrl(), region, 1, query)
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyHonorListPage(1), loadFailed: true as const }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
