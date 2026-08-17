import { parseTrackerTimestamp, type TrackerDateValue } from "$lib/tracker-phase";

export type TrackerCountdownMode = "starts" | "ends";

export type TrackerCountdownValues = Readonly<{
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}>;

export type TrackerCountdown = Readonly<{
  mode: TrackerCountdownMode;
  values: TrackerCountdownValues;
}>;

export type TrackerCountdownInput = Readonly<{
  startAt: TrackerDateValue;
  aggregateAt: TrackerDateValue;
  closedAt: TrackerDateValue;
  now: TrackerDateValue;
}>;

const SECOND_MS = 1_000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/** Uses aggregateAt as the deadline, with closedAt for legacy metadata only. */
export const getTrackerCountdown = ({
  startAt,
  aggregateAt,
  closedAt,
  now
}: TrackerCountdownInput): TrackerCountdown | null => {
  const startTimestamp = parseTrackerTimestamp(startAt);
  const endTimestamp = parseTrackerTimestamp(aggregateAt) ?? parseTrackerTimestamp(closedAt);
  const nowTimestamp = parseTrackerTimestamp(now);

  if (
    startTimestamp === null ||
    endTimestamp === null ||
    nowTimestamp === null ||
    endTimestamp < startTimestamp ||
    nowTimestamp >= endTimestamp
  ) {
    return null;
  }

  const mode: TrackerCountdownMode = nowTimestamp < startTimestamp ? "starts" : "ends";
  const targetTimestamp = mode === "starts" ? startTimestamp : endTimestamp;
  const totalSeconds = Math.floor((targetTimestamp - nowTimestamp) / SECOND_MS);
  return {
    mode,
    values: {
      days: Math.floor(totalSeconds / DAY_SECONDS),
      hours: Math.floor((totalSeconds % DAY_SECONDS) / HOUR_SECONDS),
      minutes: Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS),
      seconds: totalSeconds % MINUTE_SECONDS
    }
  };
};
