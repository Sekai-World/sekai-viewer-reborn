import { getEventRankingTimePoints, getEventRankingsByEventId } from "@platform/sekai-api-sdk";
import { parseEventTrackerRankings, type EventTrackerRanking, type TrackerRegion } from "./event-tracker";

export type TrackerTimeTravelStatus = "available" | "unavailable" | "sdk-error" | "network-error" | "invalid-data";

const isRestoreResponse = (response: { data?: unknown; response?: { status?: number } }): boolean => {
  if (response.response?.status === 202) return true;
  const root = response.data !== null && typeof response.data === "object" && !Array.isArray(response.data)
    ? response.data as { data?: unknown; restore?: unknown; status?: unknown }
    : null;
  const payload = root && typeof root.status === "string" ? root.data : response.data;
  return (root?.restore === true) ||
    (payload !== null && typeof payload === "object" && !Array.isArray(payload) && (payload as { restore?: unknown }).restore === true);
};

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

export const getTrackerTimePoints = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId: number
): Promise<{ status: TrackerTimeTravelStatus; timePoints: string[] }> => {
  try {
    const response = await getEventRankingTimePoints({ baseUrl, path: { id: eventId }, query: { region } });
    if (response.error) return { status: "sdk-error", timePoints: [] };
    if (isRestoreResponse(response)) return { status: "unavailable", timePoints: [] };
    const payload = unwrapSekaiApiEnvelope(response.data);
    if (!Array.isArray(payload) || payload.some((value) => typeof value !== "string" || !value.trim())) {
      return { status: "invalid-data", timePoints: [] };
    }

    return { status: "available", timePoints: [...new Set(payload)] };
  } catch {
    return { status: "network-error", timePoints: [] };
  }
};

export const getTrackerSnapshotAt = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId: number,
  timestamp: string
): Promise<{ status: TrackerTimeTravelStatus; rankings: EventTrackerRanking[] }> => {
  try {
    const response = await getEventRankingsByEventId({ baseUrl, path: { id: eventId }, query: { timestamp, region } });
    if (response.error) return { status: "sdk-error", rankings: [] };
    if (isRestoreResponse(response)) return { status: "unavailable", rankings: [] };
    const rankings = parseEventTrackerRankings(unwrapSekaiApiEnvelope(response.data));
    return rankings ? { status: "available", rankings } : { status: "invalid-data", rankings: [] };
  } catch {
    return { status: "network-error", rankings: [] };
  }
};
