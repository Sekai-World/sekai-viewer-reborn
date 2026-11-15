/**
 * Play time of a target plan. Totals are summed in whole tenths of a second and converted once,
 * here, for display.
 * See docs/viewer-implementation/tools-site-yield-duration-energy.md.
 */

const TENTHS_PER_SECOND = 10;

/** A total in tenths of a second as `m:ss` or `h:mm:ss`, to the second, half rounded up. */
export const formatPlayTime = (tenths: number): string => {
  const totalSeconds = Math.floor((tenths + TENTHS_PER_SECOND / 2) / TENTHS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours === 0
    ? `${minutes}:${seconds}`
    : `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
};
