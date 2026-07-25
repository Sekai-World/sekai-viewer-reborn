import { getEventsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import {
  createEventListRequestQuery,
  DEFAULT_EVENT_LIST_PAGE_SIZE,
  logEventListFilterDebug,
  parseEventListPage,
  parseEventListQueryState
} from "$lib/server/event-list";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

const createEmptyPage = () => ({
  items: [],
  pagination: {
    page: 1,
    pageSize: DEFAULT_EVENT_LIST_PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const load: PageServerLoad = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const unitProfiles = toUnitProfileMap(await fetchUnitProfiles(baseUrl, region));
  const queryState = parseEventListQueryState(url.searchParams);
  const includeSpoilerContent = url.searchParams.get("spoiler") === "true";
  const requestQuery = createEventListRequestQuery(
    queryState,
    1,
    DEFAULT_EVENT_LIST_PAGE_SIZE,
    includeSpoilerContent
  );

  logEventListFilterDebug("initial request", {
    region,
    queryState,
    requestQuery
  });

  const initialPage: Promise<
    | { page: ReturnType<typeof parseEventListPage>; loadFailed: false }
    | { page: ReturnType<typeof createEmptyPage>; loadFailed: true }
  > = getEventsByRegionList({
    baseUrl,
    path: { region },
    query: requestQuery
  })
    .then((response) => {
      if (response.error) {
        logEventListFilterDebug("initial error", {
          region,
          queryState,
          error: response.error
        });

        return { page: createEmptyPage(), loadFailed: true as const };
      }

      const page = parseEventListPage(response.data, 1, DEFAULT_EVENT_LIST_PAGE_SIZE);

      logEventListFilterDebug("initial response", {
        region,
        queryState,
        rawItemCount: response.data?.items?.length ?? null,
        itemCount: page.items.length,
        pagination: page.pagination
      });

      return { page, loadFailed: false as const };
    })
    .catch((error) => {
      logEventListFilterDebug("initial exception", {
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
    unitProfiles
  };
};
