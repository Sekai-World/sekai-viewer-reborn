import { describe, expect, it } from "vitest";
import {
  JP_SOLO_FORMULA_VERSION,
  MUSIC_META_MINIMUM_RECORD_COUNT,
  MUSIC_META_SOURCES,
  calculateJpSoloYield,
  normalizeMusicMetaPayload,
  rankJpSoloRecommendations,
  type JpSoloYieldInputs,
  type MusicMeta,
  type MusicMetaDataset
} from "$lib/music-recommender";

const makeRawMusicMeta = (musicId: number, overrides: Record<string, unknown> = {}) => ({
  music_id: musicId,
  difficulty: "expert",
  music_time: 120,
  event_rate: 100,
  base_score: 100,
  skill_score_solo: [1, 2, 3, 4, 5, 6],
  ...overrides
});

const makeRawCatalog = (count = MUSIC_META_MINIMUM_RECORD_COUNT) =>
  Array.from({ length: count }, (_, index) => makeRawMusicMeta(index + 1));

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
      freshness: {
        status: "fresh",
        checkedAt: "2026-09-25T00:00:00.000Z",
        responseDate: "2026-09-25T00:00:00.000Z",
        responseAgeMs: 0,
        lastModifiedAt: "2026-09-25T00:00:00.000Z"
      }
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

describe("music metadata normalization", () => {
  it("normalizes required fields and sorts records independently of source order", () => {
    const payload = makeRawCatalog().reverse();

    const result = normalizeMusicMetaPayload(payload);

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.items).toHaveLength(MUSIC_META_MINIMUM_RECORD_COUNT);
    expect(result.items[0]).toMatchObject({
      musicId: 1,
      difficulty: "expert",
      musicTime: 120,
      eventRate: 100,
      baseScore: 100,
      skillScoreSolo: [1, 2, 3, 4, 5, 6]
    });
    expect(result.items.at(-1)?.musicId).toBe(MUSIC_META_MINIMUM_RECORD_COUNT);
  });

  it("reports missing required fields without filling them with zero", () => {
    const payload = makeRawCatalog();
    const firstRecord = payload[0] as Record<string, unknown>;
    delete firstRecord.music_time;
    delete firstRecord.base_score;

    const result = normalizeMusicMetaPayload(payload);

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-schema",
      missingFields: ["music_metas[0].base_score", "music_metas[0].music_time"]
    });
  });

  it("orders invalid field diagnostics deterministically", () => {
    const payload = makeRawCatalog();
    Object.assign(payload[0], {
      music_id: "1",
      difficulty: "unknown",
      event_rate: -1,
      base_score: -1
    });

    const result = normalizeMusicMetaPayload(payload);

    expect(result).toMatchObject({
      status: "unavailable",
      invalidFields: [
        "music_metas[0].base_score",
        "music_metas[0].difficulty",
        "music_metas[0].event_rate",
        "music_metas[0].music_id"
      ]
    });
  });

  it.each([
    ["skill array with fewer than six values", { skill_score_solo: [1, 2, 3, 4, 5] }],
    ["non-finite numeric value", { event_rate: Number.POSITIVE_INFINITY }],
    ["string numeric value", { base_score: "100" }],
    ["invalid difficulty", { difficulty: "unknown" }]
  ])("rejects %s", (_label, override) => {
    const payload = makeRawCatalog();
    Object.assign(payload[0], override);

    const result = normalizeMusicMetaPayload(payload);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reasonCode).toBe("invalid-schema");
    expect(result.invalidFields.length).toBeGreaterThan(0);
  });

  it("rejects a catalog below the audited completeness floor", () => {
    const result = normalizeMusicMetaPayload(makeRawCatalog(MUSIC_META_MINIMUM_RECORD_COUNT - 1));

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "incomplete-data",
      missingFields: ["music_metas records (minimum 3727)"]
    });
  });

  it("rejects conflicting duplicate song-difficulty records as mixed data", () => {
    const payload = makeRawCatalog();
    payload.push(makeRawMusicMeta(1, { base_score: 999 }));
    payload.push(makeRawMusicMeta(2, { base_score: 999 }));
    payload.push(makeRawMusicMeta(3, { base_score: 999 }));

    const result = normalizeMusicMetaPayload(payload);

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "mixed-data",
      invalidFields: [
        "music_metas[3727].music_id/difficulty",
        "music_metas[3728].music_id/difficulty",
        "music_metas[3729].music_id/difficulty"
      ]
    });
  });

  it.each([null, {}, "not-json-array"])("rejects a non-array payload: %s", (payload) => {
    expect(normalizeMusicMetaPayload(payload)).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-schema",
      missingFields: ["music_metas[]"]
    });
  });
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

  it("rejects stale or source-mixed datasets", () => {
    const dataset = makeDataset();
    if (dataset.status !== "available") throw new Error("Expected fixture catalog.");
    const staleDataset: MusicMetaDataset = {
      ...dataset,
      provenance: {
        ...dataset.provenance,
        freshness: { ...dataset.provenance.freshness, status: "stale" }
      }
    };
    const mixedDataset: MusicMetaDataset = {
      ...dataset,
      provenance: { ...dataset.provenance, sourceId: "moesekai" }
    };

    expect(
      calculateJpSoloYield(staleDataset, {
        ...makeInputs(),
        musicId: 5,
        difficulty: "expert"
      })
    ).toMatchObject({ status: "unavailable", reasonCode: "stale-data" });
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
