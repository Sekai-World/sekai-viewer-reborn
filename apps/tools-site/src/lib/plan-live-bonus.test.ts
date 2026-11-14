import { describe, expect, it } from "vitest";
import { findLiveBonusPerLive, livesWithinLiveBonus, type BoostRow } from "./plan-live-bonus";

// The JP `boosts.json` pairs of 2026-11-12; a fixture, never the source of the table at run time.
const BOOSTS: BoostRow[] = [1, 5, 10, 15, 20, 25, 27, 29, 31, 33, 35].map(
  (eventPointRate, costBoost) => ({ costBoost, eventPointRate })
);

describe("findLiveBonusPerLive", () => {
  it("returns the cost of the row whose event-point rate is the multiplier", () => {
    // Vectors E1 to E3 of tools-site-yield-duration-energy.md.
    expect(findLiveBonusPerLive(BOOSTS, 5)).toBe(1);
    expect(findLiveBonusPerLive(BOOSTS, 35)).toBe(10);
    expect(findLiveBonusPerLive(BOOSTS, 1)).toBe(0);
  });

  it("has no cost for a multiplier that is not a row", () => {
    // Vector E4.
    expect(findLiveBonusPerLive(BOOSTS, 4)).toBeNull();
    expect(findLiveBonusPerLive([], 1)).toBeNull();
  });

  it("matches the rate, never another column or the cost itself", () => {
    expect(findLiveBonusPerLive([{ costBoost: 5, eventPointRate: 25 }], 5)).toBeNull();
  });
});

describe("livesWithinLiveBonus", () => {
  it("is exactly the set of lives that fit the cap, for every cost and cap", () => {
    for (let perLive = 1; perLive <= 12; perLive += 1) {
      for (let cap = 1; cap <= 150; cap += 1) {
        const allowed = livesWithinLiveBonus(cap, perLive);
        if (allowed === null) throw new Error("A live that costs live bonus is always limited.");
        for (let lives = 0; lives <= cap + 1; lives += 1) {
          expect(lives * perLive <= cap, `${lives} lives at ${perLive} within ${cap}`).toBe(
            lives <= allowed
          );
        }
      }
    }
  });

  it("allows no live when one live costs more than the cap", () => {
    expect(livesWithinLiveBonus(9, 10)).toBe(0);
    expect(livesWithinLiveBonus(10, 10)).toBe(1);
  });

  it("does not limit lives that cost nothing", () => {
    expect(livesWithinLiveBonus(1, 0)).toBeNull();
  });
});
