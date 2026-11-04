import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import { fetchMysekaiPhotoFrames } from "#lib/server/mysekai.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  // Every region has about a dozen frames, so the page filters them in the browser.
  const frames = fetchMysekaiPhotoFrames(getMasterApiBaseUrl(), region).catch(() => null);
  return { region, frames };
};
