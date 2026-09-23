import { describe, expect, it } from "vitest";
import { calculateTrackerGoalPlan, type TrackerGoalInput } from "./tracker-goal";

const HOUR_MS = 3_600_000;

const baseInput = (): TrackerGoalInput => ({
  latestDataAt: 5 * HOUR_MS,
  deadlineAt: 10 * HOUR_MS,
  player: { currentScore: 500 },
  target: { score: 1_500, rate: 200 },
  safetyMarginPoints: 200
});

describe("tracker goal calculator", () => {
  it("uses the selected row average speed and projects both lines to the deadline", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      availablePlayHours: 2
    });

    expect(result).toMatchObject({
      status: "ready",
      remainingActivityHours: 5,
      targetRate: 200,
      targetProjectedFinalScore: 2_500,
      safetyMarginPoints: 200,
      requiredFinalScore: 2_700,
      requiredGain: 2_200,
      requiredRate: 440,
      availablePlayHours: 2,
      dailyRequiredScore: 880,
      target: { startScore: 1_500, rate: 200, finalScore: 2_500 },
      user: { startScore: 500, rate: 440, finalScore: 2_700 }
    });
  });

  it("uses the supplied average speed directly", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      target: { score: 1_500, rate: 80 }
    });

    expect(result).toMatchObject({
      status: "ready",
      targetRate: 80,
      targetProjectedFinalScore: 1_900,
      requiredFinalScore: 2_100,
      requiredRate: 320
    });
  });

  it("accepts a zero average speed", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      target: { score: 1_500, rate: 0 }
    });

    expect(result).toMatchObject({
      status: "ready",
      targetProjectedFinalScore: 1_500,
      requiredFinalScore: 1_700,
      requiredRate: 240
    });
  });

  it("clamps the required speed to zero when the current score already covers the goal", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      player: { currentScore: 4_000 }
    });

    expect(result).toMatchObject({
      status: "ready",
      requiredRate: 0,
      user: { rate: 0, finalScore: 4_000 }
    });
  });

  it("omits the daily target when daily play time is empty or zero", () => {
    const withoutHours = calculateTrackerGoalPlan(baseInput());
    const withZeroHours = calculateTrackerGoalPlan({ ...baseInput(), availablePlayHours: 0 });

    expect(withoutHours.status).toBe("ready");
    if (withoutHours.status === "ready") expect(withoutHours.dailyRequiredScore).toBeUndefined();
    expect(withZeroHours.status).toBe("ready");
    if (withZeroHours.status === "ready") expect(withZeroHours.dailyRequiredScore).toBeUndefined();
  });

  it("returns unavailable when the target score or average speed is missing", () => {
    expect(
      calculateTrackerGoalPlan({
        ...baseInput(),
        target: { score: null, rate: 200 }
      })
    ).toEqual({ status: "unavailable", reason: "missing-data" });
    expect(
      calculateTrackerGoalPlan({
        ...baseInput(),
        target: { score: 1_500, rate: null }
      })
    ).toEqual({ status: "unavailable", reason: "missing-data" });
  });

  it("rejects an ended or invalid time window", () => {
    expect(calculateTrackerGoalPlan({ ...baseInput(), deadlineAt: 5 * HOUR_MS })).toEqual({
      status: "invalid",
      reason: "invalid-time-window"
    });
    expect(calculateTrackerGoalPlan({ ...baseInput(), latestDataAt: -1 })).toEqual({
      status: "invalid",
      reason: "invalid-input"
    });
  });

  it.each([
    ["current score", { player: { currentScore: null } }],
    ["target score", { target: { score: null, rate: 200 } }],
    ["target average speed", { target: { score: 1_500, rate: null } }],
    ["safety margin", { safetyMarginPoints: null }],
    ["daily play time", { availablePlayHours: -1 }]
  ] as const)("returns the appropriate result for missing or invalid %s", (_label, overrides) => {
    const result = calculateTrackerGoalPlan({ ...baseInput(), ...overrides });
    expect(result.status).toBe(_label === "daily play time" ? "invalid" : "unavailable");
  });

  it("rejects a negative target average speed as an invalid rate", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      target: { score: 1_500, rate: -1 }
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-rate" });
  });
});
