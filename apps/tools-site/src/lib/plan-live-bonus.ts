/**
 * Live bonus (energy) of a target plan. Every live of a plan uses the boost entered with the
 * deck, so a plan's live bonus is its number of lives times the cost of that boost, and a cap on
 * live bonus is exactly a cap on lives. The cost comes from the master data `boosts` table and is
 * never copied into code.
 * See docs/viewer-implementation/tools-site-yield-duration-energy.md.
 */

/** One `boosts` row: the live bonus a live consumes and the event-point multiplier it buys. */
export type BoostRow = Readonly<{ costBoost: number; eventPointRate: number }>;

/** The largest live bonus cap accepted; any plan within the lives limit uses far less. */
export const PLAN_MAX_LIVE_BONUS = 1_000_000;

/** The live bonus one live costs at this multiplier, or null when it is not a row of the table. */
export const findLiveBonusPerLive = (
  boosts: readonly BoostRow[],
  boostMultiplier: number
): number | null => boosts.find((row) => row.eventPointRate === boostMultiplier)?.costBoost ?? null;

/**
 * The most lives a live bonus cap allows: `lives × perLive ≤ cap` exactly when
 * `lives ≤ floor(cap ÷ perLive)`. Null means no limit, because a live that costs nothing can be
 * played any number of times.
 */
export const livesWithinLiveBonus = (cap: number, perLive: number): number | null =>
  perLive === 0 ? null : Math.floor(cap / perLive);
