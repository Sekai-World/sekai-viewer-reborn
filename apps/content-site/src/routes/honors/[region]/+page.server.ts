import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parsePositivePage } from "$lib/server/catalogue-data";
import { createEmptyHonorListPage, fetchHonorListPage } from "$lib/server/honor-list";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = { page: parsePositivePage(url.searchParams.get("page")) };
  const catalogue = fetchHonorListPage(getMasterApiBaseUrl(), region, query.page)
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyHonorListPage(query.page), loadFailed: true as const }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
