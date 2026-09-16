import { describe, expect, it } from "vitest";
import { calculateTrackerGoalPlan, type TrackerGoalInput } from "./tracker-goal";

const HOUR_MS = 3_600_000;

const baseInput = (): TrackerGoalInput => ({
  calculatedAt: 0,
  deadlineAt: 10 * HOUR_MS,
  player: { currentScore: 500 },
  line: {
    score: 1_000,
    capturedAt: 0,
    rate: { source: "recent", pointsPerHour: 100 }
  },
  target: { safetyMarginPoints: 200 }
});

describe("tracker goal pace planner", () => {
  it("projects the ranking line and calculates calendar and active pace", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      availablePlayHours: 20
    });

    expect(result).toMatchObject({
      status: "ready",
      lineHorizon: 10,
      projectedLine: 2_000,
      plannedTarget: 2_200,
      requiredGain: 1_700,
      calendarRate: 170,
      activeRate: 85,
      rate: 100,
      rateSource: "recent",
      capacityStatus: "unknown"
    });
  });

  it("uses the minimum score without interpolating a missing rank", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      minimumScore: 3_000
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.plannedTarget).toBe(3_000);
      expect(result.requiredGain).toBe(2_500);
    }
  });

  it("reports an already-covered target instead of a negative gain", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      player: { currentScore: 3_000 },
      availablePlayHours: 5
    });

    expect(result).toMatchObject({
      status: "already-covered",
      requiredGain: 0,
      calendarRate: 0,
      activeRate: 0
    });
  });

  it("calculates loop demand and classifies capacity", () => {
    const loop = { pointsPerRun: 100, cycleMinutes: 30 };
    const comfortable = calculateTrackerGoalPlan({
      ...baseInput(),
      availablePlayHours: 20,
      loop
    });
    const highRisk = calculateTrackerGoalPlan({
      ...baseInput(),
      availablePlayHours: 10,
      loop
    });
    const impossible = calculateTrackerGoalPlan({
      ...baseInput(),
      availablePlayHours: 8,
      loop
    });

    expect(comfortable).toMatchObject({
      capacity: 200,
      capacityStatus: "comfortable",
      runs: 17,
      playHoursNeeded: 8.5,
      runsPerHour: 0.85
    });
    expect(highRisk.status).toBe("ready");
    if (highRisk.status === "ready") expect(highRisk.capacityStatus).toBe("high-risk");
    expect(impossible.status).toBe("ready");
    if (impossible.status === "ready") expect(impossible.capacityStatus).toBe("impossible");
  });

  it("keeps capacity unknown when either activity input is absent", () => {
    const withoutHours = calculateTrackerGoalPlan({
      ...baseInput(),
      loop: { pointsPerRun: 100, cycleMinutes: 30 }
    });
    const withoutLoop = calculateTrackerGoalPlan({
      ...baseInput(),
      availablePlayHours: 5
    });

    expect(withoutHours).toMatchObject({
      status: "ready",
      runs: 17,
      capacityStatus: "unknown"
    });
    expect(withoutLoop).toMatchObject({ status: "ready", activeRate: 340, capacityStatus: "unknown" });
  });

  it.each([
    ["deadline", { deadlineAt: 0 }],
    ["captured line", { line: { ...baseInput().line, capturedAt: 10 * HOUR_MS } }],
    ["negative score", { player: { currentScore: -1 } }],
    ["negative rate", { line: { ...baseInput().line, rate: { source: "manual", pointsPerHour: -1 } } }],
    ["invalid loop", { loop: { pointsPerRun: 0, cycleMinutes: 30 } }]
  ] as const)("rejects %s as invalid", (_label, overrides) => {
    const result = calculateTrackerGoalPlan({ ...baseInput(), ...overrides });
    expect(result.status).toBe("invalid");
  });

  it("returns unavailable when required live data has not arrived", () => {
    const result = calculateTrackerGoalPlan({
      ...baseInput(),
      line: { ...baseInput().line, rate: null }
    });

    expect(result).toEqual({ status: "unavailable", reason: "missing-data" });
  });
});
