import { MUSIC_META_DIFFICULTIES, type MusicMetaDifficulty } from "#lib/music-recommender.js";

/**
 * Plans how many plays of which songs reach a cumulative score or event-point target,
 * from per-live yields that are already validated (the JP Solo recommender).
 * Every plan returned is provably optimal for its declared objective; a request the
 * exact solvers cannot cover within the bounds below is refused, never approximated.
 * See docs/viewer-implementation/tools-site-target-planner.md.
 */

export type PlannerMetric = "score" | "eventPoints";
export type PlannerObjective = "fewestPlays" | "leastOvershoot";

/** Targets and per-play yields are capped so every sum stays a safe integer. */
export const PLANNER_MAX_TARGET = 100_000_000_000;
export const PLANNER_MAX_PLAYS = 10_000;
/** The exact least-overshoot solver tables sums below `target + largest yield`. */
export const PLANNER_MAX_SUM_SPAN = 5_000_000;
export const PLANNER_MAX_WORK = 50_000_000;

export type PlannerYield = Readonly<{
  musicId: number;
  difficulty: string;
  score: number;
  eventPoints: number;
}>;

export type PlannerSongRef = Readonly<{ musicId: number; difficulty: string }>;

export type PlannerInput = Readonly<{
  yields: readonly PlannerYield[];
  metric: PlannerMetric;
  target: number;
  objective: PlannerObjective;
  /** Upper limit on the total number of lives played, including required songs. */
  maxPlays: number;
  /** When false every song and difficulty is played at most once. */
  allowRepeats: boolean;
  /** Limits the candidates to these difficulties; null or undefined allows all. */
  allowedDifficulties?: readonly string[] | null;
  /** Each of these is played at least once. */
  requiredSongs?: readonly PlannerSongRef[] | null;
}>;

export type PlanItem = Readonly<{
  musicId: number;
  difficulty: MusicMetaDifficulty;
  plays: number;
  yieldPerPlay: number;
  subtotal: number;
  required: boolean;
}>;

export type TargetPlan = Readonly<{
  status: "ready";
  objective: PlannerObjective;
  metric: PlannerMetric;
  target: number;
  maxPlays: number;
  allowRepeats: boolean;
  /** Every plan returned is optimal for the objective: fewest plays, or least overshoot. */
  optimality: "optimal";
  items: readonly PlanItem[];
  plays: number;
  /** Sum of the planned metric; at least the target. */
  total: number;
  totals: Readonly<{ score: number; eventPoints: number }>;
  overshoot: number;
  objectiveValue: number;
}>;

export type PlanUnavailableReason =
  | "invalid-input"
  | "no-candidates"
  | "required-unavailable"
  | "plays-limit"
  | "target-unreachable"
  | "out-of-bounds";

export type PlanUnavailable = Readonly<{
  status: "unavailable";
  reason: PlanUnavailableReason;
  invalidFields: readonly string[];
  /** For `out-of-bounds`: which bound was exceeded and by how much. */
  bound: Readonly<{ name: "sumSpan" | "work"; limit: number; actual: number }> | null;
}>;

export type PlanResult = TargetPlan | PlanUnavailable;

type Candidate = {
  musicId: number;
  difficulty: MusicMetaDifficulty;
  order: number;
  y: number;
  score: number;
  eventPoints: number;
};

const difficultyRank = new Map<string, number>(
  MUSIC_META_DIFFICULTIES.map((difficulty, index) => [difficulty, index])
);

const isDifficulty = (value: unknown): value is MusicMetaDifficulty =>
  typeof value === "string" && difficultyRank.has(value);

const isPositiveSafeInteger = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= max;

const songKey = (musicId: number, difficulty: string): string => `${musicId}:${difficulty}`;

const unavailable = (
  reason: PlanUnavailableReason,
  invalidFields: readonly string[] = [],
  bound: PlanUnavailable["bound"] = null
): PlanUnavailable => ({ status: "unavailable", reason, invalidFields: [...invalidFields], bound });

const compareCandidates = (left: Candidate, right: Candidate): number => left.order - right.order;

const validateScalars = (input: PlannerInput): string[] => {
  const invalid: string[] = [];
  if (input.metric !== "score" && input.metric !== "eventPoints") invalid.push("metric");
  if (input.objective !== "fewestPlays" && input.objective !== "leastOvershoot") {
    invalid.push("objective");
  }
  if (!isPositiveSafeInteger(input.target, PLANNER_MAX_TARGET)) invalid.push("target");
  if (!isPositiveSafeInteger(input.maxPlays, PLANNER_MAX_PLAYS)) invalid.push("maxPlays");
  if (typeof input.allowRepeats !== "boolean") invalid.push("allowRepeats");
  return invalid;
};

const readAllowedDifficulties = (
  allowed: PlannerInput["allowedDifficulties"],
  invalid: string[]
): ReadonlySet<string> | null => {
  if (allowed === null || allowed === undefined) return null;
  if (!Array.isArray(allowed)) {
    invalid.push("allowedDifficulties");
    return null;
  }
  const values: readonly unknown[] = allowed;
  values.forEach((value, index) => {
    if (!isDifficulty(value)) invalid.push(`allowedDifficulties[${index}]`);
  });
  return new Set(values.filter(isDifficulty));
};

/** Reads one yield row; every problem is recorded and the row is then dropped. */
const readYieldRow = (
  entry: unknown,
  index: number,
  metric: PlannerMetric,
  invalid: string[]
): Candidate | null => {
  const { musicId, difficulty, score, eventPoints } = (entry ?? {}) as Partial<PlannerYield>;
  const path = `yields[${index}]`;
  const problems = [
    !isPositiveSafeInteger(musicId, Number.MAX_SAFE_INTEGER) && "musicId",
    !isDifficulty(difficulty) && "difficulty",
    !isPositiveSafeInteger(score, PLANNER_MAX_TARGET) && "score",
    !isPositiveSafeInteger(eventPoints, PLANNER_MAX_TARGET) && "eventPoints"
  ].filter((field): field is string => field !== false);
  if (problems.length > 0) {
    invalid.push(...problems.map((field) => `${path}.${field}`));
    return null;
  }
  return {
    musicId: musicId as number,
    difficulty: difficulty as MusicMetaDifficulty,
    order: 0,
    y: (metric === "score" ? score : eventPoints) as number,
    score: score as number,
    eventPoints: eventPoints as number
  };
};

const readCandidates = (
  input: PlannerInput,
  allowed: ReadonlySet<string> | null,
  invalid: string[]
): Candidate[] => {
  if (!Array.isArray(input.yields)) {
    invalid.push("yields");
    return [];
  }
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const entries: readonly unknown[] = input.yields;
  entries.forEach((entry, index) => {
    const candidate = readYieldRow(entry, index, input.metric, invalid);
    if (candidate === null) return;
    const key = songKey(candidate.musicId, candidate.difficulty);
    if (seen.has(key)) {
      invalid.push(`yields[${index}].duplicate`);
      return;
    }
    seen.add(key);
    if (allowed === null || allowed.has(candidate.difficulty)) candidates.push(candidate);
  });

  candidates.sort(
    (left, right) =>
      left.musicId - right.musicId ||
      (difficultyRank.get(left.difficulty) ?? 0) - (difficultyRank.get(right.difficulty) ?? 0)
  );
  candidates.forEach((candidate, index) => {
    candidate.order = index;
  });
  return candidates;
};

type RequiredReading =
  | { status: "ok"; required: Candidate[] }
  | { status: "invalid"; invalidFields: string[] }
  | { status: "unavailable" };

const readRequiredRef = (
  entry: unknown,
  index: number,
  seen: Set<string>,
  invalid: string[]
): PlannerSongRef | null => {
  const row = (entry ?? {}) as Partial<PlannerSongRef>;
  if (
    !isPositiveSafeInteger(row.musicId, Number.MAX_SAFE_INTEGER) ||
    !isDifficulty(row.difficulty)
  ) {
    invalid.push(`requiredSongs[${index}]`);
    return null;
  }
  const key = songKey(row.musicId, row.difficulty);
  if (seen.has(key)) {
    invalid.push(`requiredSongs[${index}].duplicate`);
    return null;
  }
  seen.add(key);
  return { musicId: row.musicId, difficulty: row.difficulty };
};

const readRequired = (
  requiredSongs: PlannerInput["requiredSongs"],
  candidates: readonly Candidate[]
): RequiredReading => {
  if (requiredSongs === null || requiredSongs === undefined) return { status: "ok", required: [] };
  if (!Array.isArray(requiredSongs)) return { status: "invalid", invalidFields: ["requiredSongs"] };

  const invalid: string[] = [];
  const seen = new Set<string>();
  const entries: readonly unknown[] = requiredSongs;
  const refs = entries
    .map((entry, index) => readRequiredRef(entry, index, seen, invalid))
    .filter((ref): ref is PlannerSongRef => ref !== null);
  if (invalid.length > 0) return { status: "invalid", invalidFields: invalid };

  const byKey = new Map(
    candidates.map((candidate) => [songKey(candidate.musicId, candidate.difficulty), candidate])
  );
  const required = refs.map((ref) => byKey.get(songKey(ref.musicId, ref.difficulty)));
  if (required.includes(undefined)) return { status: "unavailable" };
  return { status: "ok", required: (required as Candidate[]).sort(compareCandidates) };
};

type Prepared = {
  input: PlannerInput;
  candidates: Candidate[];
  required: Candidate[];
};

const prepare = (input: PlannerInput): Prepared | PlanUnavailable => {
  const invalid = validateScalars(input);
  const allowed = readAllowedDifficulties(input.allowedDifficulties, invalid);
  const candidates = readCandidates(input, allowed, invalid);
  if (invalid.length > 0) return unavailable("invalid-input", invalid);
  if (candidates.length === 0) return unavailable("no-candidates");

  const required = readRequired(input.requiredSongs, candidates);
  if (required.status === "invalid") return unavailable("invalid-input", required.invalidFields);
  if (required.status === "unavailable") return unavailable("required-unavailable");
  return { input, candidates, required: required.required };
};

const buildPlan = (prepared: Prepared, freePlays: ReadonlyMap<Candidate, number>): TargetPlan => {
  const { input, required } = prepared;
  const counts = new Map<Candidate, number>(freePlays);
  for (const candidate of required) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  const requiredSet = new Set(required);

  const items = [...counts.entries()]
    .sort(([left], [right]) => compareCandidates(left, right))
    .map(([candidate, plays]): PlanItem => ({
      musicId: candidate.musicId,
      difficulty: candidate.difficulty,
      plays,
      yieldPerPlay: candidate.y,
      subtotal: candidate.y * plays,
      required: requiredSet.has(candidate)
    }));

  let plays = 0;
  let total = 0;
  let score = 0;
  let eventPoints = 0;
  for (const [candidate, count] of counts) {
    plays += count;
    total += candidate.y * count;
    score += candidate.score * count;
    eventPoints += candidate.eventPoints * count;
  }
  const overshoot = total - input.target;
  return {
    status: "ready",
    objective: input.objective,
    metric: input.metric,
    target: input.target,
    maxPlays: input.maxPlays,
    allowRepeats: input.allowRepeats,
    optimality: "optimal",
    items,
    plays,
    total,
    totals: { score, eventPoints },
    overshoot,
    objectiveValue: input.objective === "fewestPlays" ? plays : overshoot
  };
};

const add = (counts: Map<Candidate, number>, candidate: Candidate, plays: number): void => {
  if (plays > 0) counts.set(candidate, (counts.get(candidate) ?? 0) + plays);
};

/**
 * Fewest plays, repeats allowed: every play yields at most the largest yield, so
 * ceil(need / largest) plays are necessary, and (that many - 1) plays of the largest plus
 * one play of the smallest sufficient yield reach the target.
 */
const solveFewestPlaysWithRepeats = (
  pool: readonly Candidate[],
  need: number,
  freeBudget: number
): ReadonlyMap<Candidate, number> | PlanUnavailable => {
  const best = pool.reduce((top, candidate) => (candidate.y > top.y ? candidate : top));
  const plays = Math.ceil(need / best.y);
  if (plays > freeBudget) return unavailable("plays-limit");

  const remainder = need - (plays - 1) * best.y;
  const last = pool.reduce<Candidate | null>(
    (pick, candidate) =>
      candidate.y >= remainder && (pick === null || candidate.y < pick.y) ? candidate : pick,
    null
  ) as Candidate;
  const counts = new Map<Candidate, number>();
  add(counts, best, plays - 1);
  add(counts, last, 1);
  return counts;
};

/** Fewest plays, each song once: the k highest yields have the largest possible sum for any k. */
const solveFewestPlaysWithoutRepeats = (
  pool: readonly Candidate[],
  need: number,
  freeBudget: number
): ReadonlyMap<Candidate, number> | PlanUnavailable => {
  const ranked = [...pool].sort((left, right) => right.y - left.y || left.order - right.order);
  const picked = new Map<Candidate, number>();
  let sum = 0;
  for (const candidate of ranked) {
    if (sum >= need) break;
    picked.set(candidate, 1);
    sum += candidate.y;
  }
  if (sum < need) return unavailable("target-unreachable");
  if (picked.size > freeBudget) return unavailable("plays-limit");
  return picked;
};

const checkBounds = (span: number, work: number): PlanUnavailable | null => {
  if (span > PLANNER_MAX_SUM_SPAN) {
    return unavailable("out-of-bounds", [], {
      name: "sumSpan",
      limit: PLANNER_MAX_SUM_SPAN,
      actual: span
    });
  }
  if (work > PLANNER_MAX_WORK) {
    return unavailable("out-of-bounds", [], {
      name: "work",
      limit: PLANNER_MAX_WORK,
      actual: work
    });
  }
  return null;
};

const NO_PATH = 0xffffffff;

/** The smallest reachable sum at or above `need` whose fewest plays fit the budget. */
const findLeastOvershoot = (
  fewestPlays: Uint32Array,
  need: number,
  freeBudget: number
): { sum: number } | "plays-limit" | "unreachable" => {
  let reachable = false;
  for (let sum = need; sum < fewestPlays.length; sum += 1) {
    const plays = fewestPlays[sum];
    if (plays === NO_PATH) continue;
    reachable = true;
    if (plays <= freeBudget) return { sum };
  }
  return reachable ? "plays-limit" : "unreachable";
};

/** One song per distinct yield: equal yields are interchangeable, so the lowest id stands in. */
const pickRepresentatives = (pool: readonly Candidate[]): Map<number, Candidate> => {
  const representative = new Map<number, Candidate>();
  for (const candidate of pool) {
    if (!representative.has(candidate.y)) representative.set(candidate.y, candidate);
  }
  return representative;
};

/** Fewest plays to reach each sum with unlimited repeats, and the last yield used to get there. */
const buildRepeatTable = (
  yields: readonly number[],
  span: number
): { fewestPlays: Uint32Array; choice: Int32Array } => {
  const fewestPlays = new Uint32Array(span).fill(NO_PATH);
  const choice = new Int32Array(span).fill(-1);
  fewestPlays[0] = 0;
  for (let sum = 1; sum < span; sum += 1) {
    let best = NO_PATH;
    for (let index = 0; index < yields.length; index += 1) {
      const amount = yields[index];
      if (amount > sum) break;
      const previous = fewestPlays[sum - amount];
      if (previous !== NO_PATH && previous + 1 < best) {
        best = previous + 1;
        choice[sum] = index;
      }
    }
    fewestPlays[sum] = best;
  }
  return { fewestPlays, choice };
};

/**
 * Least overshoot, repeats allowed: unbounded-knapsack table of the fewest plays reaching each
 * sum. Dropping any play from a plan that overshoots by a full largest yield would still reach
 * the target, so the optimum lies below `need + largest yield`.
 */
const solveLeastOvershootWithRepeats = (
  pool: readonly Candidate[],
  need: number,
  freeBudget: number
): ReadonlyMap<Candidate, number> | PlanUnavailable => {
  const representative = pickRepresentatives(pool);
  const yields = [...representative.keys()].sort((left, right) => left - right);
  const span = need + (yields.at(-1) ?? 0);
  const exceeded = checkBounds(span, span * yields.length);
  if (exceeded !== null) return exceeded;

  const { fewestPlays, choice } = buildRepeatTable(yields, span);
  const found = findLeastOvershoot(fewestPlays, need, freeBudget);
  if (found === "unreachable") return unavailable("target-unreachable");
  if (found === "plays-limit") return unavailable("plays-limit");

  const counts = new Map<Candidate, number>();
  for (let sum = found.sum; sum > 0;) {
    const amount = yields[choice[sum]];
    add(counts, representative.get(amount) as Candidate, 1);
    sum -= amount;
  }
  return counts;
};

/** Least overshoot, each song once: 0/1 knapsack table, with per-song bits to rebuild the plan. */
const solveLeastOvershootWithoutRepeats = (
  pool: readonly Candidate[],
  need: number,
  freeBudget: number
): ReadonlyMap<Candidate, number> | PlanUnavailable => {
  const largest = pool.reduce((top, candidate) => Math.max(top, candidate.y), 0);
  const span = need + largest;
  const exceeded = checkBounds(span, span * pool.length);
  if (exceeded !== null) return exceeded;

  const fewestPlays = new Uint32Array(span).fill(NO_PATH);
  fewestPlays[0] = 0;
  const taken = new Uint8Array(Math.ceil((pool.length * span) / 8));
  pool.forEach((candidate, index) => {
    for (let sum = span - 1; sum >= candidate.y; sum -= 1) {
      const previous = fewestPlays[sum - candidate.y];
      if (previous !== NO_PATH && previous + 1 < fewestPlays[sum]) {
        fewestPlays[sum] = previous + 1;
        const bit = index * span + sum;
        taken[bit >> 3] |= 1 << (bit & 7);
      }
    }
  });

  const found = findLeastOvershoot(fewestPlays, need, freeBudget);
  if (found === "unreachable") return unavailable("target-unreachable");
  if (found === "plays-limit") return unavailable("plays-limit");

  const counts = new Map<Candidate, number>();
  let sum = found.sum;
  for (let index = pool.length - 1; index >= 0 && sum > 0; index -= 1) {
    const bit = index * span + sum;
    if ((taken[bit >> 3] & (1 << (bit & 7))) !== 0) {
      add(counts, pool[index], 1);
      sum -= pool[index].y;
    }
  }
  return counts;
};

const isUnavailable = (
  value: ReadonlyMap<Candidate, number> | PlanUnavailable
): value is PlanUnavailable => !(value instanceof Map);

/** Plans the plays needed to reach a cumulative target; see the module note for guarantees. */
export const planTarget = (input: PlannerInput): PlanResult => {
  const prepared = prepare(input);
  if ("status" in prepared) return prepared;

  const { required, candidates } = prepared;
  if (required.length > input.maxPlays) return unavailable("plays-limit");

  const requiredSum = required.reduce((sum, candidate) => sum + candidate.y, 0);
  const need = Math.max(0, input.target - requiredSum);
  if (need === 0) return buildPlan(prepared, new Map());

  const freeBudget = input.maxPlays - required.length;
  const requiredSet = new Set(required);
  const pool = input.allowRepeats
    ? candidates
    : candidates.filter((candidate) => !requiredSet.has(candidate));
  if (pool.length === 0) return unavailable("target-unreachable");

  let free: ReadonlyMap<Candidate, number> | PlanUnavailable;
  if (input.objective === "fewestPlays") {
    free = input.allowRepeats
      ? solveFewestPlaysWithRepeats(pool, need, freeBudget)
      : solveFewestPlaysWithoutRepeats(pool, need, freeBudget);
  } else {
    free = input.allowRepeats
      ? solveLeastOvershootWithRepeats(pool, need, freeBudget)
      : solveLeastOvershootWithoutRepeats(pool, need, freeBudget);
  }
  return isUnavailable(free) ? free : buildPlan(prepared, free);
};
