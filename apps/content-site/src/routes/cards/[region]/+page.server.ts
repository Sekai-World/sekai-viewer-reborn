import { getCardsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import {
  createCardListRequestQuery,
  DEFAULT_CARD_LIST_PAGE_SIZE,
  getDefaultCardListFilterMeta,
  hasCardListFilters,
  logCardListFilterDebug,
  parseCardListPage,
  parseCardListQueryState,
  type CardListPage
} from "$lib/server/card-list";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

const createEmptyPage = (): CardListPage => ({
  items: [],
  pagination: {
    page: 1,
    pageSize: DEFAULT_CARD_LIST_PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const load: PageServerLoad = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const queryState = parseCardListQueryState(url.searchParams);
  const hasFilters = hasCardListFilters(queryState);
  const unitProfiles = toUnitProfileMap(await fetchUnitProfiles(baseUrl, region));
  const filterMeta = getDefaultCardListFilterMeta(unitProfiles);

  logCardListFilterDebug("initial request", {
    region,
    queryState,
    hasFilters
  });

  const requestQuery = createCardListRequestQuery(queryState, 1, DEFAULT_CARD_LIST_PAGE_SIZE);

  const initialPage: Promise<
    | { page: ReturnType<typeof parseCardListPage>; loadFailed: false }
    | { page: CardListPage; loadFailed: true }
  > = getCardsByRegionList({
    baseUrl,
    path: { region },
    query: requestQuery
  })
    .then((response) => {
      if (response.error) {
        logCardListFilterDebug("initial error", {
          region,
          queryState,
          error: response.error
        });

        return { page: createEmptyPage(), loadFailed: true as const };
      }

      const page = parseCardListPage(response.data, 1, DEFAULT_CARD_LIST_PAGE_SIZE);

      logCardListFilterDebug("initial response", {
        region,
        queryState,
        hasFilters,
        rawItemCount: response.data?.items?.length ?? null,
        parsedItemCount: page.items.length,
        pagination: page.pagination
      });

      return { page, loadFailed: false as const };
    })
    .catch((error) => {
      logCardListFilterDebug("initial exception", {
        region,
        queryState,
        error
      });

      return { page: createEmptyPage(), loadFailed: true as const };
    });

  // Attach noop catch to prevent unhandled rejection before SvelteKit renders
  initialPage.catch(() => {});

  return {
    region,
    initialPage,
    initialQuery: queryState,
    filterMeta
  };
};
