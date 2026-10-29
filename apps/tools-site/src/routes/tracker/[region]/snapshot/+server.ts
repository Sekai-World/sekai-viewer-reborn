import { getSekaiApiBaseUrl } from "#lib/server/config.js";
import { isTrackerRegion } from "#lib/server/event-tracker.js";
import { getTrackerSnapshotAt } from "#lib/server/tracker-time-travel.js";
import { parseTrackerTimestamp } from "#lib/tracker-phase.js";
import type { RequestHandler } from "./$types";

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isTrackerRegion(params.region))
    return Response.json({ status: "invalid-request", rankings: [] });
  const eventId = parsePositiveInteger(url.searchParams.get("eventId"));
  const timestamp = url.searchParams.get("timestamp")?.trim();
  if (eventId === null || !timestamp || parseTrackerTimestamp(timestamp) === null) {
    return Response.json({ status: "invalid-request", rankings: [] });
  }

  return Response.json(
    await getTrackerSnapshotAt(getSekaiApiBaseUrl(), params.region, eventId, timestamp)
  );
};
