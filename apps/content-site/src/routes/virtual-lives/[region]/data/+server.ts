import { json } from "@sveltejs/kit";
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
import type { RequestHandler } from "./$types";

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

const parsePageNumber = (value: string | null): number => {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePageNumber(url.searchParams.get("page"));
  const baseUrl = getMasterApiBaseUrl();
  const queryState = parseVirtualLiveListQueryState(url.searchParams);
  const includeSpoilerContent = url.searchParams.get("spoiler") === "true";
  const requestQuery = createVirtualLiveListRequestQuery(
    queryState,
    page,
    DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE,
    includeSpoilerContent
  );

  logVirtualLiveListFilterDebug("data request", {
    region,
    page,
    queryState,
    requestQuery
  });

  try {
    const startedAt = performance.now();
    const response = await getVirtualLivesByRegionList({
      baseUrl,
      path: { region },
      query: requestQuery
    });

    if (response.error) {
      logVirtualLiveListFilterDebug("data error", {
        region,
        page,
        queryState,
        ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
        error: response.error
      });

      return json({ error: true }, { status: 500 });
    }

    const virtualLiveListPage = parseVirtualLiveListPage(
      response.data,
      page,
      DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE
    );

    logVirtualLiveListFilterDebug("data response", {
      region,
      page,
      queryState,
      ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
      rawItemCount: response.data?.items?.length ?? null,
      itemCount: virtualLiveListPage.items.length,
      pagination: virtualLiveListPage.pagination
    });

    return json(virtualLiveListPage);
  } catch (error) {
    logVirtualLiveListFilterDebug("data exception", {
      region,
      page,
      queryState,
      error
    });

    return json({ error: true }, { status: 500 });
  }
};
