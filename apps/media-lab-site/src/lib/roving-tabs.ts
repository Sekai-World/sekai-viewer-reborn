/**
 * Target index for a tablist key press (Arrow keys wrap, Home/End jump), or
 * null when the key does not move focus.
 */
export const getRovingTabIndex = (key: string, index: number, length: number): number | null => {
  if (length === 0) return null;
  if (key === "ArrowRight") return (index + 1) % length;
  if (key === "ArrowLeft") return (index - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
};
