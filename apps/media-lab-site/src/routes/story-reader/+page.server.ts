import type { PageServerLoad } from "./$types";

/**
 * Mode-selection landing for StoryReader. No story data exists here; the page
 * only presents the two reading modes, and every mode keeps the validated
 * story address in its own route.
 */
export const load: PageServerLoad = async () => ({ track: "story-reader" as const });
