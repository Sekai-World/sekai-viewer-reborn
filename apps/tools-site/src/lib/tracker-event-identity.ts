/**
 * Resolves the event identity used by tracker detail and history endpoints.
 * Explicit route selections and current-event metadata are authoritative.
 * Ranking row event IDs are observational data and must not be used as a
 * metadata or activity-status fallback.
 */
export const resolveTrackerEventId = ({
  selectedEventId,
  resultSelectionEventId,
  catalogCurrentEventId
}: {
  selectedEventId: number | null;
  resultSelectionEventId?: number | null;
  catalogCurrentEventId: number | null | undefined;
}): number | null => {
  return resultSelectionEventId ?? selectedEventId ?? catalogCurrentEventId ?? null;
};
