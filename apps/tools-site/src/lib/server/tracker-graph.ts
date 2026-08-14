import { getEventRankingGrpahByEventId } from "@platform/sekai-api-sdk";
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
  try {
    const response = await getEventRankingGrpahByEventId({
      baseUrl,
      path: { id: eventId },
      query: { rank, timestamp, region }
    });
    if (response.error) return { status: "sdk-error", points: [] };
    if (isRestoreResponse(response)) return { status: "unavailable", points: [] };
    const points = parseEventTrackerRankings(unwrapSekaiApiEnvelope(response.data));
    return points ? { status: "available", points } : { status: "invalid-data", points: [] };
  } catch {
    return { status: "network-error", points: [] };
  }
};
