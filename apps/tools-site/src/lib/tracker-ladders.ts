/** Legacy EventTracker rank ladders, kept in their original display order. */
export const FULL_RANK_LADDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000, 2000,
  3000, 4000, 5000, 10_000, 20_000, 30_000, 40_000, 50_000, 100_000
] as const;

/**
 * The legacy component misspelled this value as `critialRank`.
 * Its rank values are preserved here under the corrected name.
 */
export const CRITICAL_RANK_LADDER = [1, 2, 3, 10, 100, 1000, 5000, 10_000, 50_000, 100_000] as const;

export type TrackerLadderRank = (typeof FULL_RANK_LADDER)[number];
export type TrackerRankLadder = "critical" | "full";

export const getTrackerRankLadder = (ladder: TrackerRankLadder): readonly TrackerLadderRank[] =>
  ladder === "critical" ? CRITICAL_RANK_LADDER : FULL_RANK_LADDER;
