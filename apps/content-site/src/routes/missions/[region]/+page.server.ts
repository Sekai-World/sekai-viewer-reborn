import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createEmptyMissionListPage,
  fetchMissionListPage,
  parseMissionFamily
} from "$lib/server/mission-list";
import { missionFamilies, type MissionFamily } from "$lib/domain/mission";
import type { PageServerLoad } from "./$types";

type MissionCatalogueQuery = {
  family: MissionFamily | null;
};

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query: MissionCatalogueQuery = {
    family: parseMissionFamily(url.searchParams)
  };
  const baseUrl = getMasterApiBaseUrl();
  const catalogue = (
    query.family
      ? fetchMissionListPage(baseUrl, region, [query.family], 1).then((page) => ({
          ...page,
          familySummaries: []
        }))
      : Promise.all(
          missionFamilies.map(async (family) => ({
            family,
            page: await fetchMissionListPage(baseUrl, region, [family], 1)
          }))
        ).then((familyPages) => {
          const totalValues = familyPages.map(({ page }) => page.pagination.total);
          const total = totalValues.every((value): value is number => value !== null)
            ? totalValues.reduce((sum, value) => sum + value, 0)
            : null;
          if (total !== null && !Number.isSafeInteger(total)) {
            throw new Error("Mission catalogue returned an unsupported total count.");
          }
          const reportedTotalPages = familyPages.flatMap(({ page }) =>
            page.pagination.totalPages === null ? [] : [page.pagination.totalPages]
          );

          return {
            items: familyPages.flatMap(({ page }) => page.items),
            pagination: {
              page: 1,
              pageSize: 24,
              hasNext: familyPages.some(({ page }) => page.pagination.hasNext),
              total,
              totalPages: reportedTotalPages.length > 0 ? Math.max(...reportedTotalPages) : null
            },
            familySummaries: familyPages.map(({ family, page }) => ({
              family,
              items: page.items,
              total: page.pagination.total
            }))
          };
        })
  )
    .then((page) => ({ ...page, loadFailed: false as const }))
    .catch(() => ({
      ...createEmptyMissionListPage(1),
      familySummaries: [],
      loadFailed: true as const
    }));

  catalogue.catch(() => {});

  return { region, query, catalogue };
};
