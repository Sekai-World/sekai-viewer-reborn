import { getEventPickerResults, MAX_EVENT_SEARCH_RESULTS } from "#lib/server/event-catalog.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { isTrackerRegion } from "#lib/server/event-tracker.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const query = url.searchParams.get("query")?.trim() ?? "";
  if (!isTrackerRegion(params.region) || !query) {
    return Response.json({ status: "invalid-data" as const, events: [] });
  }

  const result = await getEventPickerResults(getMasterApiBaseUrl(), params.region, query);
  return Response.json({ ...result, events: result.events.slice(0, MAX_EVENT_SEARCH_RESULTS) });
};
