import { getEventsByRegionCurrent, getEventsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/region";
import { parseEventDetail } from "$lib/server/event-detail";
import {
  createEventListRequestQuery,
  DEFAULT_EVENT_LIST_PAGE_SIZE,
  logEventListFilterDebug,
  parseEventListPage,
  parseEventListQueryState
} from "$lib/server/event-list";
import { getMasterApiBaseUrl } from "$lib/server/config";
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
  const queryState = parseEventListQueryState(url.searchParams);
  const requestQuery = createEventListRequestQuery(queryState, 1, DEFAULT_EVENT_LIST_PAGE_SIZE);

  logEventListFilterDebug("initial request", {
    region,
    queryState,
    requestQuery
  });

  try {
    const [response, currentEventResponse] = await Promise.all([
      getEventsByRegionList({
        baseUrl,
        path: { region },
        query: requestQuery
      }),
      getEventsByRegionCurrent({
        baseUrl,
        path: { region }
      }).catch(() => null)
    ]);

    if (response.error) {
      logEventListFilterDebug("initial error", {
        region,
        queryState,
        error: response.error
      });

      return {
        region,
        initialPage: createEmptyPage(),
        initialLoadFailed: true,
        initialQuery: queryState,
        currentEventId: null
      };
    }

    const initialPage = parseEventListPage(response.data, 1, DEFAULT_EVENT_LIST_PAGE_SIZE);

    logEventListFilterDebug("initial response", {
      region,
      queryState,
      itemCount: initialPage.items.length,
      pagination: initialPage.pagination
    });

    return {
      region,
      initialPage,
      initialLoadFailed: false,
      initialQuery: queryState,
      currentEventId:
        currentEventResponse && !currentEventResponse.error
          ? (parseEventDetail(currentEventResponse.data)?.id ?? null)
          : null
    };
  } catch (error) {
    logEventListFilterDebug("initial exception", {
      region,
      queryState,
      error
    });

    return {
      region,
      initialPage: createEmptyPage(),
      initialLoadFailed: true,
      initialQuery: queryState,
      currentEventId: null
    };
  }
};
