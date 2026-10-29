import { parseStampListQuery } from "#lib/domain/stamp.js";
import { normalizeRegion } from "#lib/i18n/region.js";
import { parsePositivePage } from "#lib/server/catalogue-data.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchStampListPage } from "#lib/server/stamps.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const query = parseStampListQuery(url.searchParams);

  try {
    return Response.json(await fetchStampListPage(getMasterApiBaseUrl(), region, query, page));
  } catch {
    return Response.json({ error: true }, { status: 500 });
  }
};
