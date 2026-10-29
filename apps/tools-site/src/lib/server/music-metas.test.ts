import { describe, expect, it } from "vitest";
import {
  MUSIC_METAS_MAX_AGE_MS,
  assessMusicMetasFreshness,
  computeMusicMetasRevision,
  parseMusicMetas
} from "./music-metas";

// Real row from the 2026-10-29 audit (music 1, master) so V0 uses published coefficients.
const music1Master = {
  music_id: 1,
  difficulty: "master",
  music_time: 123.2,
  event_rate: 114,
  base_score: 1.1599442522953187,
  base_score_auto: 0.7735,
  skill_score_solo: [
    0.03796830587347502, 0.03652851213683813, 0.05339327757514775, 0.04202641177210418,
    0.0637942585838259, 0.05121274053578169
  ],
  skill_score_auto: [
    0.026461074078732237, 0.02509910703056219, 0.036286693497673245, 0.028017607848069427,
    0.04173456169035342, 0.032589925795497424
  ],
  skill_score_multi: [
    0.03796830587347502, 0.03652851213683813, 0.05339327757514775, 0.04202641177210418,
    0.0956913878757389, 0.05121274053578169
  ],
  fever_score: 0.2,
  fever_end_time: 100,
  tap_count: 900
};

const record = (overrides: Record<string, unknown> = {}) => ({ ...music1Master, ...overrides });

const parseReady = (payload: unknown) => {
  const result = parseMusicMetas(payload);
  if (result.status !== "ready") throw new Error(`expected ready, got ${JSON.stringify(result)}`);
  return result;
};

describe("parseMusicMetas", () => {
  it("maps records and ignores derived fields from external sources", () => {
    const plain = parseReady([record()]);
    const withDerived = parseReady([
      record({ solo_score: 1, solo_pt_max: 2, pspi_solo_score: 3.5, cycles_auto: 4 })
    ]);

    expect(plain.records[0]).toMatchObject({
      musicId: 1,
      difficulty: "master",
      eventRate: 114,
      baseScore: music1Master.base_score,
      skillScoreSolo: music1Master.skill_score_solo
    });
    expect(Object.keys(withDerived.records[0] ?? {})).toEqual(Object.keys(plain.records[0] ?? {}));
    expect(withDerived.revision).toBe(plain.revision);
  });

  it.each([
    ["a non-array payload", { records: [] }, "not-array"],
    ["an empty array", [], "empty"]
  ])("fails closed for %s", (_label, payload, code) => {
    expect(parseMusicMetas(payload)).toEqual({ status: "invalid", issues: [{ code }] });
  });

  it.each([
    ["music_id", { music_id: "1" }],
    ["difficulty", { difficulty: "extreme" }],
    ["music_time", { music_time: 0 }],
    ["event_rate", { event_rate: 114.5 }],
    ["base_score", { base_score: null }],
    ["base_score_auto", { base_score_auto: Number.NaN }],
    ["skill_score_solo", { skill_score_solo: music1Master.skill_score_solo.slice(0, 5) }],
    ["skill_score_auto", { skill_score_auto: [...music1Master.skill_score_auto, 0] }],
    ["skill_score_multi", { skill_score_multi: ["a", 0, 0, 0, 0, 0] }],
    ["fever_score", { fever_score: -1 }],
    ["fever_end_time", { fever_end_time: undefined }],
    ["tap_count", { tap_count: 1.5 }]
  ])("rejects the whole source when %s is invalid", (field, overrides) => {
    const result = parseMusicMetas([record({ music_id: 2 }), record(overrides)]);

    expect(result).toEqual({
      status: "invalid",
      issues: [{ code: "invalid-field", index: 1, field }]
    });
  });

  it("rejects non-object records and duplicate song/difficulty keys", () => {
    expect(parseMusicMetas([record(), null, []])).toEqual({
      status: "invalid",
      issues: [
        { code: "invalid-record", index: 1 },
        { code: "invalid-record", index: 2 }
      ]
    });
    expect(parseMusicMetas([record(), record()])).toEqual({
      status: "invalid",
      issues: [{ code: "duplicate-key", index: 1 }]
    });
  });

  it("bounds the number of reported issues", () => {
    const result = parseMusicMetas(Array.from({ length: 50 }, () => null));

    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.issues).toHaveLength(20);
  });
});

describe("computeMusicMetasRevision", () => {
  it("is independent of source order and input object key order", () => {
    const a = record({ music_id: 1, difficulty: "easy" });
    const b = record({ music_id: 1, difficulty: "master" });
    const c = record({ music_id: 2, difficulty: "append" });
    const reordered = Object.fromEntries(Object.entries(b).reverse());

    expect(parseReady([c, a, b]).revision).toBe(parseReady([a, reordered, c]).revision);
  });

  it("changes when any coefficient changes", () => {
    const baseline = parseReady([record()]).revision;

    expect(parseReady([record({ event_rate: 115 })]).revision).not.toBe(baseline);
    expect(
      parseReady([record({ skill_score_solo: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] })]).revision
    ).not.toBe(baseline);
  });

  it("is a SHA-256 hex digest", () => {
    expect(computeMusicMetasRevision(parseReady([record()]).records)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("assessMusicMetasFreshness", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");

  it("is fresh within the maximum age, inclusive", () => {
    expect(assessMusicMetasFreshness("Sun, 25 Oct 2026 12:17:42 GMT", now)).toBe("fresh");
    expect(
      assessMusicMetasFreshness(new Date(now - MUSIC_METAS_MAX_AGE_MS).toUTCString(), now)
    ).toBe("fresh");
  });

  it("is stale beyond the maximum age", () => {
    expect(
      assessMusicMetasFreshness(new Date(now - MUSIC_METAS_MAX_AGE_MS - 1000).toUTCString(), now)
    ).toBe("stale");
    expect(assessMusicMetasFreshness("Sun, 25 Oct 2026 12:00:00 GMT", now, 1000)).toBe("stale");
  });

  it.each([null, undefined, "", "not a date", "Fri, 30 Oct 2026 12:00:00 GMT"])(
    "is unknown for a missing, unparsable, or future header (%o)",
    (header) => {
      expect(assessMusicMetasFreshness(header, now)).toBe("unknown");
    }
  );
});

describe("JP Solo vector V0 (formula jp-solo-community-v1)", () => {
  // Synthetic manual deck inputs; the formulas are the approved JP Solo community
  // references in docs/viewer-implementation/tools-site-yield-validation.md.
  const deckPower = 300000;
  const effectiveSkillRates = [140, 130, 120, 110, 100, 90]; // percent, explicit sequence
  const deckBonus = 200; // percent

  const meta = parseReady([music1Master]).records[0];
  if (!meta) throw new Error("V0 row missing");

  const score = Math.floor(
    (meta.baseScore +
      meta.skillScoreSolo.reduce(
        (sum, value, index) => sum + (value * (effectiveSkillRates[index] ?? 0)) / 100,
        0
      )) *
      deckPower *
      4
  );
  const eventPoints = (boost: number) =>
    Math.floor((100 + Math.floor(score / 20000)) * (meta.eventRate / 100) * (1 + deckBonus / 100)) *
    boost;

  it("reproduces the documented score and event points", () => {
    expect(score).toBe(1776928);
    expect(eventPoints(1)).toBe(642);
  });

  it("floors event points before applying the boost multiplier", () => {
    expect(eventPoints(5)).toBe(3210);
    expect(eventPoints(5)).not.toBe(Math.floor(642.96 * 5));
  });
});
