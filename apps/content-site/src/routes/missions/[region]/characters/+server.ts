import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchMissionCharacterOptions } from "#lib/server/mission-characters.js";
import type { RequestHandler } from "./$types";

// The Character Missions picker fetches this once per region, so choosing another
// character reloads only that character's missions.
export const GET: RequestHandler = async ({ params }) => {
  try {
    return Response.json({
      items: await fetchMissionCharacterOptions(
        getMasterApiBaseUrl(),
        normalizeRegion(params.region)
      )
    });
  } catch {
    return Response.json({ error: true }, { status: 500 });
  }
};
