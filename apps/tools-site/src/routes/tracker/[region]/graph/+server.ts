import { json } from "@sveltejs/kit";
import { getSekaiApiBaseUrl } from "$lib/server/config";
import { isTrackerRegion } from "$lib/server/event-tracker";
import { getTrackerChapterGraph, getTrackerGraph } from "$lib/server/tracker-graph";
import type { RequestHandler } from "./$types";

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isTrackerRegion(params.region)) return json({ status: "invalid-request", points: [] });
  const eventId = parsePositiveInteger(url.searchParams.get("eventId"));
  const rank = parsePositiveInteger(url.searchParams.get("rank"));
  const charaId = parsePositiveInteger(url.searchParams.get("charaId"));
  const timestamp = url.searchParams.get("timestamp")?.trim() || undefined;
  if (eventId === null || rank === null) return json({ status: "invalid-request", points: [] });

  return json(
    charaId === null
      ? await getTrackerGraph(getSekaiApiBaseUrl(), params.region, eventId, rank, timestamp)
      : await getTrackerChapterGraph(getSekaiApiBaseUrl(), params.region, eventId, charaId, rank)
  );
};
