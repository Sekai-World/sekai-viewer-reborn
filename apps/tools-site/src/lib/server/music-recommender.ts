import { createHash } from "node:crypto";
import { withRequestTimeout } from "$lib/server/network";
import {
  DEFAULT_MUSIC_META_SOURCE_ID,
  JP_SOLO_FORMULA_VERSION,
  MUSIC_META_SOURCES,
  normalizeMusicMetaPayload,
  rankJpSoloRecommendations,
  type MusicMetaDataset,
  type MusicMetaFailureReasonCode,
  type MusicMetaFreshness,
  type MusicMetaProvenance,
  type MusicMetaSource,
  type MusicMetaSourceId,
  type JpSoloYieldInputs
} from "$lib/music-recommender";

// Reject cached representations older than one day and source artifacts older than 90 days.
const MAX_RESPONSE_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_LAST_MODIFIED_AGE_MS = 90 * 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export type MusicMetaFetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type MusicRecommenderMetric = "score" | "eventPoints";

export type MusicRecommenderPageInputs = {
  source: MusicMetaSourceId | null;
  metric: MusicRecommenderMetric;
  mode: string | null;
  deckPower: number | string | null;
  deckBonus: number | string | null;
  boostMultiplier: number | string | null;
  skillRates: Array<number | string> | null;
  noSkill: boolean | null;
};

export type MusicRecommenderResultItem = {
  rank: number;
  musicId: number;
  difficulty: string;
  musicTime: number;
  score: number;
  eventPoints: number;
};

export type MusicRecommenderPageData = {
  status: "available" | "unavailable";
  source: MusicMetaSource | null;
  metric: MusicRecommenderMetric;
  inputs: MusicRecommenderPageInputs;
  items: MusicRecommenderResultItem[];
  formulaVersion: typeof JP_SOLO_FORMULA_VERSION;
  provenance: MusicMetaProvenance | null;
  sourceHash: string | null;
  reasonCode: string | null;
  reason: string | null;
  missingFields: string[];
  invalidFields: string[];
};

type ParsedMusicRecommenderQuery =
  | {
      status: "available";
      source: MusicMetaSource;
      metric: MusicRecommenderMetric;
      inputs: MusicRecommenderPageInputs;
      domainInputs: JpSoloYieldInputs;
    }
  | {
      status: "unavailable";
      source: MusicMetaSource | null;
      metric: MusicRecommenderMetric;
      inputs: MusicRecommenderPageInputs;
      reasonCode: MusicMetaFailureReasonCode | "missing-inputs" | "invalid-inputs";
      reason: string;
      missingFields: string[];
      invalidFields: string[];
    };

const INPUT_PARAMETER_NAMES = [
  "mode",
  "deckPower",
  "deckBonus",
  "boostMultiplier",
  "skillRates",
  "noSkill"
] as const;

const isAsciiDigitAt = (value: string, index: number): boolean => {
  const code = value.charCodeAt(index);
  return code >= 48 && code <= 57;
};

const isDecimalNumberSyntax = (value: string): boolean => {
  let index = 0;
  if (value[index] === "+" || value[index] === "-") index += 1;

  const integerStart = index;
  while (isAsciiDigitAt(value, index)) index += 1;
  const hasIntegerDigits = index > integerStart;

  let hasFractionDigits = false;
  if (value[index] === ".") {
    index += 1;
    const fractionStart = index;
    while (isAsciiDigitAt(value, index)) index += 1;
    hasFractionDigits = index > fractionStart;
  }

  if (!hasIntegerDigits && !hasFractionDigits) return false;

  if (value[index] === "e" || value[index] === "E") {
    index += 1;
    if (value[index] === "+" || value[index] === "-") index += 1;

    const exponentStart = index;
    while (isAsciiDigitAt(value, index)) index += 1;
    if (index === exponentStart) return false;
  }

  return index === value.length;
};

const compareStrings = (left: string, right: string): number => left.localeCompare(right, "en");

const isMusicMetaSourceId = (value: string): value is MusicMetaSourceId =>
  Object.hasOwn(MUSIC_META_SOURCES, value);

const failure = (
  source: MusicMetaSource | null,
  reasonCode: MusicMetaFailureReasonCode,
  reason: string,
  missingFields: readonly string[] = [],
  invalidFields: readonly string[] = []
): MusicMetaDataset => ({
  status: "unavailable",
  source,
  reasonCode,
  reason,
  missingFields: [...missingFields],
  invalidFields: [...invalidFields]
});

const parseFreshness = (
  headers: Headers,
  checkedAt: Date
):
  | { status: "fresh"; freshness: MusicMetaFreshness }
  | {
      status: "unavailable";
      reasonCode: "freshness-metadata-missing" | "invalid-freshness" | "stale-data";
      reason: string;
      missingFields: string[];
      invalidFields: string[];
    } => {
  const responseDateHeader = headers.get("date");
  if (responseDateHeader === null) {
    return {
      status: "unavailable",
      reasonCode: "freshness-metadata-missing",
      reason:
        "The selected source response did not include a Date header for freshness validation.",
      missingFields: ["headers.date"],
      invalidFields: []
    };
  }

  const responseDate = new Date(responseDateHeader);
  if (!Number.isFinite(responseDate.getTime())) {
    return {
      status: "unavailable",
      reasonCode: "invalid-freshness",
      reason: "The selected source returned an invalid Date header.",
      missingFields: [],
      invalidFields: ["headers.date"]
    };
  }

  const nowMs = checkedAt.getTime();
  const responseDateMs = responseDate.getTime();
  if (responseDateMs > nowMs + MAX_CLOCK_SKEW_MS) {
    return {
      status: "unavailable",
      reasonCode: "invalid-freshness",
      reason: "The selected source Date header is unexpectedly in the future.",
      missingFields: [],
      invalidFields: ["headers.date"]
    };
  }

  const ageHeader = headers.get("age");
  const ageSeconds =
    ageHeader === null ? 0 : /^\d+$/.test(ageHeader.trim()) ? Number(ageHeader) : Number.NaN;
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) {
    return {
      status: "unavailable",
      reasonCode: "invalid-freshness",
      reason: "The selected source returned an invalid Age header.",
      missingFields: [],
      invalidFields: ["headers.age"]
    };
  }

  const responseAgeMs = Math.max(0, nowMs - responseDateMs) + ageSeconds * 1_000;
  const warningHeader = headers.get("warning") ?? "";
  if (responseAgeMs > MAX_RESPONSE_AGE_MS || /\b(?:110|113)\b/.test(warningHeader)) {
    return {
      status: "unavailable",
      reasonCode: "stale-data",
      reason: "The selected source response is older than the allowed freshness window.",
      missingFields: [],
      invalidFields: []
    };
  }

  const lastModifiedHeader = headers.get("last-modified");
  let lastModifiedAt: string | null = null;
  if (lastModifiedHeader !== null) {
    const lastModified = new Date(lastModifiedHeader);
    const lastModifiedMs = lastModified.getTime();
    if (!Number.isFinite(lastModifiedMs) || lastModifiedMs > nowMs + MAX_CLOCK_SKEW_MS) {
      return {
        status: "unavailable",
        reasonCode: "invalid-freshness",
        reason: "The selected source returned an invalid Last-Modified header.",
        missingFields: [],
        invalidFields: ["headers.last-modified"]
      };
    }

    if (nowMs - lastModifiedMs > MAX_LAST_MODIFIED_AGE_MS) {
      return {
        status: "unavailable",
        reasonCode: "stale-data",
        reason:
          "The selected source content has not been modified within the allowed freshness window.",
        missingFields: [],
        invalidFields: []
      };
    }
    lastModifiedAt = lastModified.toISOString();
  }

  return {
    status: "fresh",
    freshness: {
      status: "fresh",
      checkedAt: checkedAt.toISOString(),
      responseDate: responseDate.toISOString(),
      responseAgeMs,
      lastModifiedAt
    }
  };
};

const hashMusicMetaRecords = (
  items: Extract<MusicMetaDataset, { status: "available" }>["items"]
): `sha256:${string}` => {
  const canonicalRecords = items.map((item) => ({
    music_id: item.musicId,
    difficulty: item.difficulty,
    music_time: item.musicTime,
    event_rate: item.eventRate,
    base_score: item.baseScore,
    skill_score_solo: item.skillScoreSolo
  }));
  const digest = createHash("sha256").update(JSON.stringify(canonicalRecords)).digest("hex");
  return `sha256:${digest}`;
};

/** Fetches only the selected allow-listed source; an absent selection uses the documented default. */
export const loadMusicMetaCatalog = async (
  requestedSource: string | null,
  fetcher: MusicMetaFetcher,
  now: () => Date = () => new Date()
): Promise<MusicMetaDataset> => {
  const sourceId =
    requestedSource === null
      ? DEFAULT_MUSIC_META_SOURCE_ID
      : isMusicMetaSourceId(requestedSource)
        ? requestedSource
        : null;

  if (sourceId === null) {
    return failure(null, "invalid-source", "The requested music metadata source is not supported.");
  }

  const source = MUSIC_META_SOURCES[sourceId];
  let response: Response;
  try {
    response = await withRequestTimeout((signal) =>
      fetcher(source.url, {
        signal,
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" }
      })
    );
  } catch {
    return failure(
      source,
      "fetch-failed",
      "The selected music metadata source could not be fetched."
    );
  }

  if (!response.ok) {
    return failure(
      source,
      "http-error",
      `The selected music metadata source returned HTTP ${response.status}.`
    );
  }

  const checkedAt = now();
  const freshness = parseFreshness(response.headers, checkedAt);
  if (freshness.status === "unavailable") {
    return failure(
      source,
      freshness.reasonCode,
      freshness.reason,
      freshness.missingFields,
      freshness.invalidFields
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure(source, "invalid-json", "The selected source did not return valid JSON.");
  }

  const normalized = normalizeMusicMetaPayload(payload);
  if (normalized.status === "unavailable") {
    return {
      status: "unavailable",
      source,
      reasonCode: normalized.reasonCode,
      reason: normalized.reason,
      missingFields: normalized.missingFields,
      invalidFields: normalized.invalidFields
    };
  }

  const fetchedAt = checkedAt.toISOString();
  return {
    status: "available",
    source,
    items: normalized.items,
    provenance: {
      sourceId,
      sourceUrl: source.url,
      contentHash: hashMusicMetaRecords(normalized.items),
      recordCount: normalized.items.length,
      fetchedAt,
      freshness: freshness.freshness
    }
  };
};

const getSingleParameter = (
  searchParams: URLSearchParams,
  key: string,
  invalidFields: Set<string>
): string | null => {
  const values = searchParams.getAll(key);
  if (values.length > 1) invalidFields.add(key);
  return values[0] ?? null;
};

const parseFiniteQueryNumber = (
  value: string | null,
  field: string,
  missingFields: Set<string>,
  invalidFields: Set<string>,
  isValid: (candidate: number) => boolean
): number | null => {
  if (value === null) {
    missingFields.add(field);
    return null;
  }

  const normalized = value.trim();
  const parsed = isDecimalNumberSyntax(normalized) ? Number(normalized) : Number.NaN;
  if (!Number.isFinite(parsed) || !isValid(parsed)) {
    invalidFields.add(field);
    return null;
  }
  return parsed;
};

const makeDefaultPageInputs = (
  source: MusicMetaSourceId | null,
  metric: MusicRecommenderMetric
): MusicRecommenderPageInputs => ({
  source,
  metric,
  mode: "jp-solo",
  deckPower: null,
  deckBonus: 0,
  boostMultiplier: 1,
  skillRates: Array.from({ length: 6 }, () => 0),
  noSkill: false
});

/** Parses the route's query controls without substituting values for malformed input. */
export const parseMusicRecommenderQuery = (
  searchParams: URLSearchParams
): ParsedMusicRecommenderQuery => {
  const missingFields = new Set<string>();
  const invalidFields = new Set<string>();

  const sourceValues = searchParams.getAll("source");
  const requestedSource = sourceValues[0] ?? null;
  if (sourceValues.length > 1) invalidFields.add("source");
  const sourceId =
    sourceValues.length === 0
      ? DEFAULT_MUSIC_META_SOURCE_ID
      : sourceValues.length === 1 &&
          requestedSource !== null &&
          isMusicMetaSourceId(requestedSource)
        ? requestedSource
        : null;
  const source = sourceId === null ? null : MUSIC_META_SOURCES[sourceId];

  const metricValue = getSingleParameter(searchParams, "metric", invalidFields);
  const metric: MusicRecommenderMetric = metricValue === "eventPoints" ? "eventPoints" : "score";
  if (metricValue !== null && metricValue !== "score" && metricValue !== "eventPoints") {
    invalidFields.add("metric");
  }

  const queryValues = Object.fromEntries(
    INPUT_PARAMETER_NAMES.map((key) => [key, getSingleParameter(searchParams, key, invalidFields)])
  ) as Record<(typeof INPUT_PARAMETER_NAMES)[number], string | null>;
  const hasCalculationQuery = INPUT_PARAMETER_NAMES.some((key) => searchParams.has(key));

  if (!hasCalculationQuery) {
    const inputs = makeDefaultPageInputs(sourceId, metric);
    if (source === null || invalidFields.size > 0) {
      return {
        status: "unavailable",
        source,
        metric,
        inputs,
        reasonCode: source === null ? "invalid-source" : "invalid-inputs",
        reason:
          source === null
            ? "The requested music metadata source is not supported."
            : "One or more recommender query parameters are invalid.",
        missingFields: [...missingFields].sort(compareStrings),
        invalidFields: [...invalidFields].sort(compareStrings)
      };
    }
    return {
      status: "unavailable",
      source,
      metric,
      inputs,
      reasonCode: "missing-inputs",
      reason: "A raw JP Solo deck power total is required for this calculation.",
      missingFields: ["deckPower"],
      invalidFields: []
    };
  }

  const modeValue = queryValues.mode;
  const deckPowerValue = queryValues.deckPower;
  const deckBonusValue = queryValues.deckBonus;
  const boostMultiplierValue = queryValues.boostMultiplier;
  const skillRatesValue = queryValues.skillRates;
  const noSkillValue = queryValues.noSkill;
  let normalizedMode: string | null = null;
  if (modeValue === null) {
    missingFields.add("mode");
  } else if (modeValue.trim() === "") {
    invalidFields.add("mode");
  } else {
    normalizedMode = modeValue === "jp-solo" ? "solo" : modeValue;
  }

  const deckPower = parseFiniteQueryNumber(
    deckPowerValue,
    "deckPower",
    missingFields,
    invalidFields,
    (value) => Number.isSafeInteger(value) && value > 0
  );
  const deckBonus = parseFiniteQueryNumber(
    deckBonusValue,
    "deckBonus",
    missingFields,
    invalidFields,
    (value) => value >= 0
  );
  const boostMultiplier = parseFiniteQueryNumber(
    boostMultiplierValue,
    "boostMultiplier",
    missingFields,
    invalidFields,
    (value) => Number.isSafeInteger(value) && value > 0
  );

  let noSkill: boolean | null = null;
  if (noSkillValue === null) {
    missingFields.add("noSkill");
  } else if (noSkillValue === "true") {
    noSkill = true;
  } else if (noSkillValue === "false") {
    noSkill = false;
  } else {
    invalidFields.add("noSkill");
  }

  let skillRates: number[] | null = null;
  if (skillRatesValue === null) {
    missingFields.add("skillRates");
  } else if (noSkill === true && skillRatesValue.trim() === "") {
    skillRates = Array.from({ length: 6 }, () => 0);
  } else {
    const values = skillRatesValue.split(",");
    if (values.length !== 6) {
      invalidFields.add("skillRates");
    } else {
      const parsedRates: number[] = [];
      values.forEach((value, index) => {
        const normalized = value.trim();
        const parsed = isDecimalNumberSyntax(normalized) ? Number(normalized) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 0) {
          invalidFields.add(`skillRates[${index}]`);
        } else {
          parsedRates.push(parsed);
        }
      });
      if (parsedRates.length === 6) {
        if (noSkill === true && parsedRates.some((rate) => rate !== 0)) {
          invalidFields.add("skillRates");
        } else {
          skillRates = parsedRates;
        }
      }
    }
  }

  const pageInputs: MusicRecommenderPageInputs = {
    source: sourceId,
    metric,
    mode: modeValue,
    deckPower: deckPower ?? deckPowerValue,
    deckBonus: deckBonus ?? deckBonusValue,
    boostMultiplier: boostMultiplier ?? boostMultiplierValue,
    skillRates: skillRates ?? skillRatesValue?.split(",") ?? null,
    noSkill
  };

  if (sourceId === null) invalidFields.add("source");
  if (missingFields.size > 0 || invalidFields.size > 0) {
    const isInvalid = invalidFields.size > 0;
    const reasonCode =
      sourceId === null ? "invalid-source" : isInvalid ? "invalid-inputs" : "missing-inputs";
    return {
      status: "unavailable",
      source,
      metric,
      inputs: pageInputs,
      reasonCode,
      reason:
        reasonCode === "invalid-source"
          ? "The requested music metadata source is not supported."
          : isInvalid
            ? "One or more recommender query parameters are invalid."
            : "One or more required recommender query parameters are missing.",
      missingFields: [...missingFields].sort(compareStrings),
      invalidFields: [...invalidFields].sort(compareStrings)
    };
  }

  return {
    status: "available",
    source: source as MusicMetaSource,
    metric,
    inputs: pageInputs,
    domainInputs: {
      region: "jp",
      mode: normalizedMode,
      deckPower,
      deckBonus,
      boostMultiplier,
      cardLength: 6,
      skillAllocation: { strategy: "default", skillEffects: skillRates }
    }
  };
};

const makeUnavailablePageData = (
  source: MusicMetaSource | null,
  metric: MusicRecommenderMetric,
  inputs: MusicRecommenderPageInputs,
  reasonCode: string,
  reason: string,
  missingFields: readonly string[] = [],
  invalidFields: readonly string[] = [],
  provenance: MusicMetaProvenance | null = null
): MusicRecommenderPageData => ({
  status: "unavailable",
  source,
  metric,
  inputs,
  items: [],
  formulaVersion: JP_SOLO_FORMULA_VERSION,
  provenance,
  sourceHash: provenance?.contentHash ?? null,
  reasonCode,
  reason,
  missingFields: [...missingFields],
  invalidFields: [...invalidFields]
});

/** Builds the serializable page contract; only ranked results leave the server. */
export const loadMusicRecommenderPageData = async (
  searchParams: URLSearchParams,
  fetcher: MusicMetaFetcher,
  now: () => Date = () => new Date()
): Promise<MusicRecommenderPageData> => {
  const parsedQuery = parseMusicRecommenderQuery(searchParams);
  if (parsedQuery.status === "unavailable") {
    return makeUnavailablePageData(
      parsedQuery.source,
      parsedQuery.metric,
      parsedQuery.inputs,
      parsedQuery.reasonCode,
      parsedQuery.reason,
      parsedQuery.missingFields,
      parsedQuery.invalidFields
    );
  }

  const dataset = await loadMusicMetaCatalog(parsedQuery.source.id, fetcher, now);
  if (dataset.status === "unavailable") {
    return makeUnavailablePageData(
      dataset.source ?? parsedQuery.source,
      parsedQuery.metric,
      parsedQuery.inputs,
      dataset.reasonCode,
      dataset.reason,
      dataset.missingFields,
      dataset.invalidFields
    );
  }

  const ranking = rankJpSoloRecommendations(dataset, parsedQuery.domainInputs, parsedQuery.metric);
  if (ranking.status === "unavailable") {
    return makeUnavailablePageData(
      dataset.source,
      parsedQuery.metric,
      parsedQuery.inputs,
      ranking.reasonCode,
      ranking.reason,
      ranking.missingFields,
      ranking.invalidFields,
      ranking.provenance
    );
  }

  return {
    status: "available",
    source: dataset.source,
    metric: parsedQuery.metric,
    inputs: parsedQuery.inputs,
    items: ranking.items.map(({ rank, music, score, eventPoints }) => ({
      rank,
      musicId: music.musicId,
      difficulty: music.difficulty,
      musicTime: music.musicTime,
      score,
      eventPoints
    })),
    formulaVersion: ranking.formulaVersion,
    provenance: ranking.provenance,
    sourceHash: ranking.provenance.contentHash,
    reasonCode: null,
    reason: null,
    missingFields: [],
    invalidFields: []
  };
};
