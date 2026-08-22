import { parseTrackerTimestamp } from "$lib/tracker-phase";

export type TrackerNameSnapshot = Readonly<{
  rank: number | null | undefined;
  userName: string | null | undefined;
  timestamp: string | number | null | undefined;
}>;

export type TrackerNameChange = Readonly<{
  timestamp: string;
  rank: number;
  previousName: string;
  nextName: string;
}>;

/** Finds real player-name changes while treating missing names as unknown data. */
export const findTrackerNameChanges = (
  snapshots: readonly TrackerNameSnapshot[],
  rank: number
): TrackerNameChange[] => {
  const ordered = snapshots
    .map((snapshot, index) => ({
      snapshot,
      index,
      time: parseTrackerTimestamp(snapshot.timestamp)
    }))
    .filter((entry): entry is typeof entry & { time: number } => entry.time !== null)
    .filter((entry) => entry.snapshot.rank === rank)
    .sort((a, b) => a.time - b.time || a.index - b.index);

  const changes: TrackerNameChange[] = [];
  let previousName: string | null = null;
  for (const { snapshot, time } of ordered) {
    const nextName = typeof snapshot.userName === "string" ? snapshot.userName.trim() : "";
    if (nextName.length === 0) continue;
    if (previousName !== null && previousName !== nextName) {
      changes.push({ timestamp: new Date(time).toISOString(), rank, previousName, nextName });
    }
    previousName = nextName;
  }
  return changes;
};
