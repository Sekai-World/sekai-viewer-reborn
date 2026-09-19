export type TrackerRatePoint = Readonly<{
  score: number;
  timestamp: string | number | null;
}>;

const HOUR_MS = 3_600_000;

const timestampToMs = (timestamp: TrackerRatePoint["timestamp"]): number => {
  if (typeof timestamp === "number") return new Date(timestamp).getTime();
  if (typeof timestamp === "string") return new Date(timestamp).getTime();
  return Number.NaN;
};

export const sortTrackerRatePoints = <T extends TrackerRatePoint>(points: readonly T[]): T[] =>
  points
    .filter((point) => Number.isFinite(point.score) && point.timestamp !== null)
    .filter((point) => !Number.isNaN(timestampToMs(point.timestamp)))
    .toSorted((a, b) => timestampToMs(a.timestamp) - timestampToMs(b.timestamp));

/**
 * Finds a no-look-ahead baseline near the requested horizon and divides by the
 * actual elapsed duration. If the horizon is not available, the oldest prior
 * point in the supplied recent window is used so the full available window is
 * used.
 */
export const calculateRecentRate = (
  points: readonly TrackerRatePoint[],
  target: TrackerRatePoint | null,
  horizonHours: number
): number | null => {
  if (!target || !Number.isFinite(target.score) || target.timestamp === null) return null;
  const targetAt = timestampToMs(target.timestamp);
  if (Number.isNaN(targetAt) || !Number.isFinite(horizonHours) || horizonHours <= 0) return null;

  const priorPoints = sortTrackerRatePoints(points).filter(
    (point) => timestampToMs(point.timestamp) < targetAt
  );
  const baseline =
    priorPoints.findLast(
      (point) => timestampToMs(point.timestamp) <= targetAt - horizonHours * HOUR_MS
    ) ?? priorPoints[0];
  if (!baseline) return null;
  const elapsedHours = (targetAt - timestampToMs(baseline.timestamp)) / HOUR_MS;
  if (elapsedHours <= 0) return null;

  const rate = (target.score - baseline.score) / elapsedHours;
  return Number.isFinite(rate) ? rate : null;
};

export const calculateRecentRates = (
  points: readonly TrackerRatePoint[],
  target: TrackerRatePoint | null
): { oneHour: number | null; threeHours: number | null } => ({
  oneHour: calculateRecentRate(points, target, 1),
  threeHours: calculateRecentRate(points, target, 3)
});
