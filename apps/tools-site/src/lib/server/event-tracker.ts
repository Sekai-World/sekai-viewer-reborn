import { getEventRankingLive, getEventRankingsByEventId } from "@platform/sekai-api-sdk";
export const trackerRegions = ["jp", "tw", "en", "kr"] as const;
export type TrackerRegion = (typeof trackerRegions)[number];

export const isTrackerRegion = (value: string): value is TrackerRegion =>
  trackerRegions.includes(value as TrackerRegion);

export type EventTrackerRanking = {
  rank: number | null;
  score: number | null;
  userId: string | null;
  userName: string | null;
  eventId: number | null;
  timestamp: string | null;
};

export type EventTrackerSelection =
  | { mode: "live"; eventId: null }
  | { mode: "history"; eventId: number };

export type EventTrackerResult = {
  selection: EventTrackerSelection;
  loadedAt: string;
  status: "available" | "sdk-error" | "network-error" | "invalid-data";
  rankings: EventTrackerRanking[];
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asSafeInteger = (value: unknown, minimum: number): number | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= minimum ? value : null;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
  }

  return null;
};

const asRank = (value: unknown): number | null => asSafeInteger(value, 1);
const asScore = (value: unknown): number | null => asSafeInteger(value, 0);
const asEventId = (value: unknown): number | null => asSafeInteger(value, 1);

const asUserId = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value : null;
  const userId = asSafeInteger(value, 0);
  return userId === null ? null : String(userId);
};

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const parseRanking = (value: unknown): EventTrackerRanking | null => {
  const ranking = asObject(value);
  if (!ranking) return null;

  const integerFields = [
    ["rank", asRank],
    ["score", asScore],
    ["eventId", asEventId]
  ] as const;
  if (integerFields.some(([field, parser]) => ranking[field] !== undefined && parser(ranking[field]) === null)) {
    return null;
  }
  if (ranking.userId !== undefined && asUserId(ranking.userId) === null) return null;
  const stringFields = ["userName", "timestamp"] as const;
  if (stringFields.some((field) => ranking[field] !== undefined && asString(ranking[field]) === null)) {
    return null;
  }

  return {
    rank: asRank(ranking.rank),
    score: asScore(ranking.score),
    userId: asUserId(ranking.userId),
    userName: asString(ranking.userName),
    eventId: asEventId(ranking.eventId),
    timestamp: asString(ranking.timestamp)
  };
};

export const parseEventTrackerRankings = (payload: unknown): EventTrackerRanking[] | null => {
  if (Array.isArray(payload)) {
    const parsed = payload.map(parseRanking);
    return parsed.every((ranking): ranking is EventTrackerRanking => ranking !== null) ? parsed : null;
  }

  const root = asObject(payload);
  const data = asObject(root?.data) ?? root;
  if (!data) {
    return null;
  }

  const sources = [data.eventRankings, data.first100, data.border].filter(
    (source): source is unknown[] => source !== undefined
  );
  if (sources.some((source) => !Array.isArray(source))) return null;

  const rankings = sources.flat();
  const parsed = rankings.map(parseRanking);
  if (!parsed.every((ranking): ranking is EventTrackerRanking => ranking !== null)) return null;

  const seen = new Set<string>();
  return parsed.filter((ranking) => {
    const key = `${ranking.rank ?? ""}:${ranking.userId ?? ranking.score ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const withResult = (
  selection: EventTrackerSelection,
  status: EventTrackerResult["status"],
  rankings: EventTrackerRanking[] = []
): EventTrackerResult => ({ selection, loadedAt: new Date().toISOString(), status, rankings });

export const getEventTrackerRankings = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId?: number
): Promise<EventTrackerResult> => {
  const selection: EventTrackerSelection =
    eventId === undefined ? { mode: "live", eventId: null } : { mode: "history", eventId };

  try {
    const response =
      eventId === undefined
        ? await getEventRankingLive({ baseUrl, query: { region } })
        : await getEventRankingsByEventId({
            baseUrl,
            path: { id: eventId },
            query: { limit: 1000, full: true, region }
          });

    if (response.error) return withResult(selection, "sdk-error");

    const rankings = parseEventTrackerRankings(response.data);
    return rankings ? withResult(selection, "available", rankings) : withResult(selection, "invalid-data");
  } catch {
    return withResult(selection, "network-error");
  }
};
