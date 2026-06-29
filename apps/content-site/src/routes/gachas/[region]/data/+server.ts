import { json } from "@sveltejs/kit";
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
  const queryState = parseGachaListQueryState(url.searchParams);
  const requestQuery = createGachaListRequestQuery(
    queryState,
    page,
    DEFAULT_GACHA_LIST_PAGE_SIZE
  );

  logGachaListFilterDebug("data request", {
    region,
    page,
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
      logGachaListFilterDebug("data error", {
        region,
        page,
        queryState,
        ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
        error: response.error
      });

      return json({ error: true }, { status: 500 });
    }

    const gachaListPage = parseGachaListPage(response.data, page, DEFAULT_GACHA_LIST_PAGE_SIZE);

    logGachaListFilterDebug("data response", {
      region,
      page,
      queryState,
      ...summarizeResponse(response, Math.round(performance.now() - startedAt)),
      rawItemCount: response.data?.items?.length ?? null,
      itemCount: gachaListPage.items.length,
      pagination: gachaListPage.pagination
    });

    return json(gachaListPage);
  } catch (error) {
    logGachaListFilterDebug("data exception", {
      region,
      page,
      queryState,
      error
    });

    return json({ error: true }, { status: 500 });
  }
};
