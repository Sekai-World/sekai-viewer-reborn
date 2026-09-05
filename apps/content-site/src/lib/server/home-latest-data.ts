export type LatestGachaItem = {
  id: string;
  name: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

export const LATEST_GACHA_LIMIT = 2;

const toTimestamp = (value: string | number | null): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

type TimestampedGacha = {
  item: LatestGachaItem;
  startAt: number | null;
  endAt: number | null;
  index: number;
};

const compareByStartAtDescending = (left: TimestampedGacha, right: TimestampedGacha): number => {
  if (left.startAt === null && right.startAt === null) {
    return left.index - right.index;
  }
  if (left.startAt === null) {
    return 1;
  }
  if (right.startAt === null) {
    return -1;
  }
  if (left.startAt === right.startAt) {
    return left.index - right.index;
  }

  return left.startAt > right.startAt ? -1 : 1;
};

export const selectLatestGachas = (
  items: readonly LatestGachaItem[],
  now: number
): LatestGachaItem[] => {
  const timestampedItems = items.map((item, index) => ({
    item,
    startAt: toTimestamp(item.startAt),
    endAt: toTimestamp(item.endAt),
    index
  }));

  const startedItems = timestampedItems.filter(
    ({ startAt }) => startAt !== null && startAt <= now
  );
  const ongoingItems = startedItems
    .filter(({ startAt, endAt }) => startAt !== null && endAt !== null && now <= endAt)
    .sort(compareByStartAtDescending);
  const recentItems = startedItems
    .filter(({ startAt, endAt }) => !(startAt !== null && endAt !== null && now <= endAt))
    .sort(compareByStartAtDescending);

  return [...ongoingItems, ...recentItems].slice(0, LATEST_GACHA_LIMIT).map(({ item }) => item);
};
