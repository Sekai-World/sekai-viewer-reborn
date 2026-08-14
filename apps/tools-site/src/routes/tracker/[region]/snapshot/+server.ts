import { json } from "@sveltejs/kit";
import { getSekaiApiBaseUrl } from "$lib/server/config";
import { isTrackerRegion } from "$lib/server/event-tracker";
import { getTrackerSnapshotAt } from "$lib/server/tracker-time-travel";
import type { RequestHandler } from "./$types";

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isTrackerRegion(params.region)) return json({ status: "invalid-request", rankings: [] });
  const eventId = parsePositiveInteger(url.searchParams.get("eventId"));
  const timestamp = url.searchParams.get("timestamp")?.trim();
  if (eventId === null || !timestamp) return json({ status: "invalid-request", rankings: [] });

  return json(await getTrackerSnapshotAt(getSekaiApiBaseUrl(), params.region, eventId, timestamp));
};
