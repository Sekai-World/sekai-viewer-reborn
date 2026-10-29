import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { parsePositivePage, getPositiveInteger } from "#lib/server/catalogue-data.js";
import { fetchMissionParameterGroupLevels } from "#lib/server/mission-list.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const parameterGroupId = getPositiveInteger(params.id);
  if (parameterGroupId === null) return Response.json({ error: true }, { status: 400 });

  try {
    const levels = await fetchMissionParameterGroupLevels(
      getMasterApiBaseUrl(),
      normalizeRegion(params.region),
      parameterGroupId,
      parsePositivePage(url.searchParams.get("page"))
    );
    return Response.json(levels);
  } catch {
    return Response.json({ error: true }, { status: 500 });
  }
};
