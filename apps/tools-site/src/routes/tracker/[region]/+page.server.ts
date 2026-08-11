import { error } from "@sveltejs/kit";
import { getSekaiApiBaseUrl } from "$lib/server/config";
import { getEventTrackerRankings, isTrackerRegion } from "$lib/server/event-tracker";
import type { PageServerLoad } from "./$types";

const parseEventId = (value: string | null): number | null | "invalid" => {
  if (value === null) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : "invalid";
};

export const load: PageServerLoad = async ({ params, url }) => {
  if (!isTrackerRegion(params.region)) {
    error(404, "Region not found");
  }

  const region = params.region;
  const eventId = parseEventId(url.searchParams.get("eventId"));
  if (eventId === "invalid") {
    return {
      region,
      selection: { mode: "history" as const, eventId: null },
      selectionStatus: "invalid-event-id" as const,
      rankings: []
    };
  }

  const result = await getEventTrackerRankings(getSekaiApiBaseUrl(), region, eventId ?? undefined);
  return { region, selectionStatus: "valid" as const, ...result };
};
