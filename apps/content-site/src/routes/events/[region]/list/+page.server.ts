import { redirect } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = url.searchParams.toString();
  const location = `/events/${encodeURIComponent(region)}${query ? `?${query}` : ""}`;

  throw redirect(308, location);
};
