import { describe, expect, it } from "vitest";
import {
  LATEST_GACHA_CANDIDATE_LIMIT,
  LATEST_GACHA_LIMIT,
  selectLatestGachas,
  type LatestGachaItem
} from "./home-latest-data";

const NOW = Date.parse("2026-09-05T12:00:00.000Z");

const makeGacha = (
  id: string,
  startAt: string | number | null,
  endAt: string | number | null
): LatestGachaItem => ({
  id,
  name: `Gacha ${id}`,
  assetBundleName: `gacha_${id}`,
  startAt,
  endAt
});

describe("selectLatestGachas", () => {
  it("keeps the candidate fetch limit above the display limit", () => {
    expect(LATEST_GACHA_CANDIDATE_LIMIT).toBeGreaterThan(LATEST_GACHA_LIMIT);
  });

  it("puts ongoing gachas before recent ended gachas", () => {
    const items = [
      makeGacha("newer-ended", NOW - 1_000, NOW - 500),
      makeGacha("older-ongoing", NOW - 10_000, NOW + 10_000),
      makeGacha("older-ended", NOW - 20_000, NOW - 10_001)
    ];

    expect(selectLatestGachas(items, NOW).map((item) => item.id)).toEqual([
      "older-ongoing",
      "newer-ended"
    ]);
  });

  it("returns recent started gachas when none are ongoing", () => {
    const items = [
      makeGacha("older", NOW - 20_000, NOW - 10_000),
      makeGacha("newer", NOW - 1_000, NOW - 500)
    ];

    expect(selectLatestGachas(items, NOW).map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("excludes gachas that have not started yet", () => {
    const items = [
      makeGacha("future", NOW + 1, NOW + 10_000),
      makeGacha("started", NOW - 1_000, NOW - 500)
    ];

    expect(selectLatestGachas(items, NOW).map((item) => item.id)).toEqual(["started"]);
  });

  it("ignores gachas with invalid timestamps", () => {
    const items = [
      makeGacha("invalid-number", Number.NaN, NOW),
      makeGacha("invalid-string", "not-a-date", NOW),
      makeGacha("valid-string", "2026-09-05T11:00:00.000Z", null),
      makeGacha("valid", NOW - 1_000, null)
    ];

    expect(selectLatestGachas(items, NOW).map((item) => item.id)).toEqual([
      "valid",
      "valid-string"
    ]);
  });

  it("returns at most the display limit", () => {
    const items = [
      makeGacha("ongoing-1", NOW - 5_000, NOW + 5_000),
      makeGacha("ongoing-2", NOW - 4_000, NOW + 4_000),
      makeGacha("ended-1", NOW - 3_000, NOW - 2_000),
      makeGacha("ended-2", NOW - 2_000, NOW - 1_000),
      makeGacha("ended-3", NOW - 1_000, NOW - 500)
    ];

    const selected = selectLatestGachas(items, NOW);

    expect(selected).toHaveLength(LATEST_GACHA_LIMIT);
    expect(selected.map((item) => item.id)).toEqual([
      "ongoing-2",
      "ongoing-1"
    ]);
  });

  it("treats both start and end boundaries as ongoing", () => {
    const items = [
      makeGacha("starts-now", NOW, NOW + 1_000),
      makeGacha("ends-now", NOW - 1_000, NOW)
    ];

    expect(selectLatestGachas(items, NOW).map((item) => item.id)).toEqual([
      "starts-now",
      "ends-now"
    ]);
  });
});
