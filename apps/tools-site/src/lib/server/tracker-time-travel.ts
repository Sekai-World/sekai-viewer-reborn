import { getEventRankingTimePoints, getEventRankingsByEventId } from "@platform/sekai-api-sdk";
import { parseEventTrackerRankings, type EventTrackerRanking, type TrackerRegion } from "./event-tracker";
import { isRestoreResponse, unwrapSekaiApiEnvelope, withRequestTimeout } from "./network";

export type TrackerTimeTravelStatus = "available" | "unavailable" | "sdk-error" | "network-error" | "invalid-data";

export const getTrackerTimePoints = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId: number
): Promise<{ status: TrackerTimeTravelStatus; timePoints: string[] }> => {
  try {
    const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventRankingTimePoints>>>((signal) => getEventRankingTimePoints({ baseUrl, path: { id: eventId }, query: { region }, signal } as Parameters<typeof getEventRankingTimePoints>[0]));
    if ("error" in response && response.error) return { status: "sdk-error", timePoints: [] };
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
    const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventRankingsByEventId>>>((signal) => getEventRankingsByEventId({ baseUrl, path: { id: eventId }, query: { timestamp, region }, signal } as Parameters<typeof getEventRankingsByEventId>[0]));
    if ("error" in response && response.error) return { status: "sdk-error", rankings: [] };
    if (isRestoreResponse(response)) return { status: "unavailable", rankings: [] };
    const rankings = parseEventTrackerRankings(unwrapSekaiApiEnvelope(response.data));
    return rankings ? { status: "available", rankings } : { status: "invalid-data", rankings: [] };
  } catch {
    return { status: "network-error", rankings: [] };
  }
};
