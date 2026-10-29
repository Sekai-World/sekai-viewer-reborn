import { loadMysekaiDetail } from "#lib/domain/mysekai.js";
import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchMysekaiFixtureDetail } from "#lib/server/mysekai.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  const payload = loadMysekaiDetail(params.id, (id) =>
    fetchMysekaiFixtureDetail(getMasterApiBaseUrl(), region, id)
  );
  return { region, id: params.id, payload };
};
