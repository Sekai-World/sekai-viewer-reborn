export type TrackerDateValue = Date | string | number | null | undefined;
export type TrackerPhase = "upcoming" | "live" | "finished" | "unavailable";

export type TrackerPhaseInput = Readonly<{
  startAt: TrackerDateValue;
  aggregateAt: TrackerDateValue;
  now: TrackerDateValue;
}>;

export type TrackerRefreshInput = Readonly<{
  aggregateAt: TrackerDateValue;
  now: TrackerDateValue;
  intervalMs?: number;
  offsetMs?: number;
}>;

export const TRACKER_REFRESH_INTERVAL_MS = 3 * 60_000;
export const TRACKER_REFRESH_OFFSET_MS = 10_000;

export const parseTrackerTimestamp = (value: TrackerDateValue): number | null => {
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const getTrackerPhase = ({ startAt, aggregateAt, now }: TrackerPhaseInput): TrackerPhase => {
  const startTimestamp = parseTrackerTimestamp(startAt);
  const aggregateTimestamp = parseTrackerTimestamp(aggregateAt);
  const nowTimestamp = parseTrackerTimestamp(now);

  if (
    startTimestamp === null ||
    aggregateTimestamp === null ||
    nowTimestamp === null ||
    aggregateTimestamp < startTimestamp
  ) {
    return "unavailable";
  }

  if (nowTimestamp < startTimestamp) return "upcoming";
  if (nowTimestamp < aggregateTimestamp) return "live";
  return "finished";
};

/**
 * Returns the next aligned automatic-refresh time, or null when it would run at
 * or after aggregation. The defaults preserve the legacy three-minute cadence
 * with a ten-second offset.
 */
export const getNextTrackerRefreshDeadline = ({
  aggregateAt,
  now,
  intervalMs = TRACKER_REFRESH_INTERVAL_MS,
  offsetMs = TRACKER_REFRESH_OFFSET_MS
}: TrackerRefreshInput): number | null => {
  const aggregateTimestamp = parseTrackerTimestamp(aggregateAt);
  const nowTimestamp = parseTrackerTimestamp(now);
  if (
    aggregateTimestamp === null ||
    nowTimestamp === null ||
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0 ||
    !Number.isFinite(offsetMs) ||
    nowTimestamp >= aggregateTimestamp
  ) {
    return null;
  }

  const deadline = Math.floor((nowTimestamp - offsetMs) / intervalMs + 1) * intervalMs + offsetMs;
  return deadline < aggregateTimestamp ? deadline : null;
};

export const getNextTrackerRefreshCountdownMs = (input: TrackerRefreshInput): number | null => {
  const nowTimestamp = parseTrackerTimestamp(input.now);
  const deadline = getNextTrackerRefreshDeadline(input);
  return nowTimestamp === null || deadline === null ? null : deadline - nowTimestamp;
};
