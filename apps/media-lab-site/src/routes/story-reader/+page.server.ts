import type { PageServerLoad } from "./$types";

/**
 * Story Reader landing: presents both reading modes and the story picker.
 * Story lists are lazy-loaded per region/type from the reader API so the
 * landing page stays light.
 */
export const load: PageServerLoad = async () => ({ track: "story-reader" as const });
