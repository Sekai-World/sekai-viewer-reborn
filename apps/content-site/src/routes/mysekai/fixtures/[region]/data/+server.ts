import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { parsePositivePage } from "#lib/server/catalogue-data.js";
import { parseMysekaiFixtureListQuery } from "#lib/domain/mysekai.js";
import { fetchMysekaiFixtureListPage } from "#lib/server/mysekai.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const query = parseMysekaiFixtureListQuery(url.searchParams);

  try {
    return Response.json(
      await fetchMysekaiFixtureListPage(getMasterApiBaseUrl(), region, query, page)
    );
  } catch {
    return Response.json({ error: true }, { status: 500 });
  }
};
