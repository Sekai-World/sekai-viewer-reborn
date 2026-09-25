import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchMissionCharacterOptions } from "$lib/server/mission-characters";
import type { RequestHandler } from "./$types";

// The Character Missions picker fetches this once per region, so choosing another
// character reloads only that character's missions.
export const GET: RequestHandler = async ({ params }) => {
  try {
    return json({
      items: await fetchMissionCharacterOptions(
        getMasterApiBaseUrl(),
        normalizeRegion(params.region)
      )
    });
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
