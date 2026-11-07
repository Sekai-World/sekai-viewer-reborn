import { parseCostumeListQuery } from "#lib/domain/costume.js";
import { normalizeRegion } from "#lib/i18n/region.js";
import { parsePositivePage } from "#lib/server/catalogue-data.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchCostumeListPage } from "#lib/server/costumes.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const query = parseCostumeListQuery(url.searchParams);

  try {
    return Response.json(await fetchCostumeListPage(getMasterApiBaseUrl(), region, query, page));
  } catch {
    return Response.json({ error: true }, { status: 500 });
  }
};
