import { getVirtualLivesByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import {
  createVirtualLiveListRequestQuery,
  DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE,
  logVirtualLiveListFilterDebug,
  parseVirtualLiveListPage,
  parseVirtualLiveListQueryState
} from "$lib/server/virtual-live-list";
import { getMasterApiBaseUrl } from "$lib/server/config";
import type { PageServerLoad } from "./$types";

const createEmptyPage = () => ({
  items: [],
  pagination: {
    page: 1,
    pageSize: DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const load: PageServerLoad = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const queryState = parseVirtualLiveListQueryState(url.searchParams);
  const includeSpoilerContent = url.searchParams.get("spoiler") === "true";
  const requestQuery = createVirtualLiveListRequestQuery(
    queryState,
    1,
    DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE,
    includeSpoilerContent
  );

  logVirtualLiveListFilterDebug("initial request", {
    region,
    queryState,
    requestQuery
  });

  const initialPage: Promise<
    | { page: ReturnType<typeof parseVirtualLiveListPage>; loadFailed: false }
    | { page: ReturnType<typeof createEmptyPage>; loadFailed: true }
  > = getVirtualLivesByRegionList({
    baseUrl,
    path: { region },
    query: requestQuery
  })
    .then((response) => {
      if (response.error) {
        logVirtualLiveListFilterDebug("initial error", {
          region,
          queryState,
          error: response.error
        });

        return { page: createEmptyPage(), loadFailed: true as const };
      }

      const page = parseVirtualLiveListPage(response.data, 1, DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE);

      logVirtualLiveListFilterDebug("initial response", {
        region,
        queryState,
        rawItemCount: response.data?.items?.length ?? null,
        itemCount: page.items.length,
        pagination: page.pagination
      });

      return { page, loadFailed: false as const };
    })
    .catch((error) => {
      logVirtualLiveListFilterDebug("initial exception", {
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
