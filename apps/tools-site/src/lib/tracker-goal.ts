const HOUR_MS = 3_600_000;

export type TrackerGoalRateSource = "recent" | "manual";

/**
 * A rate can be supplied as a tagged value, or as a number for callers that
 * already chose their source. Numeric rates are treated as manual values.
 */
export type TrackerGoalRate =
  | number
  | Readonly<{
      source?: TrackerGoalRateSource;
      kind?: TrackerGoalRateSource;
      type?: TrackerGoalRateSource;
      pointsPerHour?: number;
      value?: number;
    }>;

export type TrackerGoalInput = Readonly<{
  calculatedAt: number | null | undefined;
  deadlineAt: number | null | undefined;
  player: Readonly<{
    currentScore: number | null | undefined;
  }>;
  line: Readonly<{
    score: number | null | undefined;
    capturedAt: number | null | undefined;
    rate: TrackerGoalRate | null | undefined;
  }>;
  target: Readonly<{
    safetyMarginPoints: number | null | undefined;
  }>;
  minimumScore?: number | null;
  availablePlayHours?: number | null;
  loop?: Readonly<{
    pointsPerRun: number | null | undefined;
    cycleMinutes: number | null | undefined;
  }> | null;
}>;

export type TrackerGoalCapacityStatus =
  | "unknown"
  | "comfortable"
  | "high-risk"
  | "impossible";

export type TrackerGoalFailureReason =
  | "missing-data"
  | "invalid-input"
  | "invalid-time-window"
  | "invalid-rate"
  | "invalid-loop";

type TrackerGoalFailure = Readonly<{
  status: "invalid" | "unavailable";
  reason: TrackerGoalFailureReason;
}>;

type TrackerGoalPlanMetrics = Readonly<{
  calculatedAt: number;
  deadlineAt: number;
  currentScore: number;
  lineScore: number;
  capturedAt: number;
  safetyMarginPoints: number;
  lineHorizon: number;
  lineHorizonHours: number;
  projectedLine: number;
  plannedTarget: number;
  requiredGain: number;
  calendarRate: number;
  activeRate?: number;
  runs?: number;
  playHoursNeeded?: number;
  runsPerHour?: number;
  capacity?: number;
  maxAllowedCycleMinutes?: number;
  capacityStatus: TrackerGoalCapacityStatus;
  rate: number;
  rateSource: TrackerGoalRateSource;
}>;

export type TrackerGoalReady = Readonly<
  { status: "ready" } & TrackerGoalPlanMetrics
>;

export type TrackerGoalAlreadyCovered = Readonly<
  { status: "already-covered" } & TrackerGoalPlanMetrics
>;

export type TrackerGoalResult =
  | TrackerGoalReady
  | TrackerGoalAlreadyCovered
  | TrackerGoalFailure;

export type TrackerGoalPlan = TrackerGoalReady | TrackerGoalAlreadyCovered;

type NormalizedRate = Readonly<{
  source: TrackerGoalRateSource;
  pointsPerHour: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isDerivedNumber = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

const normalizeRate = (
  value: TrackerGoalRate | null | undefined
): NormalizedRate | null | "invalid" => {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return { source: "manual", pointsPerHour: value };
  }

  if (!isRecord(value)) return "invalid";

  const source = value.source ?? value.kind ?? value.type;
  const pointsPerHour = value.pointsPerHour ?? value.value;
  if (
    (source !== "recent" && source !== "manual") ||
    typeof pointsPerHour !== "number"
  ) {
    return "invalid";
  }

  return { source, pointsPerHour };
};

const invalid = (reason: TrackerGoalFailureReason = "invalid-input"): TrackerGoalFailure => ({
  status: "invalid",
  reason
});

const unavailable = (): TrackerGoalFailure => ({
  status: "unavailable",
  reason: "missing-data"
});

/** Calculates a ranking-line pace plan without interpolating unavailable ranks. */
export const calculateTrackerGoalPlan = (input: TrackerGoalInput): TrackerGoalResult => {
  if (!isRecord(input)) return unavailable();

  const player = isRecord(input.player) ? input.player : null;
  const line = isRecord(input.line) ? input.line : null;
  const target = isRecord(input.target) ? input.target : null;
  if (!player || !line || !target) return unavailable();

  const { calculatedAt, deadlineAt } = input;
  const currentScore = player.currentScore;
  const lineScore = line.score;
  const capturedAt = line.capturedAt;
  const safetyMarginPoints = target.safetyMarginPoints;
  const normalizedRate = normalizeRate(line.rate);

  if (
    calculatedAt === null ||
    calculatedAt === undefined ||
    deadlineAt === null ||
    deadlineAt === undefined ||
    currentScore === null ||
    currentScore === undefined ||
    lineScore === null ||
    lineScore === undefined ||
    capturedAt === null ||
    capturedAt === undefined ||
    safetyMarginPoints === null ||
    safetyMarginPoints === undefined ||
    normalizedRate === null
  ) {
    return unavailable();
  }

  if (normalizedRate === "invalid") return invalid("invalid-rate");
  if (
    !isSafeNonNegativeInteger(calculatedAt) ||
    !isSafeNonNegativeInteger(deadlineAt) ||
    !isSafeNonNegativeInteger(capturedAt) ||
    !isSafeNonNegativeInteger(currentScore) ||
    !isSafeNonNegativeInteger(lineScore) ||
    !isSafeNonNegativeInteger(safetyMarginPoints)
  ) {
    return invalid();
  }

  if (deadlineAt <= calculatedAt || capturedAt >= deadlineAt) {
    return invalid("invalid-time-window");
  }

  if (!isFiniteNonNegative(normalizedRate.pointsPerHour)) {
    return invalid("invalid-rate");
  }

  const minimumScore = input.minimumScore;
  if (minimumScore !== null && minimumScore !== undefined && !isSafeNonNegativeInteger(minimumScore)) {
    return invalid();
  }

  const availablePlayHours = input.availablePlayHours;
  if (availablePlayHours !== null && availablePlayHours !== undefined && !isPositiveFinite(availablePlayHours)) {
    return invalid();
  }

  const loop = input.loop;
  const loopConfig = loop === null || loop === undefined ? undefined : loop;
  if (
    loopConfig !== undefined &&
    (loopConfig.pointsPerRun === null ||
      loopConfig.pointsPerRun === undefined ||
      loopConfig.cycleMinutes === null ||
      loopConfig.cycleMinutes === undefined)
  ) {
    return invalid("invalid-loop");
  }
  if (
    loopConfig !== undefined &&
    (!isSafeNonNegativeInteger(loopConfig.pointsPerRun) ||
      loopConfig.pointsPerRun <= 0 ||
      !isPositiveFinite(loopConfig.cycleMinutes))
  ) {
    return invalid("invalid-loop");
  }

  const lineHorizon = Math.max(0, (deadlineAt - capturedAt) / HOUR_MS);
  const projectedLine = lineScore + normalizedRate.pointsPerHour * lineHorizon;
  const plannedTarget = Math.max(
    projectedLine + safetyMarginPoints,
    minimumScore ?? 0
  );
  const requiredGain = Math.max(0, plannedTarget - currentScore);
  const calendarHours = (deadlineAt - calculatedAt) / HOUR_MS;
  const calendarRate = requiredGain / calendarHours;

  if (
    !isDerivedNumber(lineHorizon) ||
    !isDerivedNumber(projectedLine) ||
    !isDerivedNumber(plannedTarget) ||
    !isDerivedNumber(requiredGain) ||
    !isDerivedNumber(calendarRate)
  ) {
    return invalid();
  }

  const metrics: {
    calculatedAt: number;
    deadlineAt: number;
    currentScore: number;
    lineScore: number;
    capturedAt: number;
    safetyMarginPoints: number;
    lineHorizon: number;
    lineHorizonHours: number;
    projectedLine: number;
    plannedTarget: number;
    requiredGain: number;
    calendarRate: number;
    capacityStatus: TrackerGoalCapacityStatus;
    rate: number;
    rateSource: TrackerGoalRateSource;
    activeRate?: number;
    runs?: number;
    playHoursNeeded?: number;
    runsPerHour?: number;
    capacity?: number;
    maxAllowedCycleMinutes?: number;
  } = {
    calculatedAt,
    deadlineAt,
    currentScore,
    lineScore,
    capturedAt,
    safetyMarginPoints,
    lineHorizon,
    lineHorizonHours: lineHorizon,
    projectedLine,
    plannedTarget,
    requiredGain,
    calendarRate,
    capacityStatus: "unknown",
    rate: normalizedRate.pointsPerHour,
    rateSource: normalizedRate.source
  };

  if (availablePlayHours !== null && availablePlayHours !== undefined) {
    const activeRate = requiredGain / availablePlayHours;
    if (!isDerivedNumber(activeRate)) return invalid();
    metrics.activeRate = activeRate;
  }

  if (loopConfig !== undefined) {
    const pointsPerRun = loopConfig.pointsPerRun;
    const cycleMinutes = loopConfig.cycleMinutes;
    if (
      !isSafeNonNegativeInteger(pointsPerRun) ||
      pointsPerRun <= 0 ||
      !isPositiveFinite(cycleMinutes)
    ) {
      return invalid("invalid-loop");
    }
    const runs = Math.ceil(requiredGain / pointsPerRun);
    const playHoursNeeded = (runs * cycleMinutes) / 60;
    if (!Number.isSafeInteger(runs) || !isDerivedNumber(playHoursNeeded)) {
      return invalid("invalid-loop");
    }
    metrics.runs = runs;
    metrics.playHoursNeeded = playHoursNeeded;

    if (metrics.activeRate !== undefined) {
      const capacity = (pointsPerRun * 60) / cycleMinutes;
      if (!isDerivedNumber(capacity)) return invalid("invalid-loop");
      metrics.capacity = capacity;
      metrics.runsPerHour = runs / availablePlayHours!;
      if (!isDerivedNumber(metrics.runsPerHour)) return invalid("invalid-loop");

      metrics.capacityStatus =
        metrics.activeRate > capacity
          ? "impossible"
          : metrics.activeRate > capacity * 0.8
            ? "high-risk"
            : "comfortable";

      if (metrics.activeRate > 0) {
        const maxAllowedCycleMinutes = pointsPerRun * 60 / metrics.activeRate;
        if (!isDerivedNumber(maxAllowedCycleMinutes)) return invalid("invalid-loop");
        metrics.maxAllowedCycleMinutes = maxAllowedCycleMinutes;
      }
    }
  }

  return {
    ...metrics,
    status: requiredGain === 0 ? "already-covered" : "ready"
  };
};

export const calculateTrackerGoal = calculateTrackerGoalPlan;
export const planTrackerGoal = calculateTrackerGoalPlan;
