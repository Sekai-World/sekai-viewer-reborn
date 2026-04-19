import { redirect, type RequestHandler } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";

export const GET: RequestHandler = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = url.searchParams.toString();
  const location = `/events/${encodeURIComponent(region)}/data${query ? `?${query}` : ""}`;

  throw redirect(308, location);
};
