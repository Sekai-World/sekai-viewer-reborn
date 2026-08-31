import type { PageServerLoad } from "./$types";

/**
 * Metadata-only route shell for the Live2D track landing page. No Live2D data
 * adapter exists yet, so the loader only describes the track.
 */
export const load: PageServerLoad = async () => ({ track: "live2d" as const });
