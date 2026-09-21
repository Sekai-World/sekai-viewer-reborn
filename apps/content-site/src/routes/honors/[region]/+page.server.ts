import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { createEmptyHonorListPage, fetchHonorListPage } from "$lib/server/honor-list";
import type { PageServerLoad } from "./$types";

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
  const query = { page: parsePage(url.searchParams) };
  const catalogue = fetchHonorListPage(getMasterApiBaseUrl(), region, query.page)
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({ ...createEmptyHonorListPage(query.page), loadFailed: true as const }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
