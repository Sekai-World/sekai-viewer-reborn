import { createHash } from "node:crypto";

/**
 * Contract for the externally supplied `music_metas.json` coefficient input.
 * See docs/viewer-implementation/tools-site-farming-yield-data-contract.md.
 * Validation fails closed: one malformed record invalidates the whole source.
 */

export const MUSIC_META_SOURCES = {
  selfHosted: {
    id: "self-hosted",
    url: "https://storage.sekai.best/sekai-best-assets/music_metas.json"
  },
  moesekai: {
    id: "moesekai",
    url: "https://moe.exmeaning.com/data/music_meta/music_metas.json"
  }
} as const;

export type MusicMetasSourceId = (typeof MUSIC_META_SOURCES)[keyof typeof MUSIC_META_SOURCES]["id"];

export const MUSIC_META_DIFFICULTIES = [
  "easy",
  "normal",
  "hard",
  "expert",
  "master",
  "append"
] as const;

export type MusicMetaDifficulty = (typeof MUSIC_META_DIFFICULTIES)[number];

export const MUSIC_META_SKILL_SLOTS = 6;

/** Coefficients may be refreshed upstream without a version field; stale data fails closed. */
export const MUSIC_METAS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_REPORTED_ISSUES = 20;

type SkillScores = readonly [number, number, number, number, number, number];

/** Raw coefficient fields, in the order used by the revision digest. Units: see the contract doc. */
export type MusicMeta = Readonly<{
  musicId: number;
  difficulty: MusicMetaDifficulty;
  musicTime: number;
  eventRate: number;
  baseScore: number;
  baseScoreAuto: number;
  skillScoreSolo: SkillScores;
  skillScoreAuto: SkillScores;
  skillScoreMulti: SkillScores;
  feverScore: number;
  feverEndTime: number;
  tapCount: number;
}>;

export type MusicMetasIssueCode =
  "not-array" | "empty" | "invalid-record" | "invalid-field" | "duplicate-key";

export type MusicMetasIssue = Readonly<{
  code: MusicMetasIssueCode;
  index?: number;
  field?: string;
}>;

export type MusicMetasParseResult =
  | Readonly<{
      status: "ready";
      records: readonly MusicMeta[];
      /** SHA-256 over the canonical projection; see `computeMusicMetasRevision`. */
      revision: string;
    }>
  | Readonly<{ status: "invalid"; issues: readonly MusicMetasIssue[] }>;

export type MusicMetasFreshness = "fresh" | "stale" | "unknown";

type RawRecord = Readonly<Record<string, unknown>>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;

const isDifficulty = (value: unknown): value is MusicMetaDifficulty =>
  typeof value === "string" && (MUSIC_META_DIFFICULTIES as readonly string[]).includes(value);

const isSkillScores = (value: unknown): value is SkillScores =>
  Array.isArray(value) &&
  value.length === MUSIC_META_SKILL_SLOTS &&
  value.every(isNonNegativeNumber);

const FIELD_CHECKS: ReadonlyArray<readonly [string, (value: unknown) => boolean]> = [
  ["music_id", (value) => Number.isSafeInteger(value) && (value as number) > 0],
  ["difficulty", isDifficulty],
  ["music_time", (value) => isNonNegativeNumber(value) && (value as number) > 0],
  ["event_rate", (value) => Number.isSafeInteger(value) && (value as number) > 0],
  ["base_score", isNonNegativeNumber],
  ["base_score_auto", isNonNegativeNumber],
  ["skill_score_solo", isSkillScores],
  ["skill_score_auto", isSkillScores],
  ["skill_score_multi", isSkillScores],
  ["fever_score", isNonNegativeNumber],
  ["fever_end_time", isNonNegativeNumber],
  ["tap_count", (value) => Number.isSafeInteger(value) && (value as number) >= 0]
];

const toMusicMeta = (record: RawRecord): MusicMeta => ({
  musicId: record.music_id as number,
  difficulty: record.difficulty as MusicMetaDifficulty,
  musicTime: record.music_time as number,
  eventRate: record.event_rate as number,
  baseScore: record.base_score as number,
  baseScoreAuto: record.base_score_auto as number,
  skillScoreSolo: record.skill_score_solo as SkillScores,
  skillScoreAuto: record.skill_score_auto as SkillScores,
  skillScoreMulti: record.skill_score_multi as SkillScores,
  feverScore: record.fever_score as number,
  feverEndTime: record.fever_end_time as number,
  tapCount: record.tap_count as number
});

/**
 * Revision of the score-input fields only: SHA-256 (hex) of `JSON.stringify` over the
 * records projected to the twelve contract fields in contract order, sorted by
 * `music_id` ascending and then `difficulty` string ascending. Derived fields some
 * sources add (score, PT, PSPI, cycles) never affect the revision.
 */
export const computeMusicMetasRevision = (records: readonly MusicMeta[]): string => {
  const rows = [...records]
    .sort(
      (a, b) =>
        a.musicId - b.musicId ||
        (a.difficulty < b.difficulty ? -1 : a.difficulty > b.difficulty ? 1 : 0)
    )
    .map((record) => ({
      music_id: record.musicId,
      difficulty: record.difficulty,
      music_time: record.musicTime,
      event_rate: record.eventRate,
      base_score: record.baseScore,
      base_score_auto: record.baseScoreAuto,
      skill_score_solo: record.skillScoreSolo,
      skill_score_auto: record.skillScoreAuto,
      skill_score_multi: record.skillScoreMulti,
      fever_score: record.feverScore,
      fever_end_time: record.feverEndTime,
      tap_count: record.tapCount
    }));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
};

export const parseMusicMetas = (payload: unknown): MusicMetasParseResult => {
  if (!Array.isArray(payload)) {
    return { status: "invalid", issues: [{ code: "not-array" }] };
  }
  if (payload.length === 0) {
    return { status: "invalid", issues: [{ code: "empty" }] };
  }

  const issues: MusicMetasIssue[] = [];
  const records: MusicMeta[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;

  payload.forEach((entry: unknown, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      invalidCount += 1;
      if (issues.length < MAX_REPORTED_ISSUES) issues.push({ code: "invalid-record", index });
      return;
    }
    const record = entry as RawRecord;
    const badField = FIELD_CHECKS.find(([field, isValid]) => !isValid(record[field]));
    if (badField) {
      invalidCount += 1;
      if (issues.length < MAX_REPORTED_ISSUES) {
        issues.push({ code: "invalid-field", index, field: badField[0] });
      }
      return;
    }
    const key = `${record.music_id as number}:${record.difficulty as string}`;
    if (seen.has(key)) {
      invalidCount += 1;
      if (issues.length < MAX_REPORTED_ISSUES) issues.push({ code: "duplicate-key", index });
      return;
    }
    seen.add(key);
    records.push(toMusicMeta(record));
  });

  if (invalidCount > 0) {
    return { status: "invalid", issues };
  }
  return { status: "ready", records, revision: computeMusicMetasRevision(records) };
};

/**
 * The artifact has no embedded timestamp, so freshness comes from the HTTP
 * `Last-Modified` header. A missing, unparsable, or future value is `unknown`,
 * which callers must treat like `stale` rather than assuming the data is current.
 */
export const assessMusicMetasFreshness = (
  lastModifiedHeader: string | null | undefined,
  now: number,
  maxAgeMs: number = MUSIC_METAS_MAX_AGE_MS
): MusicMetasFreshness => {
  if (!lastModifiedHeader) return "unknown";
  const lastModified = Date.parse(lastModifiedHeader);
  if (!Number.isFinite(lastModified) || lastModified > now) return "unknown";
  return now - lastModified <= maxAgeMs ? "fresh" : "stale";
};
