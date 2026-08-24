import {
  getEventChapterRankingLive,
  getEventChapterRankingsByEventIdAndCharaId
} from "@platform/sekai-api-sdk";
import {
  parseEventTrackerRankings,
  type EventTrackerRanking,
  type TrackerRegion
} from "./event-tracker";
import { withRequestTimeout, unwrapSekaiApiEnvelope, isRestoreResponse } from "./network";

export type ChapterRanking = EventTrackerRanking;

export type ChapterTrackerResult = {
  status: "available" | "unavailable" | "sdk-error" | "network-error" | "invalid-data";
  rankings: ChapterRanking[];
};

const getRows = (payload: unknown): unknown[] | null => {
  const unwrapped = unwrapSekaiApiEnvelope(payload);
  if (Array.isArray(unwrapped)) return unwrapped;
  const source = unwrapped !== null && typeof unwrapped === "object" && !Array.isArray(unwrapped)
    ? (unwrapped as Record<string, unknown>)
    : null;
  return Array.isArray(source?.eventRankings) ? source.eventRankings : null;
};

const completeRows = (rankings: EventTrackerRanking[]): ChapterRanking[] => {
  const byRank = new Map<number, ChapterRanking>();
  for (const ranking of rankings) {
    if (ranking.rank === null || ranking.score === null || byRank.has(ranking.rank)) continue;
    byRank.set(ranking.rank, ranking);
  }
  return [...byRank.values()].sort((left, right) => left.rank! - right.rank!);
};

const resultFromPayload = (payload: unknown): ChapterTrackerResult => {
  const rows = getRows(payload);
  if (!rows) return { status: "invalid-data", rankings: [] };
  const rankings = parseEventTrackerRankings(rows);
  if (rankings === null) return { status: "invalid-data", rankings: [] };
  return { status: "available", rankings: completeRows(rankings) };
};

export const getChapterTrackerRankings = async (
  baseUrl: string,
  region: TrackerRegion,
  gameCharacterId: number,
  eventId?: number
): Promise<ChapterTrackerResult> => {
  try {
    if (eventId === undefined) {
      const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventChapterRankingLive>>>((signal) =>
        getEventChapterRankingLive({ baseUrl, query: { charaId: gameCharacterId, region }, signal })
      );
      if ("error" in response && response.error) return { status: "sdk-error", rankings: [] };
      // A 202 restore payload means chapter data is not available yet; keep it
      // distinct from a valid empty snapshot, consistent with other paths.
      if (isRestoreResponse(response)) return { status: "unavailable", rankings: [] };
      return resultFromPayload(response.data);
    }

    const latest = await withRequestTimeout<Awaited<ReturnType<typeof getEventChapterRankingsByEventIdAndCharaId>>>((signal) =>
      getEventChapterRankingsByEventIdAndCharaId({
        baseUrl,
        path: { id: eventId },
        query: { charaId: gameCharacterId, limit: 1, sort: { timestamp: "desc" }, region },
        querySerializer: (query) => {
          const values = query as Record<string, unknown>;
          const sort = values.sort as Record<string, unknown> | undefined;
          return new URLSearchParams({
            charaId: String(values.charaId), limit: String(values.limit),
            "sort[timestamp]": String(sort?.timestamp), region: String(values.region)
          }).toString();
        },
        signal
      } as Parameters<typeof getEventChapterRankingsByEventIdAndCharaId>[0])
    );
    if ("error" in latest && latest.error) return { status: "sdk-error", rankings: [] };
    const latestRows = getRows(latest.data);
    if (!latestRows) return { status: "invalid-data", rankings: [] };
    if (latestRows.length === 0) return { status: "unavailable", rankings: [] };
    const first = latestRows[0] as Record<string, unknown>;
    const snapshot = first.timestamp;
    if (typeof snapshot !== "string" || !snapshot) return { status: "invalid-data", rankings: [] };

    const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventChapterRankingsByEventIdAndCharaId>>>((signal) =>
      getEventChapterRankingsByEventIdAndCharaId({
        baseUrl, path: { id: eventId }, query: { charaId: gameCharacterId, timestamp: snapshot, region }, signal
      } as Parameters<typeof getEventChapterRankingsByEventIdAndCharaId>[0])
    );
    if ("error" in response && response.error) return { status: "sdk-error", rankings: [] };
    return resultFromPayload(response.data);
  } catch {
    return { status: "network-error", rankings: [] };
  }
};
