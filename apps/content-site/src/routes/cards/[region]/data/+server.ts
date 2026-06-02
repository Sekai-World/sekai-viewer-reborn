import { json } from "@sveltejs/kit";
import { getCardsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/region";
import {
  createCardListRequestQuery,
  DEFAULT_CARD_LIST_PAGE_SIZE,
  hasCardListFilters,
  logCardListFilterDebug,
  parseCardListPage,
  parseCardListQueryState
} from "$lib/server/card-list";
import { getMasterApiBaseUrl } from "$lib/server/config";
import type { RequestHandler } from "./$types";

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
  const queryState = parseCardListQueryState(url.searchParams);
  const hasFilters = hasCardListFilters(queryState);

  logCardListFilterDebug("data request", {
    region,
    page,
    queryState,
    hasFilters
  });

  try {
    const response = await getCardsByRegionList({
      baseUrl,
      path: { region },
      query: createCardListRequestQuery(queryState, page, DEFAULT_CARD_LIST_PAGE_SIZE)
    });

    if (response.error) {
      logCardListFilterDebug("data error", {
        region,
        page,
        queryState,
        error: response.error
      });

      return json({ error: true }, { status: 500 });
    }

    return json(parseCardListPage(response.data, page, DEFAULT_CARD_LIST_PAGE_SIZE));
  } catch (error) {
    logCardListFilterDebug("data exception", {
      region,
      page,
      queryState,
      error
    });

    return json({ error: true }, { status: 500 });
  }
};
