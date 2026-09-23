const HOUR_MS = 3_600_000;

export type TrackerGoalInput = Readonly<{
  latestDataAt: number | null | undefined;
  deadlineAt: number | null | undefined;
  player: Readonly<{ currentScore: number | null | undefined }>;
  target: Readonly<{
    score: number | null | undefined;
    rate: number | null | undefined;
  }>;
  safetyMarginPoints: number | null | undefined;
  availablePlayHours?: number | null | undefined;
}>;

export type TrackerGoalProjection = Readonly<{
  startScore: number;
  rate: number;
  capturedAt: number;
  finalScore: number;
}>;

export type TrackerGoalFailureReason =
  "missing-data" | "invalid-input" | "invalid-time-window" | "invalid-rate";

type TrackerGoalFailure = Readonly<{
  status: "invalid" | "unavailable";
  reason: TrackerGoalFailureReason;
}>;

export type TrackerGoalReady = Readonly<{
  status: "ready";
  latestDataAt: number;
  deadlineAt: number;
  remainingActivityHours: number;
  currentScore: number;
  targetScore: number;
  targetRate: number;
  targetProjectedFinalScore: number;
  safetyMarginPoints: number;
  requiredFinalScore: number;
  requiredGain: number;
  requiredRate: number;
  availablePlayHours?: number;
  dailyRequiredScore?: number;
  user: TrackerGoalProjection;
  target: TrackerGoalProjection;
}>;

export type TrackerGoalResult = TrackerGoalReady | TrackerGoalFailure;
export type TrackerGoalPlan = TrackerGoalReady;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isDerivedNumber = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

const unavailable = (): TrackerGoalFailure => ({
  status: "unavailable",
  reason: "missing-data"
});

const invalid = (reason: TrackerGoalFailureReason = "invalid-input"): TrackerGoalFailure => ({
  status: "invalid",
  reason
});

/** Calculates a goal using the selected ranking row's average speed. */
export const calculateTrackerGoalPlan = (input: TrackerGoalInput): TrackerGoalResult => {
  if (!isRecord(input) || !isRecord(input.player) || !isRecord(input.target)) {
    return unavailable();
  }

  const latestDataAt = input.latestDataAt;
  const deadlineAt = input.deadlineAt;
  const currentScore = input.player.currentScore;
  const targetScore = input.target.score;
  const targetRate = input.target.rate;
  const safetyMarginPoints = input.safetyMarginPoints;

  if (
    latestDataAt === null ||
    latestDataAt === undefined ||
    deadlineAt === null ||
    deadlineAt === undefined ||
    currentScore === null ||
    currentScore === undefined ||
    targetScore === null ||
    targetScore === undefined ||
    targetRate === null ||
    targetRate === undefined ||
    safetyMarginPoints === null ||
    safetyMarginPoints === undefined
  ) {
    return unavailable();
  }

  if (
    !isSafeNonNegativeInteger(latestDataAt) ||
    !isSafeNonNegativeInteger(deadlineAt) ||
    !isSafeNonNegativeInteger(currentScore) ||
    !isSafeNonNegativeInteger(targetScore) ||
    !isSafeNonNegativeInteger(safetyMarginPoints)
  ) {
    return invalid();
  }

  if (deadlineAt <= latestDataAt) return invalid("invalid-time-window");

  const remainingActivityHours = (deadlineAt - latestDataAt) / HOUR_MS;
  if (!isDerivedNumber(remainingActivityHours) || remainingActivityHours <= 0) {
    return invalid("invalid-time-window");
  }

  if (!isFiniteNonNegative(targetRate)) return invalid("invalid-rate");

  const targetProjectedFinalScore = targetScore + targetRate * remainingActivityHours;
  const requiredFinalScore = targetProjectedFinalScore + safetyMarginPoints;
  const requiredGain = Math.max(0, requiredFinalScore - currentScore);
  const requiredRate = requiredGain / remainingActivityHours;
  if (
    !isDerivedNumber(targetProjectedFinalScore) ||
    !isDerivedNumber(requiredFinalScore) ||
    !isDerivedNumber(requiredGain) ||
    !isDerivedNumber(requiredRate)
  ) {
    return invalid();
  }

  const availablePlayHours = input.availablePlayHours;
  if (
    availablePlayHours !== null &&
    availablePlayHours !== undefined &&
    (!isFiniteNonNegative(availablePlayHours) || availablePlayHours > Number.MAX_SAFE_INTEGER)
  ) {
    return invalid();
  }

  const dailyRequiredScore =
    availablePlayHours !== null && availablePlayHours !== undefined && availablePlayHours > 0
      ? requiredRate * availablePlayHours
      : undefined;
  if (dailyRequiredScore !== undefined && !isDerivedNumber(dailyRequiredScore)) {
    return invalid();
  }

  const result: TrackerGoalReady = {
    status: "ready",
    latestDataAt,
    deadlineAt,
    remainingActivityHours,
    currentScore,
    targetScore,
    targetRate,
    targetProjectedFinalScore,
    safetyMarginPoints,
    requiredFinalScore,
    requiredGain,
    requiredRate,
    user: {
      startScore: currentScore,
      rate: requiredRate,
      capturedAt: latestDataAt,
      finalScore: currentScore + requiredRate * remainingActivityHours
    },
    target: {
      startScore: targetScore,
      rate: targetRate,
      capturedAt: latestDataAt,
      finalScore: targetProjectedFinalScore
    },
    ...(availablePlayHours !== null && availablePlayHours !== undefined
      ? { availablePlayHours }
      : {}),
    ...(dailyRequiredScore !== undefined ? { dailyRequiredScore } : {})
  };

  return result;
};

export const calculateTrackerGoal = calculateTrackerGoalPlan;
export const planTrackerGoal = calculateTrackerGoalPlan;
