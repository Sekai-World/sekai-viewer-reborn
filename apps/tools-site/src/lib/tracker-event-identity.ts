/**
 * Resolves the event identity used by tracker detail and history endpoints.
 * An explicit history selection always wins; live rankings provide the next
 * most reliable identity because they are returned by the same source as the
 * ranking rows being inspected.
 */
export const resolveTrackerEventId = ({
  selectedEventId,
  resultSelectionEventId,
  resolvedCurrentEventId,
  rankingEventIds,
  catalogCurrentEventId
}: {
  selectedEventId: number | null;
  resultSelectionEventId?: number | null;
  resolvedCurrentEventId: number | null | undefined;
  rankingEventIds?: Array<number | null | undefined>;
  catalogCurrentEventId: number | null | undefined;
}): number | null => {
  const rankingIds = new Set(
    (rankingEventIds ?? []).filter((eventId): eventId is number => eventId !== null && eventId !== undefined)
  );
  const rankingEventId = rankingIds.size === 1 ? [...rankingIds][0] ?? null : null;
  return (
    resultSelectionEventId ??
    selectedEventId ??
    resolvedCurrentEventId ??
    rankingEventId ??
    catalogCurrentEventId ??
    null
  );
};
