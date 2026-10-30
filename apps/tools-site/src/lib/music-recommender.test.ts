import { describe, expect, it } from "vitest";
import {
  JP_SOLO_FORMULA_VERSION,
  MUSIC_META_MINIMUM_RECORD_COUNT,
  MUSIC_META_SOURCES,
  calculateJpSoloYield,
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
  skillScoreSolo: [1, 2, 3, 4, 5, 6],
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
    ["another region", { region: "en", mode: "solo" }, "unsupported-region"],
    ["another mode", { region: "jp", mode: "auto" }, "unsupported-mode"]
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
