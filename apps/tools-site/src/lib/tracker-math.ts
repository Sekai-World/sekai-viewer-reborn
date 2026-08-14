export type ScorePerElapsedHourInput = Readonly<{
  score: number | null | undefined;
  elapsedMs: number | null | undefined;
}>;

export type ScorePerElapsedHour = number | null;

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
