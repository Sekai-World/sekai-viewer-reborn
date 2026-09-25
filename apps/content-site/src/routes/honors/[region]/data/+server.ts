import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parsePositivePage } from "$lib/server/catalogue-data";
import { fetchHonorListPage, parseHonorListQueryState } from "$lib/server/honor-list";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const queryState = parseHonorListQueryState(url.searchParams);

  try {
    return json(await fetchHonorListPage(getMasterApiBaseUrl(), region, page, queryState));
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
