import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parsePositivePage, getPositiveInteger } from "$lib/server/catalogue-data";
import { fetchMissionParameterGroupLevels } from "$lib/server/mission-list";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const parameterGroupId = getPositiveInteger(params.id);
  if (parameterGroupId === null) return json({ error: true }, { status: 400 });

  try {
    const levels = await fetchMissionParameterGroupLevels(
      getMasterApiBaseUrl(),
      normalizeRegion(params.region),
      parameterGroupId,
      parsePositivePage(url.searchParams.get("page"))
    );
    return json(levels);
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
