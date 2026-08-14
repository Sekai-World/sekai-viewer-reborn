import { error } from "@sveltejs/kit";
import { getSekaiApiBaseUrl } from "$lib/server/config";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { getEventCatalog } from "$lib/server/event-catalog";
import { getEventRewards } from "$lib/server/event-rewards";
import { getEventTrackerRankings, isTrackerRegion } from "$lib/server/event-tracker";
import type { PageServerLoad } from "./$types";

const parseEventId = (value: string | null): number | null | "invalid" => {
  if (value === null) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : "invalid";
};

export const load: PageServerLoad = async ({ params, url, depends }) => {
  if (!isTrackerRegion(params.region)) {
    error(404, "Region not found");
  }

  const region = params.region;
  depends?.("tools-site:tracker:rankings");
  const eventId = parseEventId(url.searchParams.get("eventId"));
  if (eventId === "invalid") {
    return {
      region,
      selection: { mode: "history" as const, eventId: null },
      selectionStatus: "invalid-event-id" as const,
      status: "invalid-data" as const,
      loadedAt: new Date().toISOString(),
      rankings: []
    };
  }

  const result = await getEventTrackerRankings(getSekaiApiBaseUrl(), region, eventId ?? undefined);
  depends?.("tools-site:tracker:catalog");
  const catalog = getEventCatalog(getMasterApiBaseUrl(), region);
  const rewards = eventId === null ? Promise.resolve(null) : getEventRewards(getMasterApiBaseUrl(), region, eventId);
  return { region, selectionStatus: "valid" as const, ...result, catalog, rewards };
};
