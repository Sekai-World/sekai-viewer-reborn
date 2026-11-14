/**
 * Exact shortest-time search with repeats: the least total time of lives whose amounts add up to
 * at least `need`, using at most `budget` lives and, among plans of that time, the largest total.
 *
 * Only rows that no other row beats on both time and amount can be part of an optimum, so the
 * tables run over those. A table over the total time answers when its plan fits the lives budget;
 * otherwise a table over lives and time does. A request beyond the limits below is refused, never
 * approximated.
 * See docs/viewer-implementation/tools-site-target-planner.md.
 */

/** Entries of the time table: one more than the longest total time it covers. */
export const SHORTEST_TIME_MAX_SPAN = 2_500_000;
/** Cells of the lives table; each takes one or two bytes. */
export const SHORTEST_TIME_MAX_CELLS = 32_000_000;
/** Row visits a single request may spend over both tables. */
export const SHORTEST_TIME_MAX_WORK = 400_000_000;

export type TimedRow = Readonly<{ time: number; amount: number }>;

export type ShortestTimeBound = Readonly<{
  name: "timeSpan" | "timeCells" | "timeWork";
  limit: number;
  actual: number;
}>;

export type ShortestTimeOutcome =
  | { status: "solved"; playsByRow: ReadonlyMap<number, number> }
  | { status: "plays-limit" }
  | { status: "exceeded"; bound: ShortestTimeBound };

type FrontRow = { time: number; amount: number; row: number };

const UNREACHED = -1;

/**
 * The rows worth playing, by rising time and amount. A row is dropped when another takes no
 * longer and yields no less; of equal rows the first stays.
 */
const buildFront = (rows: readonly TimedRow[]): FrontRow[] => {
  const sorted = rows
    .map((entry, row): FrontRow => ({ time: entry.time, amount: entry.amount, row }))
    .sort(
      (left, right) => left.time - right.time || right.amount - left.amount || left.row - right.row
    );
  const front: FrontRow[] = [];
  for (const entry of sorted) {
    if (front.length === 0 || entry.amount > (front.at(-1) as FrontRow).amount) front.push(entry);
  }
  return front;
};

const exceeded = (
  name: ShortestTimeBound["name"],
  limit: number,
  actual: number
): ShortestTimeOutcome => ({ status: "exceeded", bound: { name, limit, actual } });

const solved = (front: readonly FrontRow[], counts: readonly number[]): ShortestTimeOutcome => {
  const playsByRow = new Map<number, number>();
  counts.forEach((plays, index) => {
    if (plays > 0) playsByRow.set(front[index].row, plays);
  });
  return { status: "solved", playsByRow };
};

/** The time of the plan with the fewest lives: the largest row, closed by the quickest that fits. */
const fewestLivesTime = (front: readonly FrontRow[], need: number, lives: number): number => {
  const largest = front.at(-1) as FrontRow;
  const remainder = need - (lives - 1) * largest.amount;
  const last = front.find((entry) => entry.amount >= remainder) as FrontRow;
  return (lives - 1) * largest.time + last.time;
};

/** The quickest plan that repeats one row only. */
const singleRowTime = (front: readonly FrontRow[], need: number): number =>
  front.reduce(
    (best, entry) => Math.min(best, Math.ceil(need / entry.amount) * entry.time),
    Infinity
  );

type TimeTableResult = { counts: number[]; lives: number };

/**
 * Largest amount for every exact total time, up to the first time that reaches `need`. Equal
 * amounts keep the fewer lives, which makes a plan within the budget more likely but does not
 * decide whether one exists; the lives table does.
 */
const solveByTime = (front: readonly FrontRow[], need: number, span: number): TimeTableResult => {
  const best = new Float64Array(span).fill(UNREACHED);
  const lives = new Uint32Array(span);
  const choice = front.length <= 0xffff ? new Uint16Array(span) : new Uint32Array(span);
  best[0] = 0;

  let found = 0;
  for (let time = 1; time < span; time += 1) {
    let amount = UNREACHED;
    let count = 0;
    let pick = 0;
    for (let index = 0; index < front.length; index += 1) {
      const entry = front[index];
      if (entry.time > time) break;
      const previous = best[time - entry.time];
      if (previous === UNREACHED) continue;
      const total = previous + entry.amount;
      const used = lives[time - entry.time] + 1;
      if (total > amount || (total === amount && used < count)) {
        amount = total;
        count = used;
        pick = index;
      }
    }
    best[time] = amount;
    lives[time] = count;
    choice[time] = pick;
    if (amount >= need) {
      found = time;
      break;
    }
  }

  const counts = front.map(() => 0);
  for (let time = found; time > 0; time -= front[choice[time]].time) counts[choice[time]] += 1;
  return { counts, lives: lives[found] };
};

type Layer = { low: number; high: number; offset: number };

/**
 * The time range a plan of exactly `lives` lives can have without passing `ceiling`: every live
 * takes between the quickest and the slowest row of the front.
 */
const layerRange = (
  front: readonly FrontRow[],
  lives: number,
  ceiling: number
): { low: number; high: number } => ({
  low: lives * front[0].time,
  high: Math.min(lives * (front.at(-1) as FrontRow).time, ceiling)
});

const planLayers = (front: readonly FrontRow[], maxLives: number, ceiling: number): Layer[] => {
  const layers: Layer[] = [{ low: 0, high: 0, offset: 0 }];
  let offset = 1;
  for (let lives = 1; lives <= maxLives; lives += 1) {
    const { low, high } = layerRange(front, lives, ceiling);
    layers.push({ low, high, offset });
    offset += high - low + 1;
  }
  return layers;
};

/**
 * Largest amount for every number of lives and exact total time, layer by layer. The answer is
 * the least time that reaches `need` in any layer, with the largest amount and then the fewest
 * lives. `ceiling` is the time of a plan known to fit, so an answer always exists.
 */
const solveByLives = (
  front: readonly FrontRow[],
  need: number,
  layers: readonly Layer[],
  cells: number
): number[] => {
  const choice = front.length < 255 ? new Uint8Array(cells) : new Uint16Array(cells);
  const widest = layers.reduce((width, layer) => Math.max(width, layer.high - layer.low + 1), 1);
  let previous = new Float64Array(widest).fill(UNREACHED);
  let current = new Float64Array(widest);
  previous[0] = 0;

  let answer = { lives: 0, time: Infinity, amount: 0 };
  for (let used = 1; used < layers.length; used += 1) {
    const layer = layers[used];
    const before = layers[used - 1];
    // Times past the best so far cannot improve on it. Cells left unwritten above `high` keep
    // older values, but the next layer stops at `high` too and only reads below it.
    const high = Math.min(layer.high, answer.time);
    for (let time = layer.low; time <= high; time += 1) {
      let amount = UNREACHED;
      let pick = 0;
      for (let index = 0; index < front.length; index += 1) {
        const source = time - front[index].time;
        if (source < before.low) break;
        if (source > before.high) continue;
        const base = previous[source - before.low];
        if (base !== UNREACHED && base + front[index].amount > amount) {
          amount = base + front[index].amount;
          pick = index + 1;
        }
      }
      current[time - layer.low] = amount;
      choice[layer.offset + time - layer.low] = pick;
      if (
        amount >= need &&
        (time < answer.time || (time === answer.time && amount > answer.amount))
      ) {
        answer = { lives: used, time, amount };
      }
    }
    [previous, current] = [current, previous];
  }

  const counts = front.map(() => 0);
  let { time } = answer;
  for (let used = answer.lives; used > 0; used -= 1) {
    const index = choice[layers[used].offset + time - layers[used].low] - 1;
    counts[index] += 1;
    time -= front[index].time;
  }
  return counts;
};

/**
 * `rows` are the lives that may be played, any number of times each; times and amounts are
 * positive whole numbers. `playsByRow` is keyed by the row's position in `rows`.
 */
export const searchShortestTime = (
  rows: readonly TimedRow[],
  need: number,
  budget: number
): ShortestTimeOutcome => {
  const front = buildFront(rows);
  const largest = front.at(-1) as FrontRow;
  const fewestLives = Math.ceil(need / largest.amount);
  if (fewestLives > budget) return { status: "plays-limit" };

  // Two plans that are always possible; the shortest time is at most the quicker of them.
  const fitting = fewestLivesTime(front, need, fewestLives);
  const span = Math.min(fitting, singleRowTime(front, need)) + 1;
  if (span > SHORTEST_TIME_MAX_SPAN) return exceeded("timeSpan", SHORTEST_TIME_MAX_SPAN, span);
  const timeWork = span * front.length;
  if (timeWork > SHORTEST_TIME_MAX_WORK) {
    return exceeded("timeWork", SHORTEST_TIME_MAX_WORK, timeWork);
  }

  const free = solveByTime(front, need, span);
  if (free.lives <= budget) return solved(front, free.counts);

  // The lives budget rules that plan out. The fewest-lives plan fits it, so its time is a ceiling.
  const maxLives = Math.min(budget, Math.floor(fitting / front[0].time));
  const layers = planLayers(front, maxLives, fitting);
  const last = layers.at(-1) as Layer;
  const cells = last.offset + (last.high - last.low + 1);
  if (cells > SHORTEST_TIME_MAX_CELLS) return exceeded("timeCells", SHORTEST_TIME_MAX_CELLS, cells);
  const work = timeWork + cells * front.length;
  if (work > SHORTEST_TIME_MAX_WORK) return exceeded("timeWork", SHORTEST_TIME_MAX_WORK, work);

  return solved(front, solveByLives(front, need, layers, cells));
};
