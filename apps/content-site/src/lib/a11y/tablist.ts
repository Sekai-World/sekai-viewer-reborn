/**
 * Resolve the tab index a WAI-ARIA tablist should move to for a keyboard
 * event. Returns null when the key is not part of the tablist pattern so the
 * caller can leave the event alone.
 */
export const getTablistTargetIndex = (
  key: string,
  currentIndex: number,
  count: number
): number | null => {
  if (count <= 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (currentIndex + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (currentIndex - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
};
