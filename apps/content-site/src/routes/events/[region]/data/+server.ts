import { json } from "@sveltejs/kit";
import { getEventsByRegionList } from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/region";
import {
  createEventListRequestQuery,
  DEFAULT_EVENT_LIST_PAGE_SIZE,
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

  try {
    const response = await getEventsByRegionList({
      baseUrl,
      path: { region },
      query: createEventListRequestQuery(queryState, page, DEFAULT_EVENT_LIST_PAGE_SIZE)
    });

    if (response.error) {
      return json({ error: true }, { status: 500 });
    }

    return json(parseEventListPage(response.data, page, DEFAULT_EVENT_LIST_PAGE_SIZE));
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
