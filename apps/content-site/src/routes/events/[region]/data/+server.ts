import { json } from "@sveltejs/kit";
import { getEventsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/region";
import {
  createEventListRequestQuery,
  DEFAULT_EVENT_LIST_PAGE_SIZE,
  logEventListFilterDebug,
  parseEventListPage,
  parseEventListQueryState
} from "$lib/server/event-list";
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
  const queryState = parseEventListQueryState(url.searchParams);
  const requestQuery = createEventListRequestQuery(
    queryState,
    page,
    DEFAULT_EVENT_LIST_PAGE_SIZE,
    true
  );

  logEventListFilterDebug("data request", {
    region,
    page,
    queryState,
    requestQuery
  });

  try {
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
        error: response.error
      });

      return json({ error: true }, { status: 500 });
    }

    const eventListPage = parseEventListPage(response.data, page, DEFAULT_EVENT_LIST_PAGE_SIZE);

    logEventListFilterDebug("data response", {
      region,
      page,
      queryState,
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
