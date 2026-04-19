import { redirect } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const eventId = params.id?.trim() ?? "";
  const region = normalizeRegion(url.searchParams.get("region"));
  const searchParams = new URLSearchParams(url.searchParams);
  searchParams.delete("region");
  const query = searchParams.toString();
  const location = `/event/${encodeURIComponent(region)}/${encodeURIComponent(eventId)}${
    query ? `?${query}` : ""
  }`;

  throw redirect(308, location);
};
