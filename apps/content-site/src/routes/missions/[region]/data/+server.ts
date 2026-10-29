import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { parsePositivePage } from "#lib/server/catalogue-data.js";
import {
  fetchMissionListPage,
  parseMissionCharacterId,
  parseMissionFamily
} from "#lib/server/mission-list.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const family = parseMissionFamily(url.searchParams);

  try {
    return Response.json(
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
    return Response.json({ error: true }, { status: 500 });
  }
};
