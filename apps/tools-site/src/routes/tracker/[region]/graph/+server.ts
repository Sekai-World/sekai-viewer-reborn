import { json } from "@sveltejs/kit";
import { getSekaiApiBaseUrl } from "$lib/server/config";
import { isTrackerRegion } from "$lib/server/event-tracker";
import { getTrackerChapterGraph, getTrackerGraph } from "$lib/server/tracker-graph";
import { parseTrackerTimestamp } from "$lib/tracker-phase";
import type { RequestHandler } from "./$types";

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseTimestamp = (value: string | null): string | null => {
  const timestamp = value?.trim();
  return timestamp && parseTrackerTimestamp(timestamp) !== null ? timestamp : null;
};

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isTrackerRegion(params.region)) return json({ status: "invalid-request", points: [] });
  const eventId = parsePositiveInteger(url.searchParams.get("eventId"));
  const rank = parsePositiveInteger(url.searchParams.get("rank"));
  const charaIdValue = url.searchParams.get("charaId");
  const charaId = parsePositiveInteger(charaIdValue);
  const timestampValue = url.searchParams.get("timestamp");
  const timestamp = timestampValue === null ? undefined : parseTimestamp(timestampValue);
  if (
    eventId === null ||
    rank === null ||
    (charaIdValue !== null && charaId === null) ||
    (timestampValue !== null && timestamp === null)
  ) {
    return json({ status: "invalid-request", points: [] });
  }

  return json(
    charaId === null
      ? await getTrackerGraph(getSekaiApiBaseUrl(), params.region, eventId, rank, timestamp ?? undefined)
      : await getTrackerChapterGraph(getSekaiApiBaseUrl(), params.region, eventId, charaId, rank)
  );
};
