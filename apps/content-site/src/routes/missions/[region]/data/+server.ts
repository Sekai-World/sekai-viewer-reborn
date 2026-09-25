import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parsePositivePage } from "$lib/server/catalogue-data";
import {
  fetchMissionListPage,
  parseMissionCharacterId,
  parseMissionFamily
} from "$lib/server/mission-list";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const family = parseMissionFamily(url.searchParams);

  try {
    return json(
      await fetchMissionListPage(
        getMasterApiBaseUrl(),
        region,
        family ? [family] : undefined,
        page,
        {
          characterId:
            family === "characterMissionV2s" ? parseMissionCharacterId(url.searchParams) : null
        }
      )
    );
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
