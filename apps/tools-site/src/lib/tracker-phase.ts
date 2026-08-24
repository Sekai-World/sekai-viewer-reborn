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
const TRACKER_TERMINAL_REFRESH_OFFSETS_MS = [10 * 60_000 + 10_000, 15 * 60_000 + 10_000] as const;
const HOUR_MS = 60 * 60_000;

export const parseTrackerTimestamp = (value: TrackerDateValue): number | null => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.abs(numeric) < 100_000_000_000 ? numeric * 1_000 : numeric;
  }
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
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
 * Returns the next automatic-refresh time. Live refreshes follow the three-minute
 * cadence with a ten-second offset. After aggregation, exactly two terminal
 * refreshes run at 10:10 and 15:10 after the following UTC hour begins.
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
    !Number.isFinite(offsetMs)
  ) {
    return null;
  }

  if (nowTimestamp < aggregateTimestamp) {
    const deadline = Math.floor((nowTimestamp - offsetMs) / intervalMs + 1) * intervalMs + offsetMs;
    if (deadline < aggregateTimestamp) return deadline;
  }

  const followingHour = (Math.floor(aggregateTimestamp / HOUR_MS) + 1) * HOUR_MS;
  return (
    TRACKER_TERMINAL_REFRESH_OFFSETS_MS.map((offset) => followingHour + offset).find(
      (deadline) => deadline > nowTimestamp
    ) ?? null
  );
};

export const getNextTrackerRefreshCountdownMs = (input: TrackerRefreshInput): number | null => {
  const nowTimestamp = parseTrackerTimestamp(input.now);
  const deadline = getNextTrackerRefreshDeadline(input);
  return nowTimestamp === null || deadline === null ? null : deadline - nowTimestamp;
};
