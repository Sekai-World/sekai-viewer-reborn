/**
 * Exact least-overshoot search for yields too large to table by sum: the smallest total at or
 * above `need` within `budget` plays and, among plans with that total, the fewest plays.
 *
 * Plans are searched by their number of plays k, from the fewest that can reach `need`. A k-play
 * total is `k * largest - (the deficits of its plays below the largest yield)`, so what has to be
 * tabled is the deficit, which stays below one yield at the first k whatever the target.
 * A request the search cannot settle within the work limit is refused, never approximated.
 * See docs/viewer-implementation/tools-site-target-planner.md.
 */

/** Bit and word operations a single request may spend; about a third of a second when measured. */
export const LEAST_OVERSHOOT_MAX_SEARCH_WORK = 400_000_000;
/** The widest deficit range tabled, in bits; each layer of the table takes an eighth of this. */
export const LEAST_OVERSHOOT_MAX_DEFICIT_SPAN = 2 ** 26;
/** How far, in widest deficits, the exact-hit shortcut tables, and how many ways it tries. */
const CLOSING_WINDOW_WIDTHS = 3;
const CLOSING_TRIES = 3;

/** A branch-and-bound node costs about this many bit operations. */
const EXPLORE_NODE_WORK = 8;

export type LeastOvershootBound = Readonly<{
  name: "deficitSpan" | "searchWork";
  limit: number;
  actual: number;
}>;

export type LeastOvershootOutcome =
  | { status: "solved"; playsByYield: ReadonlyMap<number, number> }
  | { status: "plays-limit" }
  | { status: "unreachable" }
  | { status: "exceeded"; bound: LeastOvershootBound };

class SearchLimitExceeded extends Error {
  constructor(readonly bound: LeastOvershootBound) {
    super("least-overshoot search limit exceeded");
  }
}

class WorkMeter {
  spent = 0;

  constructor(private readonly limit: number) {}

  charge(amount: number): void {
    this.spent += amount;
    if (this.spent > this.limit) {
      throw new SearchLimitExceeded({
        name: "searchWork",
        limit: this.limit,
        actual: this.spent
      });
    }
  }
}

const greatestCommonDivisor = (left: number, right: number): number => {
  let [a, b] = [left, right];
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

const hasBit = (bits: Uint32Array, index: number): boolean =>
  (bits[index >>> 5] & (1 << (index & 31))) !== 0;

const forEachBit = (bits: Uint32Array, visit: (index: number) => boolean | void): void => {
  for (let word = 0; word < bits.length; word += 1) {
    for (let rest = bits[word]; rest !== 0; rest &= rest - 1) {
      if (visit(word * 32 + (31 - Math.clz32(rest & -rest))) === true) return;
    }
  }
};

const countBits = (bits: Uint32Array): number => {
  let count = 0;
  forEachBit(bits, () => {
    count += 1;
  });
  return count;
};

/** Sums of at most j positive deficits up to `cap`, one bitset per j, built only as far as asked. */
class DeficitLayers {
  private readonly layers: Uint32Array[];
  private readonly deficits: readonly number[];
  private frontier: Uint32Array;
  private readonly words: number;

  constructor(
    positiveDeficits: readonly number[],
    private readonly cap: number,
    private readonly meter: WorkMeter
  ) {
    if (cap > LEAST_OVERSHOOT_MAX_DEFICIT_SPAN) {
      throw new SearchLimitExceeded({
        name: "deficitSpan",
        limit: LEAST_OVERSHOOT_MAX_DEFICIT_SPAN,
        actual: cap
      });
    }
    this.words = (cap >>> 5) + 1;
    this.deficits = positiveDeficits.filter((deficit) => deficit <= cap);
    this.meter.charge(this.words);
    const zero = new Uint32Array(this.words);
    zero[0] = 1;
    this.layers = [zero];
    this.frontier = zero;
  }

  /** The set for at most `count` deficits, or the largest that differs from it. */
  upTo(count: number): Uint32Array {
    while (this.layers.length <= count && !this.isSaturated()) this.grow();
    return this.layers[Math.min(count, this.layers.length - 1)];
  }

  isSaturated(): boolean {
    return this.frontier.every((word) => word === 0);
  }

  private grow(): void {
    const { words, deficits, frontier, meter, cap } = this;
    meter.charge(words * 2);
    const next = new Uint32Array(words);
    const frontierBits = countBits(frontier);

    if (frontierBits < words) {
      meter.charge(frontierBits * deficits.length);
      forEachBit(frontier, (base) => {
        for (const deficit of deficits) {
          const sum = base + deficit;
          if (sum > cap) break;
          next[sum >>> 5] |= 1 << (sum & 31);
        }
      });
    } else {
      meter.charge(words * deficits.length);
      for (const deficit of deficits) {
        const wordShift = deficit >>> 5;
        const bitShift = deficit & 31;
        for (let word = 0; word + wordShift < words; word += 1) {
          const value = frontier[word];
          if (value === 0) continue;
          next[word + wordShift] |= value << bitShift;
          if (bitShift !== 0 && word + wordShift + 1 < words) {
            next[word + wordShift + 1] |= value >>> (32 - bitShift);
          }
        }
      }
    }

    const previous = this.layers[this.layers.length - 1];
    const newFrontier = new Uint32Array(words);
    for (let word = 0; word < words; word += 1) {
      newFrontier[word] = next[word] & ~previous[word];
      next[word] |= previous[word];
    }
    this.frontier = newFrontier;
    if (!this.isSaturated()) this.layers.push(next);
  }

  /** Whether `sum` is the total of at most `count` deficits, meeting in the middle above 4. */
  hasWithinFour(sum: number, count: number): boolean {
    return this.splitWithinFour(sum, count) !== null;
  }

  private splitWithinFour(sum: number, count: number): [number, number] | null {
    if (sum > this.cap) return null;
    const limit = Math.min(count, 4);
    const smaller = this.upTo(Math.floor(limit / 2));
    const larger = this.upTo(Math.ceil(limit / 2));
    let visited = 0;
    let found: [number, number] | null = null;
    forEachBit(smaller, (part) => {
      visited += 1;
      if (part > sum) return true;
      if (!hasBit(larger, sum - part)) return false;
      found = [part, sum - part];
      return true;
    });
    this.meter.charge(visited);
    return found;
  }

  /** The deficits of a known sum, fewest first: every layer adds at most one to the one below. */
  expand(sum: number): number[] {
    const picked: number[] = [];
    let rest = sum;
    while (rest > 0) {
      let level = 0;
      while (!hasBit(this.layers[level], rest)) level += 1;
      const lower = this.layers[level - 1];
      const deficit = this.deficits.find((value) => value <= rest && hasBit(lower, rest - value));
      picked.push(deficit as number);
      rest -= deficit as number;
    }
    return picked;
  }

  expandWithinFour(sum: number, count: number): number[] {
    const [left, right] = this.splitWithinFour(sum, count) as [number, number];
    return [...this.expand(left), ...this.expand(right)];
  }

  /** The largest sum of at most `count` deficits at or below `ceiling`. */
  largestAtMost(ceiling: number, count: number): number {
    const top = Math.min(ceiling, this.cap);
    let bits = this.layers[0];
    for (let layer = 1; layer <= count && !hasBit(bits, top); layer += 1) {
      if (this.isSaturated()) break;
      bits = this.upTo(layer);
    }
    this.meter.charge(bits.length);
    let word = top >>> 5;
    let value = bits[word] & ((top & 31) === 31 ? 0xffffffff : (1 << ((top & 31) + 1)) - 1);
    while (value === 0) {
      word -= 1;
      value = bits[word];
    }
    return word * 32 + (31 - Math.clz32(value));
  }
}

type Normalized = { unit: number; yields: number[]; need: number };

/** Dividing by the common factor keeps every sum whole and widens nothing. */
const normalize = (yields: readonly number[], need: number): Normalized => {
  const unit = yields.reduce(greatestCommonDivisor);
  return {
    unit,
    yields: yields.map((value) => value / unit).sort((left, right) => right - left),
    need: Math.ceil(need / unit)
  };
};

const runSearch = (
  maxWork: number,
  search: (meter: WorkMeter) => LeastOvershootOutcome
): LeastOvershootOutcome => {
  try {
    return search(new WorkMeter(maxWork));
  } catch (error) {
    if (error instanceof SearchLimitExceeded) return { status: "exceeded", bound: error.bound };
    throw error;
  }
};

/**
 * Repeats allowed. Any play can be the largest yield at no deficit, so k plays can make a total
 * exactly when the deficit `k * largest - total` is a sum of at most k positive deficits.
 */
const searchWithRepeats = (
  distinctYields: readonly number[],
  rawNeed: number,
  budget: number,
  meter: WorkMeter
): LeastOvershootOutcome => {
  const { unit, yields, need } = normalize(distinctYields, rawNeed);
  const largest = yields[0];
  const smallest = yields[yields.length - 1];
  const fewest = Math.ceil(need / largest);
  if (fewest > budget) return { status: "plays-limit" };

  const deficitOf = new Map(yields.map((value) => [largest - value, value]));
  const positive = [...deficitOf.keys()].filter((value) => value > 0).sort((a, b) => a - b);
  const widest = largest - smallest;
  // Four deficits cover the bulk of what they can sum to within this; the rest is the widest one.
  const closingWindow = Math.min(CLOSING_WINDOW_WIDTHS * widest, LEAST_OVERSHOOT_MAX_DEFICIT_SPAN);
  const closing = new DeficitLayers(positive, closingWindow, meter);

  /** The deficits of a plan hitting `deficit` exactly from repeats of the widest plus up to 4. */
  const closeExactly = (plays: number, deficit: number): number[] | null => {
    if (deficit > plays * widest) return null;
    const least = Math.max(0, Math.ceil((deficit - closingWindow) / Math.max(widest, 1)));
    for (let widestPlays = least; widestPlays <= least + CLOSING_TRIES; widestPlays += 1) {
      const rest = deficit - widestPlays * widest;
      if (rest < 0) break;
      if (closing.hasWithinFour(rest, plays - widestPlays)) {
        return [
          ...new Array<number>(widestPlays).fill(widest),
          ...closing.expandWithinFour(rest, plays - widestPlays)
        ];
      }
    }
    return null;
  };

  let bestOvershoot = Infinity;
  let bestPlays = new Map<number, number>();
  const record = (plays: number, overshoot: number, deficits: readonly number[]): void => {
    bestOvershoot = overshoot;
    bestPlays = new Map([[largest * unit, plays - deficits.length]]);
    for (const deficit of deficits) {
      const value = (deficitOf.get(deficit) as number) * unit;
      bestPlays.set(value, (bestPlays.get(value) ?? 0) + 1);
    }
  };

  // Every play yields at least `smallest`, so a k whose minimum is past the best cannot improve it.
  for (let plays = fewest; plays <= budget; plays += 1) {
    if (plays * smallest - need >= bestOvershoot) break;
    const deficit = plays * largest - need;
    const closed = closeExactly(plays, deficit);
    if (closed !== null) {
      record(plays, 0, closed);
      break;
    }

    const layers = new DeficitLayers(positive, Math.min(deficit, plays * widest), meter);
    const reached = layers.largestAtMost(deficit, plays);
    if (deficit - reached < bestOvershoot) {
      record(plays, deficit - reached, layers.expand(reached));
    }
    if (bestOvershoot === 0) break;
  }
  for (const [value, count] of bestPlays) if (count === 0) bestPlays.delete(value);
  return { status: "solved", playsByYield: bestPlays };
};

/**
 * Each row once: a greedy head closed by an exact pair proves a plan outright when it hits the
 * target at the fewest plays; otherwise branch and bound over the rows settles that play count.
 */
const searchWithoutRepeats = (
  rows: readonly number[],
  rawNeed: number,
  budget: number,
  meter: WorkMeter
): LeastOvershootOutcome => {
  const { unit, yields, need } = normalize(rows, rawNeed);
  const count = yields.length;
  const prefix = new Array<number>(count + 1).fill(0);
  yields.forEach((value, index) => {
    prefix[index + 1] = prefix[index] + value;
  });
  if (prefix[count] < need) return { status: "unreachable" };

  let fewest = 1;
  while (prefix[fewest] < need) fewest += 1;
  if (fewest > budget) return { status: "plays-limit" };

  /** The indices of a closest-to-average head and a pair making `need` exactly, if there is one. */
  const closeExactly = (plays: number): number[] | null => {
    meter.charge(count + plays);
    const used = new Uint8Array(count);
    const picked: number[] = [];
    let rest = need;
    for (let left = plays; left > 2; left -= 1) {
      const average = rest / left;
      let low = 0;
      let high = count;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (yields[middle] > average) low = middle + 1;
        else high = middle;
      }
      let above = low - 1;
      let below = low;
      while (above >= 0 && used[above] === 1) above -= 1;
      while (below < count && used[below] === 1) below += 1;
      const pick =
        below >= count ||
        (above >= 0 && Math.abs(yields[above] - average) <= Math.abs(yields[below] - average))
          ? above
          : below;
      used[pick] = 1;
      picked.push(pick);
      rest -= yields[pick];
    }

    let front = 0;
    let back = count - 1;
    while (front < back) {
      if (used[front] === 1) front += 1;
      else if (used[back] === 1) back -= 1;
      else if (yields[front] + yields[back] === rest) return [...picked, front, back];
      else if (yields[front] + yields[back] > rest) front += 1;
      else back -= 1;
    }
    return null;
  };

  let bestOvershoot = Infinity;
  let bestRows: number[] = [];
  const picks: number[] = [];

  const explore = (start: number, left: number, sum: number): void => {
    meter.charge(EXPLORE_NODE_WORK);
    if (left === 0) {
      if (sum >= need && sum - need < bestOvershoot) {
        bestOvershoot = sum - need;
        bestRows = [...picks];
      }
      return;
    }
    // The cheapest rows give the smallest total still possible from here.
    if (sum + prefix[count] - prefix[count - left] - need >= bestOvershoot) return;
    for (let row = start; row + left <= count;) {
      // The next rows give the largest total; rows are sorted, so later starts only lower it.
      if (sum + prefix[row + left] - prefix[row] < need) return;
      picks.push(row);
      explore(row + 1, left - 1, sum + yields[row]);
      picks.pop();
      if (bestOvershoot === 0) return;
      const value = yields[row];
      while (row < count && yields[row] === value) row += 1;
    }
  };

  for (let plays = fewest; plays <= Math.min(budget, count); plays += 1) {
    if (prefix[count] - prefix[count - plays] - need >= bestOvershoot) break;
    const closed = plays >= 2 ? closeExactly(plays) : null;
    if (closed !== null) {
      bestOvershoot = 0;
      bestRows = closed;
      break;
    }
    explore(0, plays, 0);
    if (bestOvershoot === 0) break;
  }

  const playsByYield = new Map<number, number>();
  for (const row of bestRows) {
    const value = yields[row] * unit;
    playsByYield.set(value, (playsByYield.get(value) ?? 0) + 1);
  }
  return { status: "solved", playsByYield };
};

/** `yields` holds each distinct per-play yield once; the plan maps a yield to its plays. */
export const searchLeastOvershootWithRepeats = (
  yields: readonly number[],
  need: number,
  budget: number,
  maxWork: number = LEAST_OVERSHOOT_MAX_SEARCH_WORK
): LeastOvershootOutcome =>
  runSearch(maxWork, (meter) => searchWithRepeats(yields, need, budget, meter));

/** `rows` holds one yield per playable row, repeated when rows share a yield. */
export const searchLeastOvershootWithoutRepeats = (
  rows: readonly number[],
  need: number,
  budget: number,
  maxWork: number = LEAST_OVERSHOOT_MAX_SEARCH_WORK
): LeastOvershootOutcome =>
  runSearch(maxWork, (meter) => searchWithoutRepeats(rows, need, budget, meter));
