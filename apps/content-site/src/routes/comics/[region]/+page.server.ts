import { normalizeRegion } from "#lib/i18n/region.js";
import { fetchComics } from "#lib/server/comics.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  // Streams; a failed request resolves to null so the page can show its error state.
  const comics = fetchComics(getMasterApiBaseUrl(), region).catch(() => null);
  return { region, comics };
};
