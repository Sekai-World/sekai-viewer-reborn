import {
  computeMusicMetasRevision,
  parseMusicMetas,
  type MusicMetasIssue
} from "#lib/server/music-metas.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { withRequestTimeout } from "#lib/server/network.js";
import { findLiveBonusPerLive, livesWithinLiveBonus } from "#lib/plan-live-bonus.js";
import {
  loadRegionBoosts,
  type RegionBoostLoader,
  type RegionBoosts
} from "#lib/server/region-boosts.js";
import {
  loadRegionCharts,
  type RegionChartLoader,
  type RegionCharts
} from "#lib/server/region-charts.js";
import {
  parseTargetPlanQuery,
  type ParsedPlanQuery,
  type PlanFormInputs
} from "#lib/target-plan-query.js";
import {
  planTarget,
  type PlanUnavailable,
  type PlanUnavailableReason,
  type PlannerYield,
  type TargetPlan
} from "#lib/target-planner.js";
import {
  DEFAULT_MUSIC_META_SOURCE_ID,
  DEFAULT_YIELD_REGION,
  isYieldMode,
  isYieldRegion,
  formulaVersionForMode,
  JP_SOLO_FORMULA_VERSION,
  MUSIC_META_MINIMUM_RECORD_COUNT,
  MUSIC_META_SOURCES,
  rankJpSoloRecommendations,
  type MusicMetaDataset,
  type MusicMetaFailureReasonCode,
  type MusicMetaProvenance,
  type MusicMetaSource,
  type MusicMetaSourceId,
  type JpSoloRankingItem,
  type JpSoloYieldInputs,
  type YieldFormulaVersion,
  type YieldRegion
} from "#lib/music-recommender.js";

export type MusicMetaFetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type MusicRecommenderMetric = "score" | "eventPoints";

export type MusicRecommenderPageInputs = {
  source: MusicMetaSourceId | null;
  region: YieldRegion | null;
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

/**
 * The live bonus a plan consumes. Every live uses the boost entered with the deck, so the total
 * is the lives times that boost's cost. `not-in-table` is a multiplier the boost table does not
 * list; `unavailable` is a table that could not be read.
 */
export type PlanLiveBonus =
  | { status: "available"; perLive: number; total: number; limit: number | null }
  | { status: "not-in-table" }
  | { status: "unavailable" };

export type MusicRecommenderPlanUnavailableReason =
  | PlanUnavailableReason
  | "yields-unavailable"
  | "live-bonus-unavailable"
  | "boost-not-in-table"
  | "live-bonus-limit";

/** The target-plan panel's state; a plan is only attempted when its controls are in the URL. */
export type MusicRecommenderPlanData =
  | { status: "idle"; inputs: PlanFormInputs }
  | {
      status: "invalid";
      inputs: PlanFormInputs;
      missingFields: string[];
      invalidFields: string[];
    }
  | {
      status: "unavailable";
      inputs: PlanFormInputs;
      reason: MusicRecommenderPlanUnavailableReason;
      invalidFields: string[];
      bound: PlanUnavailable["bound"];
    }
  | { status: "ready"; inputs: PlanFormInputs; plan: TargetPlan; liveBonus: PlanLiveBonus };

export type MusicRecommenderPageData = {
  status: "available" | "unavailable";
  source: MusicMetaSource | null;
  metric: MusicRecommenderMetric;
  inputs: MusicRecommenderPageInputs;
  items: MusicRecommenderResultItem[];
  formulaVersion: YieldFormulaVersion;
  provenance: MusicMetaProvenance | null;
  sourceHash: string | null;
  reasonCode: string | null;
  reason: string | null;
  missingFields: string[];
  invalidFields: string[];
  plan: MusicRecommenderPlanData;
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
  const code = value.codePointAt(index);
  return code !== undefined && code >= 48 && code <= 57;
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

/** Last-Modified is shown with results only; a missing or unreadable value never blocks them. */
const parseLastModified = (headers: Headers): string | null => {
  const value = headers.get("last-modified");
  if (value === null) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const describeIssue = ({ code, index, field }: MusicMetasIssue): string => {
  if (code === "not-array") return "music_metas[]";
  if (index === undefined) return "music_metas";
  if (code === "duplicate-key") return `music_metas[${index}].music_id/difficulty`;
  return field === undefined ? `music_metas[${index}]` : `music_metas[${index}].${field}`;
};

/** An absent selection uses the documented default; anything unlisted is rejected. */
const resolveRequestedSource = (requested: string | null): MusicMetaSourceId | null => {
  if (requested === null) return DEFAULT_MUSIC_META_SOURCE_ID;
  return isMusicMetaSourceId(requested) ? requested : null;
};

/** Fetches only the selected allow-listed source; an absent selection uses the documented default. */
export const loadMusicMetaCatalog = async (
  requestedSource: string | null,
  fetcher: MusicMetaFetcher,
  now: () => Date = () => new Date()
): Promise<MusicMetaDataset> => {
  const sourceId = resolveRequestedSource(requestedSource);

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
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure(source, "invalid-json", "The selected source did not return valid JSON.");
  }

  const parsed = parseMusicMetas(payload);
  if (parsed.status === "invalid") {
    const [first] = parsed.issues;
    if (first?.code === "empty") {
      return failure(
        source,
        "incomplete-data",
        `The selected source contains no records; at least ${MUSIC_META_MINIMUM_RECORD_COUNT} are required for a complete catalog.`,
        [`music_metas records (minimum ${MUSIC_META_MINIMUM_RECORD_COUNT})`]
      );
    }
    const fields = [...new Set(parsed.issues.map(describeIssue))].sort(compareStrings);
    return first?.code === "not-array"
      ? failure(
          source,
          "invalid-schema",
          "The selected source must contain a JSON array of music metadata records.",
          fields
        )
      : failure(
          source,
          "invalid-schema",
          "One or more music metadata records are missing required fields or contain invalid values.",
          [],
          fields
        );
  }

  if (parsed.records.length < MUSIC_META_MINIMUM_RECORD_COUNT) {
    return failure(
      source,
      "incomplete-data",
      `The selected source contains ${parsed.records.length} records; at least ${MUSIC_META_MINIMUM_RECORD_COUNT} are required for a complete catalog.`,
      [`music_metas records (minimum ${MUSIC_META_MINIMUM_RECORD_COUNT})`]
    );
  }

  return {
    status: "available",
    source,
    items: [...parsed.records],
    provenance: {
      sourceId,
      sourceUrl: source.url,
      contentHash: `sha256:${computeMusicMetasRevision(parsed.records)}`,
      recordCount: parsed.records.length,
      fetchedAt: checkedAt.toISOString(),
      lastModifiedAt: parseLastModified(response.headers)
    }
  };
};

const SKILL_SLOT_COUNT = 6;
const zeroSkillRates = (): number[] => Array.from({ length: SKILL_SLOT_COUNT }, () => 0);

const parseDecimalText = (value: string): number => {
  const normalized = value.trim();
  return isDecimalNumberSyntax(normalized) ? Number(normalized) : Number.NaN;
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

  const parsed = parseDecimalText(value);
  if (!Number.isFinite(parsed) || !isValid(parsed)) {
    invalidFields.add(field);
    return null;
  }
  return parsed;
};

const makeDefaultPageInputs = (
  source: MusicMetaSourceId | null,
  region: YieldRegion | null,
  metric: MusicRecommenderMetric
): MusicRecommenderPageInputs => ({
  source,
  region,
  metric,
  mode: "jp-solo",
  deckPower: null,
  deckBonus: 0,
  boostMultiplier: 1,
  skillRates: zeroSkillRates(),
  noSkill: false
});

type QueryIssues = { missingFields: Set<string>; invalidFields: Set<string> };
type UnavailableQuery = Extract<ParsedMusicRecommenderQuery, { status: "unavailable" }>;

const readQuerySourceId = (sourceValues: readonly string[]): MusicMetaSourceId | null => {
  if (sourceValues.length === 0) return DEFAULT_MUSIC_META_SOURCE_ID;
  const [requested] = sourceValues;
  return sourceValues.length === 1 ? resolveRequestedSource(requested) : null;
};

/** No region means JP; a repeated or unknown value is reported, never replaced. */
const readQueryRegion = (
  searchParams: URLSearchParams,
  invalidFields: Set<string>
): YieldRegion | null => {
  const values = searchParams.getAll("region");
  if (values.length === 0) return DEFAULT_YIELD_REGION;
  if (values.length === 1 && isYieldRegion(values[0])) return values[0];
  invalidFields.add("region");
  return null;
};

const readQueryMetric = (
  searchParams: URLSearchParams,
  invalidFields: Set<string>
): MusicRecommenderMetric => {
  const metricValue = getSingleParameter(searchParams, "metric", invalidFields);
  if (metricValue !== null && metricValue !== "score" && metricValue !== "eventPoints") {
    invalidFields.add("metric");
  }
  return metricValue === "eventPoints" ? "eventPoints" : "score";
};

/** The formula named by the requested mode; an unsupported mode shows the Solo one with no figures. */
const formulaVersionForRequestedMode = (mode: string | null): YieldFormulaVersion => {
  const normalized = mode === "jp-solo" ? "solo" : mode;
  return isYieldMode(normalized) ? formulaVersionForMode(normalized) : JP_SOLO_FORMULA_VERSION;
};

/** Returns the calculation mode name, or null with the problem recorded. */
const readQueryMode = (modeValue: string | null, issues: QueryIssues): string | null => {
  if (modeValue === null) {
    issues.missingFields.add("mode");
    return null;
  }
  if (modeValue.trim() === "") {
    issues.invalidFields.add("mode");
    return null;
  }
  return modeValue === "jp-solo" ? "solo" : modeValue;
};

const readQueryNoSkill = (noSkillValue: string | null, issues: QueryIssues): boolean | null => {
  if (noSkillValue === null) {
    issues.missingFields.add("noSkill");
    return null;
  }
  if (noSkillValue === "true") return true;
  if (noSkillValue === "false") return false;
  issues.invalidFields.add("noSkill");
  return null;
};

const readSkillRate = (entry: string, index: number, invalidFields: Set<string>): number | null => {
  const parsed = parseDecimalText(entry);
  if (!Number.isFinite(parsed) || parsed < 0) {
    invalidFields.add(`skillRates[${index}]`);
    return null;
  }
  return parsed;
};

const readQuerySkillRates = (
  skillRatesValue: string | null,
  noSkill: boolean | null,
  issues: QueryIssues
): number[] | null => {
  if (skillRatesValue === null) {
    issues.missingFields.add("skillRates");
    return null;
  }
  if (noSkill === true && skillRatesValue.trim() === "") return zeroSkillRates();

  const values = skillRatesValue.split(",");
  if (values.length !== SKILL_SLOT_COUNT) {
    issues.invalidFields.add("skillRates");
    return null;
  }

  const rates = values.map((entry, index) => readSkillRate(entry, index, issues.invalidFields));
  if (rates.includes(null)) return null;
  const parsedRates = rates as number[];
  if (noSkill === true && parsedRates.some((rate) => rate !== 0)) {
    issues.invalidFields.add("skillRates");
    return null;
  }
  return parsedRates;
};

const classifyQueryFailure = (
  sourceId: MusicMetaSourceId | null,
  hasInvalidFields: boolean
): Pick<UnavailableQuery, "reasonCode" | "reason"> => {
  if (sourceId === null) {
    return {
      reasonCode: "invalid-source",
      reason: "The requested music metadata source is not supported."
    };
  }
  if (hasInvalidFields) {
    return {
      reasonCode: "invalid-inputs",
      reason: "One or more recommender query parameters are invalid."
    };
  }
  return {
    reasonCode: "missing-inputs",
    reason: "One or more required recommender query parameters are missing."
  };
};

const makeUnavailableQuery = (
  source: MusicMetaSource | null,
  metric: MusicRecommenderMetric,
  inputs: MusicRecommenderPageInputs,
  failureDetails: Pick<UnavailableQuery, "reasonCode" | "reason">,
  issues: QueryIssues
): UnavailableQuery => ({
  status: "unavailable",
  source,
  metric,
  inputs,
  ...failureDetails,
  missingFields: [...issues.missingFields].sort(compareStrings),
  invalidFields: [...issues.invalidFields].sort(compareStrings)
});

/** Handles a request with no calculation controls: invalid input is reported, otherwise deck power is requested. */
const rejectQueryWithoutCalculation = (
  sourceId: MusicMetaSourceId | null,
  region: YieldRegion | null,
  metric: MusicRecommenderMetric,
  issues: QueryIssues
): UnavailableQuery => {
  const source = sourceId === null ? null : MUSIC_META_SOURCES[sourceId];
  const inputs = makeDefaultPageInputs(sourceId, region, metric);
  if (source === null || issues.invalidFields.size > 0) {
    return makeUnavailableQuery(
      source,
      metric,
      inputs,
      classifyQueryFailure(sourceId, issues.invalidFields.size > 0),
      issues
    );
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
};

/** Keeps the parsed value when valid, otherwise echoes the raw text so the form can show it. */
const buildPageInputs = (
  sourceId: MusicMetaSourceId | null,
  region: YieldRegion | null,
  metric: MusicRecommenderMetric,
  raw: Record<(typeof INPUT_PARAMETER_NAMES)[number], string | null>,
  parsed: {
    deckPower: number | null;
    deckBonus: number | null;
    boostMultiplier: number | null;
    skillRates: number[] | null;
    noSkill: boolean | null;
  }
): MusicRecommenderPageInputs => ({
  source: sourceId,
  region,
  metric,
  mode: raw.mode,
  deckPower: parsed.deckPower ?? raw.deckPower,
  deckBonus: parsed.deckBonus ?? raw.deckBonus,
  boostMultiplier: parsed.boostMultiplier ?? raw.boostMultiplier,
  skillRates: parsed.skillRates ?? raw.skillRates?.split(",") ?? null,
  noSkill: parsed.noSkill
});

/** Parses the route's query controls without substituting values for malformed input. */
export const parseMusicRecommenderQuery = (
  searchParams: URLSearchParams
): ParsedMusicRecommenderQuery => {
  const issues: QueryIssues = { missingFields: new Set(), invalidFields: new Set() };
  const { missingFields, invalidFields } = issues;

  const sourceValues = searchParams.getAll("source");
  if (sourceValues.length > 1) invalidFields.add("source");
  const sourceId = readQuerySourceId(sourceValues);
  const source = sourceId === null ? null : MUSIC_META_SOURCES[sourceId];
  const region = readQueryRegion(searchParams, invalidFields);
  const metric = readQueryMetric(searchParams, invalidFields);

  const queryValues = Object.fromEntries(
    INPUT_PARAMETER_NAMES.map((key) => [key, getSingleParameter(searchParams, key, invalidFields)])
  ) as Record<(typeof INPUT_PARAMETER_NAMES)[number], string | null>;
  const hasCalculationQuery = INPUT_PARAMETER_NAMES.some((key) => searchParams.has(key));

  if (!hasCalculationQuery) return rejectQueryWithoutCalculation(sourceId, region, metric, issues);

  const { mode: modeValue, deckPower: deckPowerValue, deckBonus: deckBonusValue } = queryValues;
  const { boostMultiplier: boostMultiplierValue, skillRates: skillRatesValue } = queryValues;
  const normalizedMode = readQueryMode(modeValue, issues);
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
  const noSkill = readQueryNoSkill(queryValues.noSkill, issues);
  const skillRates = readQuerySkillRates(skillRatesValue, noSkill, issues);

  const pageInputs = buildPageInputs(sourceId, region, metric, queryValues, {
    deckPower,
    deckBonus,
    boostMultiplier,
    skillRates,
    noSkill
  });

  if (sourceId === null) invalidFields.add("source");
  if (missingFields.size > 0 || invalidFields.size > 0) {
    return makeUnavailableQuery(
      source,
      metric,
      pageInputs,
      classifyQueryFailure(sourceId, invalidFields.size > 0),
      issues
    );
  }

  return {
    status: "available",
    source: source as MusicMetaSource,
    metric,
    inputs: pageInputs,
    domainInputs: {
      region,
      mode: normalizedMode,
      deckPower,
      deckBonus,
      boostMultiplier,
      cardLength: SKILL_SLOT_COUNT,
      skillAllocation: { strategy: "default", skillEffects: skillRates }
    }
  };
};

type UnavailableDetails = {
  reasonCode: string;
  reason: string;
  missingFields?: readonly string[];
  invalidFields?: readonly string[];
  provenance?: MusicMetaProvenance | null;
};

/** The plan panel when per-live yields cannot be calculated: its own input errors still show. */
const planWithoutYields = (planQuery: ParsedPlanQuery): MusicRecommenderPlanData => {
  if (planQuery.status === "idle") return { status: "idle", inputs: planQuery.inputs };
  if (planQuery.status === "invalid") {
    const { inputs, missingFields, invalidFields } = planQuery;
    return { status: "invalid", inputs, missingFields, invalidFields };
  }
  return {
    status: "unavailable",
    inputs: planQuery.inputs,
    reason: "yields-unavailable",
    invalidFields: [],
    bound: null
  };
};

type BoostCost =
  { status: "available"; perLive: number } | { status: "not-in-table" } | { status: "unavailable" };

const readBoostCost = (boosts: RegionBoosts, boostMultiplier: number): BoostCost => {
  if (boosts.status === "unavailable") return { status: "unavailable" };
  const perLive = findLiveBonusPerLive(boosts.boosts, boostMultiplier);
  return perLive === null ? { status: "not-in-table" } : { status: "available", perLive };
};

const planUnavailable = (
  inputs: PlanFormInputs,
  reason: MusicRecommenderPlanUnavailableReason,
  invalidFields: readonly string[] = [],
  bound: PlanUnavailable["bound"] = null
): MusicRecommenderPlanData => ({
  status: "unavailable",
  inputs,
  reason,
  invalidFields: [...invalidFields],
  bound
});

type LivesLimit =
  | { status: "ok"; maxPlays: number }
  | {
      status: "refused";
      reason: "live-bonus-unavailable" | "boost-not-in-table" | "live-bonus-limit";
    };

/**
 * Turns the live bonus cap into the lives limit the planner works with. The conversion is exact
 * (see `livesWithinLiveBonus`), so the planner's guarantees hold unchanged under the cap.
 */
const resolveLivesLimit = (
  maxPlays: number,
  maxLiveBonus: number | null,
  cost: BoostCost
): LivesLimit => {
  if (maxLiveBonus === null) return { status: "ok", maxPlays };
  if (cost.status === "unavailable") return { status: "refused", reason: "live-bonus-unavailable" };
  if (cost.status === "not-in-table") return { status: "refused", reason: "boost-not-in-table" };
  const lives = livesWithinLiveBonus(maxLiveBonus, cost.perLive);
  if (lives === null) return { status: "ok", maxPlays };
  if (lives === 0) return { status: "refused", reason: "live-bonus-limit" };
  return { status: "ok", maxPlays: Math.min(maxPlays, lives) };
};

const planWithYields = (
  planQuery: Extract<ParsedPlanQuery, { status: "ready" }>,
  metric: MusicRecommenderMetric,
  items: readonly JpSoloRankingItem[],
  cost: BoostCost
): MusicRecommenderPlanData => {
  const { inputs } = planQuery;
  const { maxLiveBonus, ...request } = planQuery.request;
  const limit = resolveLivesLimit(request.maxPlays, maxLiveBonus, cost);
  if (limit.status === "refused") {
    // An off-table multiplier is the deck field to change, so it is named.
    return planUnavailable(
      inputs,
      limit.reason,
      limit.reason === "boost-not-in-table" ? ["boostMultiplier"] : []
    );
  }

  const yields: PlannerYield[] = items.map(({ music, score, eventPoints }) => ({
    musicId: music.musicId,
    difficulty: music.difficulty,
    score,
    eventPoints
  }));
  const result = planTarget({ yields, metric, ...request, maxPlays: limit.maxPlays });
  if (result.status === "unavailable") {
    // The tighter of the two limits is the one named; the other may still be too low.
    const reason =
      result.reason === "plays-limit" && limit.maxPlays < request.maxPlays
        ? "live-bonus-limit"
        : result.reason;
    return planUnavailable(inputs, reason, result.invalidFields, result.bound);
  }

  const liveBonus: PlanLiveBonus =
    cost.status === "available"
      ? {
          status: "available",
          perLive: cost.perLive,
          total: result.plays * cost.perLive,
          limit: maxLiveBonus
        }
      : cost;
  return { status: "ready", inputs, plan: result, liveBonus };
};

const makeUnavailablePageData = (
  source: MusicMetaSource | null,
  metric: MusicRecommenderMetric,
  inputs: MusicRecommenderPageInputs,
  details: UnavailableDetails,
  planQuery: ParsedPlanQuery
): MusicRecommenderPageData => {
  const provenance = details.provenance ?? null;
  return {
    status: "unavailable",
    source,
    metric,
    inputs,
    items: [],
    formulaVersion: formulaVersionForRequestedMode(inputs.mode),
    provenance,
    sourceHash: provenance?.contentHash ?? null,
    reasonCode: details.reasonCode,
    reason: details.reason,
    missingFields: [...(details.missingFields ?? [])],
    invalidFields: [...(details.invalidFields ?? [])],
    plan: planWithoutYields(planQuery)
  };
};

const defaultRegionBoostLoader: RegionBoostLoader = async (region): Promise<RegionBoosts> => {
  try {
    return await loadRegionBoosts(getMasterApiBaseUrl(), region);
  } catch {
    return { status: "unavailable" };
  }
};

const defaultRegionChartLoader: RegionChartLoader = async (region): Promise<RegionCharts> => {
  try {
    return await loadRegionCharts(getMasterApiBaseUrl(), region);
  } catch {
    return { status: "unavailable" };
  }
};

/** Builds the serializable page contract; only ranked results leave the server. */
export const loadMusicRecommenderPageData = async (
  searchParams: URLSearchParams,
  fetcher: MusicMetaFetcher,
  now: () => Date = () => new Date(),
  loadCharts: RegionChartLoader = defaultRegionChartLoader,
  loadBoosts: RegionBoostLoader = defaultRegionBoostLoader
): Promise<MusicRecommenderPageData> => {
  const planQuery = parseTargetPlanQuery(searchParams);
  const parsedQuery = parseMusicRecommenderQuery(searchParams);
  if (parsedQuery.status === "unavailable") {
    return makeUnavailablePageData(
      parsedQuery.source,
      parsedQuery.metric,
      parsedQuery.inputs,
      parsedQuery,
      planQuery
    );
  }

  const dataset = await loadMusicMetaCatalog(parsedQuery.source.id, fetcher, now);
  if (dataset.status === "unavailable") {
    return makeUnavailablePageData(
      dataset.source ?? parsedQuery.source,
      parsedQuery.metric,
      parsedQuery.inputs,
      dataset,
      planQuery
    );
  }

  const { region } = parsedQuery.inputs;
  const charts =
    region === null || region === DEFAULT_YIELD_REGION ? null : await loadCharts(region);
  const ranking = rankJpSoloRecommendations(
    dataset,
    parsedQuery.domainInputs,
    parsedQuery.metric,
    charts?.status === "available" ? charts.charts : null
  );
  if (ranking.status === "unavailable") {
    return makeUnavailablePageData(
      dataset.source,
      parsedQuery.metric,
      parsedQuery.inputs,
      ranking,
      planQuery
    );
  }

  // The boost table is only read when there is a plan to describe.
  const plan =
    planQuery.status === "ready"
      ? planWithYields(
          planQuery,
          parsedQuery.metric,
          ranking.items,
          readBoostCost(
            await loadBoosts(region ?? DEFAULT_YIELD_REGION),
            parsedQuery.domainInputs.boostMultiplier as number
          )
        )
      : planWithoutYields(planQuery);

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
    invalidFields: [],
    plan
  };
};
