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

const HOVER_SNAP_THRESHOLD_PX = 14;

export type HoverSnapGeometry = Readonly<{
  clientX: number;
  svgRect: Readonly<Pick<DOMRect, "left" | "width">>;
  viewBoxWidth: number | null;
  markerXs: readonly number[];
}>;

/**
 * Returns the nearest marker in SVG user space while keeping a screen-pixel threshold.
 * When markers are equally distant, the first marker (lowest index) wins.
 */
export const findNearestHoverMarker = ({
  clientX,
  svgRect,
  viewBoxWidth,
  markerXs
}: HoverSnapGeometry): number | null => {
  if (!Number.isFinite(clientX) || !Number.isFinite(svgRect.left) || !Number.isFinite(svgRect.width) || svgRect.width <= 0) {
    return null;
  }

  const factor =
    viewBoxWidth !== null && Number.isFinite(viewBoxWidth) && viewBoxWidth > 0
      ? viewBoxWidth / svgRect.width
      : 1;
  if (!Number.isFinite(factor) || factor <= 0) return null;

  const pointerX = (clientX - svgRect.left) * factor;
  const threshold = HOVER_SNAP_THRESHOLD_PX / factor;
  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  markerXs.forEach((markerX, index) => {
    if (!Number.isFinite(markerX)) return;
    const distance = Math.abs(markerX - pointerX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex !== null && nearestDistance <= threshold ? nearestIndex : null;
};

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
