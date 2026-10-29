import { getSekaiApiBaseUrl } from "#lib/server/config.js";
import { isTrackerRegion } from "#lib/server/event-tracker.js";
import { getTrackerTimePoints } from "#lib/server/tracker-time-travel.js";
import type { RequestHandler } from "./$types";

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isTrackerRegion(params.region))
    return Response.json({ status: "invalid-request", timePoints: [] });
  const eventId = parsePositiveInteger(url.searchParams.get("eventId"));
  if (eventId === null) return Response.json({ status: "invalid-request", timePoints: [] });

  return Response.json(await getTrackerTimePoints(getSekaiApiBaseUrl(), params.region, eventId));
};
