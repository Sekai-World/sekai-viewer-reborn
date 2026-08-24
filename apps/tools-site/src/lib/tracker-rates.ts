export type TrackerRatePoint = Readonly<{
  score: number;
  timestamp: string | null;
}>;

const HOUR_MS = 3_600_000;

export const sortTrackerRatePoints = <T extends TrackerRatePoint>(points: readonly T[]): T[] =>
  points
    .filter((point) => Number.isFinite(point.score) && point.timestamp !== null)
    .filter((point) => !Number.isNaN(new Date(point.timestamp!).getTime()))
    .toSorted((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

/** Finds a no-look-ahead baseline and divides by the actual elapsed duration. */
export const calculateRecentRate = (
  points: readonly TrackerRatePoint[],
  target: TrackerRatePoint | null,
  horizonHours: number
): number | null => {
  if (!target || !Number.isFinite(target.score) || target.timestamp === null) return null;
  const targetAt = new Date(target.timestamp).getTime();
  if (Number.isNaN(targetAt) || !Number.isFinite(horizonHours) || horizonHours <= 0) return null;
  const baseline = sortTrackerRatePoints(points).findLast(
    (point) => new Date(point.timestamp!).getTime() <= targetAt - horizonHours * HOUR_MS
  );
  if (!baseline) return null;
  const elapsedHours = (targetAt - new Date(baseline.timestamp!).getTime()) / HOUR_MS;
  return elapsedHours > 0 ? (target.score - baseline.score) / elapsedHours : null;
};

export const calculateRecentRates = (
  points: readonly TrackerRatePoint[],
  target: TrackerRatePoint | null
): { oneHour: number | null; threeHours: number | null } => ({
  oneHour: calculateRecentRate(points, target, 1),
  threeHours: calculateRecentRate(points, target, 3)
});
