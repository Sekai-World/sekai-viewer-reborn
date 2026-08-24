import { parseTrackerTimestamp } from "$lib/tracker-phase";

export type ScorePerElapsedHourInput = Readonly<{
  score: number | null | undefined;
  elapsedMs: number | null | undefined;
}>;

export type ScorePerElapsedHour = number | null;

export type ChapterElapsedInput = Readonly<{
  startAt: string | number | null | undefined;
  endAt: string | number | null | undefined;
  now: number;
  isCurrent: boolean;
  snapshotAt?: string | number | null;
}>;

/** Uses one chapter-wide reference time so rates remain comparable across ranks. */
export const calculateChapterElapsedMs = ({
  startAt,
  endAt,
  now,
  isCurrent,
  snapshotAt
}: ChapterElapsedInput): number | null => {
  const start = parseTrackerTimestamp(startAt);
  const reference = isCurrent ? now : parseTrackerTimestamp(snapshotAt) ?? parseTrackerTimestamp(endAt);
  if (start === null || reference === null || !Number.isFinite(now) || reference <= start) return null;
  return reference - start;
};

/** Returns a score rate per elapsed hour, or null when either input is unusable. */
export const calculateScorePerElapsedHour = ({ score, elapsedMs }: ScorePerElapsedHourInput): ScorePerElapsedHour => {
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    typeof elapsedMs !== "number" ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  ) {
    return null;
  }

  return (score * 3_600_000) / elapsedMs;
};
