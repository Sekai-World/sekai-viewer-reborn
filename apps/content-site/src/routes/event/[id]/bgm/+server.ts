import { redirect, type RequestHandler } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";

export const GET: RequestHandler = ({ params, url }) => {
  const eventId = params.id?.trim() ?? "";
  const region = normalizeRegion(url.searchParams.get("region"));
  const searchParams = new URLSearchParams(url.searchParams);
  searchParams.delete("region");
  const query = searchParams.toString();
  const location = `/event/${encodeURIComponent(region)}/${encodeURIComponent(eventId)}/bgm${
    query ? `?${query}` : ""
  }`;

  throw redirect(308, location);
};
