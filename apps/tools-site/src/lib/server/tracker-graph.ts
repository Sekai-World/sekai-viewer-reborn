import { parseEventTrackerRankings, type EventTrackerRanking, type TrackerRegion } from "./event-tracker";
import type { TrackerTimeTravelStatus } from "./tracker-time-travel";

const isRestoreResponse = (response: { data?: unknown; response?: { status?: number } }): boolean =>
  response.response?.status === 202 ||
  (response.data !== null && typeof response.data === "object" && !Array.isArray(response.data) &&
    ((response.data as { restore?: unknown }).restore === true ||
      ((response.data as { status?: unknown; data?: { restore?: unknown } }).status === "string" &&
        (response.data as { data?: { restore?: unknown } }).data?.restore === true)));

const unwrapSekaiApiEnvelope = (value: unknown): unknown => {
  let payload = value;
  while (
    payload !== null && typeof payload === "object" && !Array.isArray(payload) &&
    typeof (payload as { status?: unknown }).status === "string" && "data" in payload
  ) {
    payload = (payload as { data: unknown }).data;
  }
  return payload;
};

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
    response = await fetch(url);
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
