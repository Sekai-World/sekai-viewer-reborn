import { getCardsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/region";
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
  const filterMeta = getDefaultCardListFilterMeta();

  logCardListFilterDebug("initial request", {
    region,
    queryState,
    hasFilters
  });

  try {
    const startedAt = performance.now();
    const response = await getCardsByRegionList({
      baseUrl,
      path: { region },
      query: createCardListRequestQuery(queryState, 1, DEFAULT_CARD_LIST_PAGE_SIZE)
    });

    if (response.error) {
      logCardListFilterDebug("initial error", {
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
        filterMeta
      };
    }

    const parsedPage = parseCardListPage(response.data, 1, DEFAULT_CARD_LIST_PAGE_SIZE);

    logCardListFilterDebug("initial response", {
      region,
      queryState,
      hasFilters,
      ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
      rawItemCount: response.data?.items?.length ?? null,
      parsedItemCount: parsedPage.items.length,
      pagination: parsedPage.pagination
    });

    return {
      region,
      initialPage: parsedPage,
      initialLoadFailed: false,
      initialQuery: queryState,
      filterMeta
    };
  } catch (error) {
    logCardListFilterDebug("initial exception", {
      region,
      queryState,
      error
    });

    return {
      region,
      initialPage: createEmptyPage(),
      initialLoadFailed: true,
      initialQuery: queryState,
      filterMeta
    };
  }
};
