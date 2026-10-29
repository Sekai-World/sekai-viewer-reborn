import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchMysekaiMaterials } from "#lib/server/mysekai.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  // Every region has under a hundred materials, so the page filters them in the browser.
  const materials = fetchMysekaiMaterials(getMasterApiBaseUrl(), region).catch(() => null);
  return { region, materials };
};
