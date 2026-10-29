import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { parsePositivePage } from "#lib/server/catalogue-data.js";
import { fetchHonorListPage, parseHonorListQueryState } from "#lib/server/honor-list.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const queryState = parseHonorListQueryState(url.searchParams);

  try {
    return Response.json(await fetchHonorListPage(getMasterApiBaseUrl(), region, page, queryState));
  } catch {
    return Response.json({ error: true }, { status: 500 });
  }
};
