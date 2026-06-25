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
  const requestQuery = createGachaListRequestQuery(
    queryState,
    1,
    DEFAULT_GACHA_LIST_PAGE_SIZE
  );

  logGachaListFilterDebug("initial request", {
    region,
    queryState,
    requestQuery
  });

  try {
    const startedAt = performance.now();
    const response = await getGachasByRegionList({
      baseUrl,
      path: { region },
      query: requestQuery
    });

    if (response.error) {
      logGachaListFilterDebug("initial error", {
        region,
        queryState,
        ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
        error: response.error
      });

      return {
        region,
        initialPage: createEmptyPage(),
        initialLoadFailed: true,
        initialQuery: queryState
      };
    }

    const initialPage = parseGachaListPage(response.data, 1, DEFAULT_GACHA_LIST_PAGE_SIZE);

    logGachaListFilterDebug("initial response", {
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
      initialQuery: queryState
    };
  } catch (error) {
    logGachaListFilterDebug("initial exception", {
      region,
      queryState,
      error
    });

    return {
      region,
      initialPage: createEmptyPage(),
      initialLoadFailed: true,
      initialQuery: queryState
    };
  }
};
