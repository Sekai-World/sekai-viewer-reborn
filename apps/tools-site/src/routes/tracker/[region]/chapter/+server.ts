import { json } from "@sveltejs/kit";
import { getSekaiApiBaseUrl } from "$lib/server/config";
import { getChapterTrackerRankings } from "$lib/server/chapter-tracker";
import { isTrackerRegion } from "$lib/server/event-tracker";
import type { RequestHandler } from "./$types";

const positiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const GET: RequestHandler = async ({ params, url }) => {
  const charaId = positiveInteger(url.searchParams.get("charaId"));
  const eventId = positiveInteger(url.searchParams.get("eventId"));
  const mode = url.searchParams.get("mode");
  if (!isTrackerRegion(params.region) || charaId === null || (mode !== "live" && mode !== "history")) {
    return json({ status: "invalid-request", rankings: [] });
  }
  if ((mode === "history" && eventId === null) || (mode === "live" && eventId !== null)) {
    return json({ status: "invalid-request", rankings: [] });
  }
  if (mode === "live") {
    return json(await getChapterTrackerRankings(getSekaiApiBaseUrl(), params.region, charaId));
  }
  return json(await getChapterTrackerRankings(getSekaiApiBaseUrl(), params.region, charaId, eventId!));
};
