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

const summarizeResponse = (
  response: { response: Response },
  durationMs: number
): Record<string, unknown> => ({
  contentLength: response.response.headers.get("content-length"),
  contentType: response.response.headers.get("content-type"),
  durationMs,
  ok: response.response.ok,
  requestId: response.response.headers.get("x-request-id"),
  status: response.response.status,
  url: response.response.url
});

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

  try {
    const startedAt = performance.now();
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
        ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
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
      ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
      rawItemCount: response.data?.items?.length ?? null,
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
