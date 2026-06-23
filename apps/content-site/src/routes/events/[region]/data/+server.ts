import { json } from "@sveltejs/kit";
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
  const queryState = parseEventListQueryState(url.searchParams);
  const includeSpoilerContent = url.searchParams.get("spoiler") === "true";
  const requestQuery = createEventListRequestQuery(
    queryState,
    page,
    DEFAULT_EVENT_LIST_PAGE_SIZE,
    includeSpoilerContent
  );

  logEventListFilterDebug("data request", {
    region,
    page,
    queryState,
    requestQuery
  });

  try {
    const startedAt = performance.now();
    const response = await getEventsByRegionList({
      baseUrl,
      path: { region },
      query: requestQuery
    });

    if (response.error) {
      logEventListFilterDebug("data error", {
        region,
        page,
        queryState,
        ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
        error: response.error
      });

      return json({ error: true }, { status: 500 });
    }

    const eventListPage = parseEventListPage(response.data, page, DEFAULT_EVENT_LIST_PAGE_SIZE);

    logEventListFilterDebug("data response", {
      region,
      page,
      queryState,
      ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
      rawItemCount: response.data?.items?.length ?? null,
      itemCount: eventListPage.items.length,
      pagination: eventListPage.pagination
    });

    return json(eventListPage);
  } catch (error) {
    logEventListFilterDebug("data exception", {
      region,
      page,
      queryState,
      error
    });

    return json({ error: true }, { status: 500 });
  }
};
