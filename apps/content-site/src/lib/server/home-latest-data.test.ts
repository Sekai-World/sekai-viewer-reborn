import { describe, expect, it } from "vitest";
import { selectLatestGachas, type LatestGachaItem } from "./home-latest-data";

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

  it("returns at most two gachas", () => {
    const items = [
      makeGacha("ongoing-1", NOW - 5_000, NOW + 5_000),
      makeGacha("ongoing-2", NOW - 4_000, NOW + 4_000),
      makeGacha("ended-1", NOW - 3_000, NOW - 2_000),
      makeGacha("ended-2", NOW - 2_000, NOW - 1_000),
      makeGacha("ended-3", NOW - 1_000, NOW - 500)
    ];

    expect(selectLatestGachas(items, NOW).map((item) => item.id)).toEqual([
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
