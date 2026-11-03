import { describe, expect, it } from "vitest";
import {
  JP_SOLO_FORMULA_VERSION,
  MUSIC_META_MINIMUM_RECORD_COUNT,
  MUSIC_META_SOURCES,
  calculateJpSoloYield,
  makeRegionChartKey,
  rankJpSoloRecommendations,
  type JpSoloYieldInputs,
  type MusicMeta,
  type MusicMetaDataset
} from "#lib/music-recommender.js";

const makeMusicMeta = (musicId: number, overrides: Partial<MusicMeta> = {}): MusicMeta => ({
  musicId,
  difficulty: "expert",
  musicTime: 120,
  eventRate: 100,
  baseScore: 100,
  baseScoreAuto: 80,
  skillScoreSolo: [1, 2, 3, 4, 5, 6],
  skillScoreAuto: [6, 5, 4, 3, 2, 1],
  ...overrides
});

const makeDataset = (records: MusicMeta[] = [makeMusicMeta(5)]): MusicMetaDataset => {
  const items = [...records];
  let nextMusicId = Math.max(0, ...items.map((item) => item.musicId)) + 1;
  while (items.length < MUSIC_META_MINIMUM_RECORD_COUNT) {
    items.push(makeMusicMeta(nextMusicId));
    nextMusicId += 1;
  }

  return {
    status: "available",
    source: MUSIC_META_SOURCES["sekai-best"],
    items,
    provenance: {
      sourceId: "sekai-best",
      sourceUrl: MUSIC_META_SOURCES["sekai-best"].url,
      contentHash: `sha256:${"a".repeat(64)}`,
      recordCount: items.length,
      fetchedAt: "2026-09-25T00:00:00.000Z",
      lastModifiedAt: "2026-09-25T00:00:00.000Z"
    }
  };
};

const makeInputs = (overrides: Partial<JpSoloYieldInputs> = {}): JpSoloYieldInputs => ({
  region: "jp",
  mode: "solo",
  deckPower: 1,
  deckBonus: 0,
  boostMultiplier: 1,
  cardLength: 1,
  skillAllocation: { strategy: "default", skillEffects: [100] },
  ...overrides
});

describe("JP Solo yield calculation", () => {
  it("applies score and event-point floors in the documented order", () => {
    const dataset = makeDataset([
      makeMusicMeta(5, {
        baseScore: 10.5,
        eventRate: 103.7,
        skillScoreSolo: [2, 1, 10, 10, 10, 10]
      })
    ]);
    const result = calculateJpSoloYield(dataset, {
      ...makeInputs({
        deckPower: 200_000,
        deckBonus: 7.5,
        boostMultiplier: 3,
        cardLength: 2,
        skillAllocation: { strategy: "default", skillEffects: [75, 25] }
      }),
      musicId: 5,
      difficulty: "expert"
    });

    expect(result).toMatchObject({
      status: "available",
      score: 9_800_000,
      eventPoints: 1_971,
      formulaVersion: JP_SOLO_FORMULA_VERSION,
      provenance: {
        sourceId: "sekai-best",
        sourceUrl: MUSIC_META_SOURCES["sekai-best"].url,
        contentHash: `sha256:${"a".repeat(64)}`
      }
    });
  });

  it("preserves an explicit skill-to-coefficient sequence while default allocation sorts both", () => {
    const dataset = makeDataset([
      makeMusicMeta(5, {
        baseScore: 0,
        skillScoreSolo: [1, 2, 3, 4, 5, 6]
      })
    ]);
    const shared = {
      region: "jp",
      mode: "solo",
      deckPower: 1,
      deckBonus: 0,
      boostMultiplier: 1,
      cardLength: 2
    } as const;
    const defaultResult = calculateJpSoloYield(dataset, {
      ...shared,
      skillAllocation: { strategy: "default", skillEffects: [300, 100] },
      musicId: 5,
      difficulty: "expert"
    });
    const explicitResult = calculateJpSoloYield(dataset, {
      ...shared,
      skillAllocation: {
        strategy: "explicit",
        skillSequence: [
          { coefficientIndex: 1, effectiveSkillRate: 100 },
          { coefficientIndex: 0, effectiveSkillRate: 300 }
        ]
      },
      musicId: 5,
      difficulty: "expert"
    });

    expect(defaultResult).toMatchObject({ status: "available", score: 28 });
    expect(explicitResult).toMatchObject({ status: "available", score: 20 });
  });

  it("returns unavailable with missing fields and a reason instead of defaulting inputs", () => {
    const result = calculateJpSoloYield(makeDataset(), {
      region: "jp",
      mode: "solo",
      musicId: 5,
      difficulty: "expert",
      deckPower: null,
      deckBonus: 0,
      boostMultiplier: 1,
      cardLength: 1,
      skillAllocation: { strategy: "default", skillEffects: [100] }
    });

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "missing-inputs",
      missingFields: ["deckPower"]
    });
  });

  it("orders missing and invalid input diagnostics deterministically", () => {
    const result = calculateJpSoloYield(makeDataset(), {
      ...makeInputs({
        deckPower: null,
        deckBonus: -1,
        boostMultiplier: null,
        cardLength: 7,
        skillAllocation: null
      }),
      musicId: 5,
      difficulty: "expert"
    });

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "missing-inputs",
      missingFields: ["boostMultiplier", "deckPower", "skillAllocation"],
      invalidFields: ["cardLength", "deckBonus"]
    });
  });

  it("orders missing and invalid song diagnostics deterministically", () => {
    const missing = calculateJpSoloYield(makeDataset(), {
      ...makeInputs(),
      musicId: null,
      difficulty: ""
    });
    const invalid = calculateJpSoloYield(makeDataset(), {
      ...makeInputs(),
      musicId: 0,
      difficulty: "unknown"
    });

    expect(missing).toMatchObject({
      status: "unavailable",
      reasonCode: "missing-inputs",
      missingFields: ["difficulty", "musicId"]
    });
    expect(invalid).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-inputs",
      invalidFields: ["difficulty", "musicId"]
    });
  });

  it.each([0, -1, 2.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects deckPower that is not a positive safe integer (%s)",
    (deckPower) => {
      const result = calculateJpSoloYield(makeDataset(), {
        ...makeInputs({ deckPower }),
        musicId: 5,
        difficulty: "expert"
      });

      expect(result).toMatchObject({
        status: "unavailable",
        reasonCode: "invalid-inputs",
        invalidFields: ["deckPower"]
      });
    }
  );

  it.each([
    ["an unsupported region", { region: "cn", mode: "solo" }, "unsupported-region"],
    ["another mode", { region: "jp", mode: "multi" }, "unsupported-mode"]
  ])("does not calculate for %s", (_label, overrides, reasonCode) => {
    const result = calculateJpSoloYield(makeDataset(), {
      ...makeInputs(overrides),
      musicId: 5,
      difficulty: "expert"
    });

    expect(result).toMatchObject({ status: "unavailable", reasonCode });
  });

  it("does not reject a dataset for its age or a missing Last-Modified", () => {
    const dataset = makeDataset();
    if (dataset.status !== "available") throw new Error("Expected fixture catalog.");
    const request = { ...makeInputs(), musicId: 5, difficulty: "expert" };

    for (const lastModifiedAt of ["2020-01-01T00:00:00.000Z", null]) {
      const result = calculateJpSoloYield(
        { ...dataset, provenance: { ...dataset.provenance, lastModifiedAt } },
        request
      );
      expect(result.status).toBe("available");
    }
  });

  it("rejects source-mixed datasets", () => {
    const dataset = makeDataset();
    if (dataset.status !== "available") throw new Error("Expected fixture catalog.");
    const mixedDataset: MusicMetaDataset = {
      ...dataset,
      provenance: { ...dataset.provenance, sourceId: "moesekai" }
    };

    expect(
      calculateJpSoloYield(mixedDataset, {
        ...makeInputs(),
        musicId: 5,
        difficulty: "expert"
      })
    ).toMatchObject({ status: "unavailable", reasonCode: "mixed-data" });
  });

  it("ranks results deterministically with song and difficulty tie-breakers", () => {
    const dataset = makeDataset([
      makeMusicMeta(20, { baseScore: 300, skillScoreSolo: [0, 0, 0, 0, 0, 0] }),
      makeMusicMeta(3, { baseScore: 300, skillScoreSolo: [0, 0, 0, 0, 0, 0] }),
      makeMusicMeta(1, {
        difficulty: "master",
        baseScore: 300,
        skillScoreSolo: [0, 0, 0, 0, 0, 0]
      })
    ]);
    if (dataset.status !== "available") throw new Error("Expected fixture catalog.");
    const reversedDataset: MusicMetaDataset = { ...dataset, items: [...dataset.items].reverse() };
    const inputs = makeInputs({ skillAllocation: { strategy: "default", skillEffects: [0] } });

    const forward = rankJpSoloRecommendations(dataset, inputs, "eventPoints");
    const reversed = rankJpSoloRecommendations(reversedDataset, inputs, "eventPoints");

    expect(forward).toMatchObject({ status: "available", rankBy: "eventPoints" });
    if (forward.status !== "available" || reversed.status !== "available") return;
    expect(forward.items.map(({ music }) => [music.musicId, music.difficulty])).toEqual(
      reversed.items.map(({ music }) => [music.musicId, music.difficulty])
    );
    expect(forward.items.slice(0, 3).map(({ music }) => [music.musicId, music.difficulty])).toEqual(
      [
        [1, "master"],
        [3, "expert"],
        [20, "expert"]
      ]
    );
    expect(forward.items.map(({ rank }) => rank)).toEqual(
      Array.from({ length: MUSIC_META_MINIMUM_RECORD_COUNT }, (_, index) => index + 1)
    );
  });
});

describe("region scope for TW, EN, and KR", () => {
  const dataset = makeDataset([
    makeMusicMeta(5),
    makeMusicMeta(6),
    makeMusicMeta(6, { difficulty: "master", baseScore: 200 })
  ]);
  const charts = (...keys: Array<[number, string]>): Set<string> =>
    new Set(keys.map(([musicId, difficulty]) => makeRegionChartKey(musicId, difficulty)));

  it.each(["tw", "en", "kr"])("ranks only the charts the %s master data lists", (region) => {
    const result = rankJpSoloRecommendations(
      dataset,
      makeInputs({ region }),
      "score",
      charts([5, "expert"], [6, "master"])
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.items.map(({ music }) => `${music.musicId}:${music.difficulty}`)).toEqual([
      "6:master",
      "5:expert"
    ]);
  });

  it("uses the JP values for a chart the region shares with JP", () => {
    const jp = rankJpSoloRecommendations(dataset, makeInputs(), "score");
    const tw = rankJpSoloRecommendations(
      dataset,
      makeInputs({ region: "tw" }),
      "score",
      charts([6, "master"])
    );

    if (jp.status !== "available" || tw.status !== "available")
      throw new Error("Expected ranking.");
    const jpMaster = jp.items.find(
      ({ music }) => music.musicId === 6 && music.difficulty === "master"
    );
    expect(tw.items).toHaveLength(1);
    expect(tw.items[0]).toMatchObject({
      score: jpMaster?.score,
      eventPoints: jpMaster?.eventPoints
    });
  });

  it("leaves JP unfiltered, with or without a chart list", () => {
    const withoutList = rankJpSoloRecommendations(dataset, makeInputs(), "score");
    const withList = rankJpSoloRecommendations(
      dataset,
      makeInputs(),
      "score",
      charts([5, "expert"])
    );

    expect(withList).toEqual(withoutList);
    expect(withoutList.status === "available" && withoutList.items.length).toBe(
      dataset.status === "available" ? dataset.items.length : -1
    );
  });

  it.each([
    ["without the region's chart list", null, "region-data-unavailable"],
    ["when no chart of the region has a record", charts([1_000_000, "expert"]), "incomplete-data"]
  ])("is unavailable %s", (_label, regionCharts, reasonCode) => {
    expect(
      rankJpSoloRecommendations(dataset, makeInputs({ region: "kr" }), "score", regionCharts)
    ).toMatchObject({ status: "unavailable", reasonCode });
  });

  it("never computes a single chart the region does not list", () => {
    const request = { ...makeInputs({ region: "en" }), musicId: 5, difficulty: "expert" };

    expect(calculateJpSoloYield(dataset, request, charts([6, "master"]))).toMatchObject({
      status: "unavailable",
      reasonCode: "incomplete-data"
    });
    expect(calculateJpSoloYield(dataset, request, charts([5, "expert"]))).toMatchObject({
      status: "available"
    });
    expect(calculateJpSoloYield(dataset, request)).toMatchObject({
      status: "unavailable",
      reasonCode: "region-data-unavailable"
    });
  });
});

describe("Auto mode (formula jp-auto-community-v1)", () => {
  // The real record of music 1, master, from the 2026-10-30 audit (vectors V0 and V1 in
  // docs/viewer-implementation/tools-site-yield-validation.md).
  const music1Master = makeMusicMeta(1, {
    difficulty: "master",
    eventRate: 114,
    baseScore: 1.1599442522953187,
    baseScoreAuto: 0.7735,
    skillScoreSolo: [
      0.03796830587347502, 0.03652851213683813, 0.05339327757514775, 0.04202641177210418,
      0.0637942585838259, 0.05121274053578169
    ],
    skillScoreAuto: [
      0.026461074078732237, 0.02509910703056219, 0.036286693497673245, 0.028017607848069427,
      0.04173456169035342, 0.032589925795497424
    ]
  });
  const explicitRates = [140, 130, 120, 110, 100, 90].map(
    (effectiveSkillRate, coefficientIndex) => ({
      coefficientIndex,
      effectiveSkillRate
    })
  );
  const vectorInputs = (mode: string, boostMultiplier = 1): JpSoloYieldInputs =>
    makeInputs({
      mode,
      deckPower: 300_000,
      deckBonus: 200,
      boostMultiplier,
      cardLength: 6,
      skillAllocation: { strategy: "explicit", skillSequence: explicitRates }
    });
  const calculate = (mode: string, boostMultiplier = 1) =>
    calculateJpSoloYield(makeDataset([music1Master]), {
      ...vectorInputs(mode, boostMultiplier),
      musicId: 1,
      difficulty: "master"
    });

  it("reproduces vector V1 with the Auto base term and skill array", () => {
    expect(calculate("auto")).toMatchObject({
      status: "available",
      score: 1_186_323,
      eventPoints: 543,
      formulaVersion: "jp-auto-community-v1"
    });
    expect(calculate("auto", 5)).toMatchObject({ eventPoints: 2_715 });
  });

  it("keeps vector V0 for Solo from the same record", () => {
    expect(calculate("solo")).toMatchObject({
      status: "available",
      score: 1_776_928,
      eventPoints: 642,
      formulaVersion: "jp-solo-community-v1"
    });
  });

  it("does not let the Auto fields change a Solo result or the reverse", () => {
    const changedAuto = makeMusicMeta(1, {
      ...music1Master,
      baseScoreAuto: 9,
      skillScoreAuto: [9, 9, 9, 9, 9, 9]
    });
    const changedSolo = makeMusicMeta(1, {
      ...music1Master,
      baseScore: 9,
      skillScoreSolo: [9, 9, 9, 9, 9, 9]
    });
    const request = { ...vectorInputs("solo"), musicId: 1, difficulty: "master" };

    expect(calculateJpSoloYield(makeDataset([changedAuto]), request)).toMatchObject({
      score: 1_776_928
    });
    expect(
      calculateJpSoloYield(makeDataset([changedSolo]), { ...request, mode: "auto" })
    ).toMatchObject({ score: 1_186_323 });
  });

  it("pairs sorted Auto coefficients with sorted skill rates by default", () => {
    const music = makeMusicMeta(7, {
      baseScoreAuto: 1,
      skillScoreSolo: [0, 0, 0, 0, 0, 0],
      skillScoreAuto: [0.3, 0.1, 0.2, 0, 0, 0]
    });
    const result = calculateJpSoloYield(makeDataset([music]), {
      ...makeInputs({
        mode: "auto",
        deckPower: 1000,
        cardLength: 3,
        skillAllocation: { strategy: "default", skillEffects: [100, 300, 200] }
      }),
      musicId: 7,
      difficulty: "expert"
    });

    // Sorted coefficients 0.1, 0.2, 0.3 meet sorted rates 100, 200, 300: 1 + 0.1 + 0.4 + 0.9; an
    // unsorted pairing would give 8,400.
    expect(result).toMatchObject({ status: "available", score: 9600 });
  });

  it("ranks Auto results by the Auto figures", () => {
    const dataset = makeDataset([
      makeMusicMeta(1, { baseScore: 500, baseScoreAuto: 1, skillScoreAuto: [0, 0, 0, 0, 0, 0] }),
      makeMusicMeta(2, { baseScore: 1, baseScoreAuto: 500, skillScoreAuto: [0, 0, 0, 0, 0, 0] })
    ]);
    const solo = rankJpSoloRecommendations(dataset, makeInputs(), "score");
    const auto = rankJpSoloRecommendations(dataset, makeInputs({ mode: "auto" }), "score");

    expect(solo.status === "available" && solo.items[0].music.musicId).toBe(1);
    expect(auto.status === "available" && auto.items[0].music.musicId).toBe(2);
    expect(auto.status === "available" && auto.formulaVersion).toBe("jp-auto-community-v1");
  });

  it.each(["multi", "challenge", "cheerful", "world-bloom"])(
    "still refuses the %s mode",
    (mode) => {
      expect(
        calculateJpSoloYield(makeDataset(), {
          ...makeInputs({ mode }),
          musicId: 5,
          difficulty: "expert"
        })
      ).toMatchObject({ status: "unavailable", reasonCode: "unsupported-mode" });
    }
  );
});
