import { json } from "@sveltejs/kit";
import { getEventPickerResults, MAX_EVENT_SEARCH_RESULTS } from "$lib/server/event-catalog";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { isTrackerRegion } from "$lib/server/event-tracker";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const query = url.searchParams.get("query")?.trim() ?? "";
  if (!isTrackerRegion(params.region) || !query) {
    return json({ status: "invalid-data" as const, events: [] });
  }

  const result = await getEventPickerResults(getMasterApiBaseUrl(), params.region, query);
  return json({ ...result, events: result.events.slice(0, MAX_EVENT_SEARCH_RESULTS) });
};
