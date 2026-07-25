import { getGachasByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createGachaListRequestQuery,
  DEFAULT_GACHA_LIST_PAGE_SIZE,
  logGachaListFilterDebug,
  parseGachaListPage,
  parseGachaListQueryState
} from "$lib/server/gacha-list";
import type { PageServerLoad } from "./$types";

const createEmptyPage = () => ({
  items: [],
  pagination: {
    page: 1,
    pageSize: DEFAULT_GACHA_LIST_PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const load: PageServerLoad = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const queryState = parseGachaListQueryState(url.searchParams);
  const requestQuery = createGachaListRequestQuery(queryState, 1, DEFAULT_GACHA_LIST_PAGE_SIZE);

  logGachaListFilterDebug("initial request", {
    region,
    queryState,
    requestQuery
  });

  const initialPage: Promise<
    | { page: ReturnType<typeof parseGachaListPage>; loadFailed: false }
    | { page: ReturnType<typeof createEmptyPage>; loadFailed: true }
  > = getGachasByRegionList({
    baseUrl,
    path: { region },
    query: requestQuery
  })
    .then((response) => {
      if (response.error) {
        logGachaListFilterDebug("initial error", {
          region,
          queryState,
          error: response.error
        });

        return { page: createEmptyPage(), loadFailed: true as const };
      }

      const page = parseGachaListPage(response.data, 1, DEFAULT_GACHA_LIST_PAGE_SIZE);

      logGachaListFilterDebug("initial response", {
        region,
        queryState,
        rawItemCount: response.data?.items?.length ?? null,
        itemCount: page.items.length,
        pagination: page.pagination
      });

      return { page, loadFailed: false as const };
    })
    .catch((error) => {
      logGachaListFilterDebug("initial exception", {
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
    initialQuery: queryState
  };
};
