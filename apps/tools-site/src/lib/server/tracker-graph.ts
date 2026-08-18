import { parseEventTrackerRankings, type EventTrackerRanking, type TrackerRegion } from "./event-tracker";
import type { TrackerTimeTravelStatus } from "./tracker-time-travel";
import { isRestoreResponse, unwrapSekaiApiEnvelope, withRequestTimeout } from "./network";

export const getTrackerGraph = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId: number,
  rank: number,
  timestamp?: string
): Promise<{ status: TrackerTimeTravelStatus; points: EventTrackerRanking[] }> => {
  const query = new URLSearchParams({ region, rank: String(rank) });
  if (timestamp) query.set("timestamp", timestamp);
  const url = `${baseUrl}/event/${eventId}/rankings/graph?${query}`;

  let response: Response;
  try {
    response = await withRequestTimeout((signal) => fetch(url, { signal }));
  } catch {
    return { status: "network-error", points: [] };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { status: "sdk-error", points: [] };
  }

  if (!response.ok) return { status: "sdk-error", points: [] };
  if (isRestoreResponse({ data, response })) return { status: "unavailable", points: [] };
  const points = parseEventTrackerRankings(unwrapSekaiApiEnvelope(data));
  return points ? { status: "available", points } : { status: "invalid-data", points: [] };
};
