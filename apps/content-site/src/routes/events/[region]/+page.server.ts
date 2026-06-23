import { getEventsByRegionCurrent, getEventsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import { parseEventDetail } from "$lib/server/event-detail";
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

const summarizeResponse = (
  result: { response?: Response },
  durationMs: number
): Record<string, unknown> => ({
  contentLength: result.response?.headers.get("content-length") ?? null,
  contentType: result.response?.headers.get("content-type") ?? null,
  durationMs,
  ok: result.response?.ok ?? null,
  requestId: result.response?.headers.get("x-request-id") ?? null,
  status: result.response?.status ?? null,
  url: result.response?.url ?? null
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
        currentEventId: null,
        unitProfiles
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
      unitProfiles,
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
      currentEventId: null,
      unitProfiles
    };
  }
};
